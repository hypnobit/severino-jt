'use strict'

// Renderizador de markdown do dossiê (lib/markdown.js). Subconjunto gerado por
// montarMarkdown: títulos, tabelas, código, citação, listas, hr, **negrito**,
// *itálico*, `código`. ESCAPE-FIRST: o dossiê carrega texto de petição do
// servidor, então todo texto tem de sair escapado (defesa contra XSS no sink
// innerHTML da prévia). Underscore é SEMPRE literal (nomes tipo RELATORIO_CALCULO).

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { renderizar } = require('../lib/markdown.js')

test('títulos viram h1..h4', () => {
  assert.match(renderizar('# Um'), /<h1>Um<\/h1>/)
  assert.match(renderizar('### Três'), /<h3>Três<\/h3>/)
  assert.match(renderizar('#### Quatro'), /<h4>Quatro<\/h4>/)
})

test('inline: negrito, itálico e código', () => {
  assert.match(renderizar('um **forte** aqui'), /<strong>forte<\/strong>/)
  assert.match(renderizar('um *ênfase* aqui'), /<em>ênfase<\/em>/)
  assert.match(renderizar('use `codigo` aqui'), /<code>codigo<\/code>/)
})

test('underscore é literal — só asterisco vira itálico', () => {
  const h = renderizar('- Documento — *RELATORIO_CALCULO_2025*')
  assert.match(h, /RELATORIO_CALCULO_2025/)
  assert.match(h, /<em>RELATORIO_CALCULO_2025<\/em>/)
})

test('tabela vira <table> com thead/tbody', () => {
  const h = renderizar('| Descrição | Valor |\n| --- | --- |\n| Total | 1,00 |')
  assert.match(h, /<table>/)
  assert.match(h, /<th>Descrição<\/th>/)
  assert.match(h, /<td>Total<\/td>/)
  assert.match(h, /<td>1,00<\/td>/)
})

test('bloco de código escapa e NÃO aplica inline', () => {
  const h = renderizar('```text\n**literal** <b>x</b>\n```')
  assert.match(h, /<pre><code>/)
  assert.match(h, /\*\*literal\*\*/)
  assert.doesNotMatch(h, /<strong>/)
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/)
})

test('citação vira blockquote', () => {
  assert.match(renderizar('> aviso'), /<blockquote>aviso<\/blockquote>/)
})

test('lista vira ul/li', () => {
  const h = renderizar('- um\n- dois')
  assert.match(h, /<ul>/)
  assert.match(h, /<li>um<\/li>/)
  assert.match(h, /<li>dois<\/li>/)
})

test('--- vira hr', () => {
  assert.match(renderizar('a\n\n---\n\nb'), /<hr>/)
})

test('parágrafo agrupa linhas consecutivas', () => {
  assert.match(renderizar('linha um\nlinha dois'), /<p>linha um linha dois<\/p>/)
})

// ── SEGURANÇA — escape-first ────────────────────────────────────────────────

test('XSS: script em texto é escapado', () => {
  const h = renderizar('Olá <script>alert(1)</script> mundo')
  assert.doesNotMatch(h, /<script>/)
  assert.match(h, /&lt;script&gt;/)
})

test('XSS: img onerror em célula de tabela é escapado', () => {
  const h = renderizar('| A | B |\n| --- | --- |\n| <img src=x onerror=alert(1)> | y |')
  assert.doesNotMatch(h, /<img/)
  assert.match(h, /&lt;img/)
})

test('XSS: aspas e < em título são escapados', () => {
  assert.match(renderizar('# "<b>oi</b>"'), /&quot;&lt;b&gt;oi/)
})
