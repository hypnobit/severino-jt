;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  const CHAVE = 'pjt_consentimento'

  // BUMPAR quando o texto do termo mudar (invalida aceites antigos → reconsentimento).
  const TERMO_VERSAO = 1

  function consentimentoValido(registro) {
    return !!registro &&
      registro.aceito === true &&
      registro.versaoTermo === TERMO_VERSAO
  }

  // Fail-closed: sem `browser` ou erro de leitura → não consentido.
  async function concedido() {
    if (typeof browser === 'undefined') return false
    try {
      const r = (await browser.storage.local.get(CHAVE))[CHAVE] ?? null
      return consentimentoValido(r)
    } catch {
      return false
    }
  }

  async function registrar() {
    await browser.storage.local.set({
      [CHAVE]: { aceito: true, versaoTermo: TERMO_VERSAO, data: new Date().toISOString() }
    })
  }

  root.PjeTools.consentimento = { CHAVE, TERMO_VERSAO, consentimentoValido, concedido, registrar }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { consentimentoValido, TERMO_VERSAO }
  }

})()
