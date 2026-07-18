'use strict'

// Caracterização de lib/api.js — detecção de sessão expirada e demais ramos de
// requisitar(), nunca disparados em processo real (REGISTRO §3). fetch é global
// e mockado por teste; a facade é importada pelo rodapé de export dual.

const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')

const api = require('../lib/api.js')

const fetchOriginal = globalThis.fetch
afterEach(() => { globalThis.fetch = fetchOriginal })

function resposta({ status = 200, contentType = 'application/json', corpo = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: h => (h.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => corpo,
    text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
    arrayBuffer: async () => new ArrayBuffer(0)
  }
}
const mockFetch = r => { globalThis.fetch = async () => resposta(r) }

test('SessaoExpirada: HTTP 200 com HTML de login (nunca confiar só em r.ok)', async () => {
  mockFetch({ status: 200, contentType: 'text/html; charset=UTF-8', corpo: '<html>login</html>' })
  await assert.rejects(api.processo(1), api.SessaoExpirada)
})

test('SessaoExpirada: HTTP 401', async () => {
  mockFetch({ status: 401, contentType: 'application/json' })
  await assert.rejects(api.processo(1), api.SessaoExpirada)
})

test('SessaoExpirada: HTTP 403', async () => {
  mockFetch({ status: 403, contentType: 'application/json' })
  await assert.rejects(api.processo(1), api.SessaoExpirada)
})

test('erro de HTTP que não é sessão (500 com json) → Error genérico, não SessaoExpirada', async () => {
  mockFetch({ status: 500, contentType: 'application/json' })
  await assert.rejects(
    api.processo(1),
    e => e instanceof Error && !(e instanceof api.SessaoExpirada) && /HTTP 500/.test(e.message)
  )
})

test('content-type inesperado (PDF onde se espera JSON) → erro claro, não SessaoExpirada', async () => {
  mockFetch({ status: 200, contentType: 'application/pdf' })
  await assert.rejects(api.processo(1), e => /Resposta inesperada/.test(e.message))
})

test('resposta JSON válida resolve com o corpo', async () => {
  mockFetch({ status: 200, contentType: 'application/json', corpo: { numero: '123' } })
  assert.deepEqual(await api.processo(1), { numero: '123' })
})
