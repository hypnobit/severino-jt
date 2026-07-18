'use strict'

// TDD do lib/csv.js — escaping de CSV compartilhado. Diferente dos testes de
// caracterização de resumo-calculo: aqui o comportamento é especificado ANTES
// do código existir (Red-Green-Refactor).

const { test } = require('node:test')
const assert = require('node:assert/strict')

const csv = require('../lib/csv.js')

test('escaparCelula envolve toda célula em aspas', () => {
  assert.equal(csv.escaparCelula('abc'), '"abc"')
})

test('escaparCelula trata null e undefined como vazio', () => {
  assert.equal(csv.escaparCelula(null), '""')
  assert.equal(csv.escaparCelula(undefined), '""')
})

test('escaparCelula duplica aspas internas', () => {
  assert.equal(csv.escaparCelula('diz "oi"'), '"diz ""oi"""')
})

test('escaparCelula blinda fórmula com apóstrofo em = + - @ (CWE-1236)', () => {
  for (const gatilho of ['=', '+', '-', '@']) {
    assert.equal(
      csv.escaparCelula(gatilho + 'SOMA(A1)'),
      `"'${gatilho}SOMA(A1)"`,
      `gatilho ${gatilho} deveria ser prefixado com '`
    )
  }
})

test('escaparCelula não prefixa célula que apenas contém = no meio', () => {
  assert.equal(csv.escaparCelula('a=b'), '"a=b"')
})

test('linha escapa cada campo e junta por vírgula', () => {
  assert.equal(csv.linha(['a', '=b', 'c "d"']), '"a","\'=b","c ""d"""')
})
