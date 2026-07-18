'use strict'

// Testes de caracterização de lib/resumo-calculo.js — travam a serialização
// atual (CSV e Markdown) antes de refatorar. extrairResumo depende de pdfjs +
// PDF real e fica fora daqui; testamos só as funções puras de saída.

const { test } = require('node:test')
const assert = require('node:assert/strict')

require('../lib/csv.js') // resumo-calculo passou a depender de PjeTools.csv — carregado antes, como no manifest/HTML
const { gerarCsv, gerarMarkdownCompleto } = require('../lib/resumo-calculo.js')

const BOM = '﻿'

test('gerarCsv abre com BOM, cita toda célula e termina em CRLF', () => {
  const csv = gerarCsv(['Descrição', 'Valor'], [['Férias', '1.000,00']])
  assert.equal(csv, BOM + '"Descrição","Valor"\r\n"Férias","1.000,00"\r\n')
})

test('gerarCsv blinda injeção de fórmula com apóstrofo (CWE-1236)', () => {
  const csv = gerarCsv(['x'], [['=SOMA(A1)']])
  assert.equal(csv, BOM + '"x"\r\n"\'=SOMA(A1)"\r\n')
})

test('gerarCsv duplica aspas internas', () => {
  const csv = gerarCsv(['a'], [['diz "oi"']])
  assert.equal(csv, BOM + '"a"\r\n"diz ""oi"""\r\n')
})

test('gerarMarkdownCompleto usa o número do cálculo no título', () => {
  const md = gerarMarkdownCompleto({
    numeroCalculo: '42',
    tabelas: { bruto: [], creditos: [], debitos: [] }
  })
  assert.match(md, /^# Resumo do Cálculo nº 42\n/)
})

test('gerarMarkdownCompleto omite o número quando ausente', () => {
  const md = gerarMarkdownCompleto({
    numeroCalculo: null,
    tabelas: { bruto: [], creditos: [], debitos: [] }
  })
  assert.match(md, /^# Resumo do Cálculo\n/)
})

test('gerarMarkdownCompleto marca tabela vazia com placeholder explícito', () => {
  const md = gerarMarkdownCompleto({
    numeroCalculo: '1',
    tabelas: { bruto: [], creditos: [], debitos: [] }
  })
  const ocorrencias = md.split('_Tabela não encontrada ou vazia neste PDF._').length - 1
  assert.equal(ocorrencias, 3)
})

test('gerarMarkdownCompleto renderiza tabela e respeita nivelTitulo', () => {
  const md = gerarMarkdownCompleto({
    numeroCalculo: null,
    tabelas: { bruto: [['Férias', '10', '1', '11']], creditos: [], debitos: [] }
  }, 2)
  assert.match(md, /^## Resumo do Cálculo\n/)
  assert.match(md, /### Descrição do Bruto Devido ao Reclamante/)
  assert.match(md, /\| Descrição \| Valor Corrigido \| Juros \| Total \|/)
  assert.match(md, /\| Férias \| 10 \| 1 \| 11 \|/)
})
