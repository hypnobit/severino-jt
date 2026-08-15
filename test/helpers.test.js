'use strict'

// Testes de caracterização de lib/helpers.js — travam o comportamento atual
// antes de qualquer refatoração. Rede de segurança, não Red-Green.

const { test } = require('node:test')
const assert = require('node:assert/strict')

const helpers = require('../lib/helpers.js')

test('escapar neutraliza os cinco metacaracteres de HTML', () => {
  assert.equal(
    helpers.escapar('<a href="x">Tom & Jerry</a>'),
    '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;'
  )
})

test('escapar troca o & primeiro, sem dupla-escapar entidades', () => {
  // Se & não fosse trocado antes de <, o resultado teria &amp;lt;
  assert.equal(helpers.escapar('<'), '&lt;')
  assert.equal(helpers.escapar('&lt;'), '&amp;lt;')
})

test('escapar trata null e undefined como string vazia', () => {
  assert.equal(helpers.escapar(null), '')
  assert.equal(helpers.escapar(undefined), '')
})

test('dataHoje devolve ISO YYYY-MM-DD', () => {
  assert.match(helpers.dataHoje(), /^\d{4}-\d{2}-\d{2}$/)
})

// migrarTema: decide se um valor salvo em storage precisa ser trocado por um
// fallback válido após a remoção de presets (ver modules/dark-theme.js TEMAS).
test('migrarTema: chave já válida → null (nada a fazer)', () => {
  assert.equal(helpers.migrarTema('sepia', ['sepia', 'papel'], 'sepia'), null)
})

test('migrarTema: chave removida (ex.: preset descontinuado) → cai no fallback', () => {
  assert.equal(helpers.migrarTema('vscode', ['sepia', 'papel'], 'sepia'), 'sepia')
})

test('migrarTema: nada selecionado (null/undefined/vazio) → null (não força tema)', () => {
  assert.equal(helpers.migrarTema(null, ['sepia', 'papel'], 'sepia'), null)
  assert.equal(helpers.migrarTema(undefined, ['sepia', 'papel'], 'sepia'), null)
  assert.equal(helpers.migrarTema('', ['sepia', 'papel'], 'sepia'), null)
})
