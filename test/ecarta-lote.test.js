'use strict'

// Regressão de XSS: exibirRelatorio injetava dado do servidor (objeto,
// destinatário, status, processo) direto no innerHTML. Os construtores de
// linha agora devem escapar. escapar em si já é coberto por helpers.test.js;
// aqui provamos que os builders o aplicam.

const { test } = require('node:test')
const assert = require('node:assert/strict')

require('../lib/helpers.js') // popula PjeTools.helpers.escapar (ordem do manifest)
const { montarLinhaObjeto, montarLinhaSemResultado } = require('../modules/ecarta-lote.js')

const PAYLOAD = '<img src=x onerror=alert(1)>'

test('montarLinhaObjeto escapa o objeto vindo do servidor', () => {
  const html = montarLinhaObjeto({ objeto: PAYLOAD }, '0001', true)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /<img/)
})

test('montarLinhaObjeto escapa o destinatário no texto e no atributo title', () => {
  const html = montarLinhaObjeto({ destinatario: '"><script>alert(1)</script>' }, '0001', true)
  assert.doesNotMatch(html, /<script>/)
  // não deve haver aspas cruas do payload quebrando o title="..."
  assert.match(html, /title="[^"]*&quot;/)
})

test('montarLinhaObjeto escapa o processo na primeira linha', () => {
  const html = montarLinhaObjeto({}, '<b>0001</b>', true)
  assert.match(html, /&lt;b&gt;0001&lt;\/b&gt;/)
  assert.doesNotMatch(html, /<b>0001/)
})

test('montarLinhaSemResultado escapa o processo', () => {
  const html = montarLinhaSemResultado('<b>x</b>')
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.doesNotMatch(html, /<b>x/)
})

test('montarLinhaObjeto preserva o travessão para campo vazio', () => {
  const html = montarLinhaObjeto({ idPje: '' }, '0001', true)
  assert.match(html, /—/)
})

test('montarLinhaObjeto omite o processo quando não é a primeira linha', () => {
  const html = montarLinhaObjeto({ objeto: 'x' }, '0001', false)
  assert.doesNotMatch(html, /0001/)
})
