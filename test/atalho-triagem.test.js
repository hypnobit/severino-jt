'use strict'

// ehTarefaTriagem — decide se o texto do cabeçalho do pjekz corresponde à tarefa
// "Triagem Inicial". O Angular emite o texto com espaços de sobra (" Triagem Inicial "),
// e a caixa pode variar; qualquer coisa que não seja string casa fail-closed (false).

const test   = require('node:test')
const assert = require('node:assert')

const { ehTarefaTriagem } = require('../modules/atalho-triagem.js')

test('ehTarefaTriagem: texto exato do cabeçalho, com os espaços do Angular → true', () => {
  assert.equal(ehTarefaTriagem(' Triagem Inicial '), true)
  assert.equal(ehTarefaTriagem('Triagem Inicial'), true)
})

test('ehTarefaTriagem: variação de caixa e espaços internos duplicados → true', () => {
  assert.equal(ehTarefaTriagem('TRIAGEM INICIAL'), true)
  assert.equal(ehTarefaTriagem('triagem  inicial'), true)
})

test('ehTarefaTriagem: outra tarefa → false', () => {
  assert.equal(ehTarefaTriagem(' Análise de Conhecimento '), false)
  assert.equal(ehTarefaTriagem('Triagem'), false)
  assert.equal(ehTarefaTriagem('Triagem Inicial Revisada'), false)
})

test('ehTarefaTriagem: nulo/indefinido/vazio/não-string → false (fail-closed)', () => {
  assert.equal(ehTarefaTriagem(null), false)
  assert.equal(ehTarefaTriagem(undefined), false)
  assert.equal(ehTarefaTriagem(''), false)
  assert.equal(ehTarefaTriagem(42), false)
})
