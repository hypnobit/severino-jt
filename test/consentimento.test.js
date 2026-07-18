'use strict'

const { test } = require('node:test')
const assert   = require('node:assert')

const { consentimentoValido, TERMO_VERSAO } = require('../lib/consentimento.js')

// consentimentoValido é a regra pura do portão. Princípio: FAIL-CLOSED — qualquer
// coisa que não seja um aceite explícito da versão corrente do termo é "não consentido".

test('consentimentoValido: registro nulo/ausente → false (fail-closed)', () => {
  assert.strictEqual(consentimentoValido(null), false)
  assert.strictEqual(consentimentoValido(undefined), false)
})

test('consentimentoValido: aceito=true e versão corrente → true', () => {
  assert.strictEqual(consentimentoValido({ aceito: true, versaoTermo: TERMO_VERSAO }), true)
})

test('consentimentoValido: aceito=false → false', () => {
  assert.strictEqual(consentimentoValido({ aceito: false, versaoTermo: TERMO_VERSAO }), false)
})

test('consentimentoValido: versão diferente → false (força reconsentimento)', () => {
  assert.strictEqual(consentimentoValido({ aceito: true, versaoTermo: TERMO_VERSAO + 1 }), false)
  assert.strictEqual(consentimentoValido({ aceito: true, versaoTermo: TERMO_VERSAO - 1 }), false)
})

test('consentimentoValido: sem o campo aceito → false', () => {
  assert.strictEqual(consentimentoValido({ versaoTermo: TERMO_VERSAO }), false)
})

test('consentimentoValido: aceito truthy mas não === true → false (nada de coerção frouxa)', () => {
  assert.strictEqual(consentimentoValido({ aceito: 1, versaoTermo: TERMO_VERSAO }), false)
  assert.strictEqual(consentimentoValido({ aceito: 'true', versaoTermo: TERMO_VERSAO }), false)
})

test('consentimentoValido: formato inesperado → false', () => {
  assert.strictEqual(consentimentoValido('sim'), false)
  assert.strictEqual(consentimentoValido(42), false)
  assert.strictEqual(consentimentoValido({}), false)
})
