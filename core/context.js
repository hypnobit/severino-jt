;(function () {
  'use strict'

  window.PjeTools = window.PjeTools || {}

  const log = window.PjeTools.helpers.criarLog('[PJeTools Core]')

  window.PjeTools.context = { processo: null }

  // ── Helpers locais ────────────────────────────────────────────────────────

  function idDaUrl() {
    const m = location.pathname.match(/\/processo\/(\d+)\//)
    return m ? m[1] : null
  }

  async function buscarProcesso(id) {
    if (window.PROCESSO?.numero) return { id, numero: window.PROCESSO.numero }

    try {
      const r = await fetch(
        `${location.origin}/pje-comum-api/api/processos/id/${id}`,
        { credentials: 'include' }
      )
      if (!r.ok) return { id, numero: '' }
      const d = await r.json()
      return { id, numero: d?.numero || d?.numeroProcesso || '' }
    } catch {
      return { id, numero: '' }
    }
  }

  // ── Atualização de contexto ───────────────────────────────────────────────

  async function atualizar() {
    if (!(await window.PjeTools.consentimento.concedido())) return
    const id = idDaUrl()
    window.PjeTools.context.processo = id ? await buscarProcesso(id) : null
    document.dispatchEvent(
      new CustomEvent('pjetools:contexto', { detail: window.PjeTools.context.processo })
    )
    log('processo:', window.PjeTools.context.processo)
  }

  // ── Observer de URL (SPA Angular) ─────────────────────────────────────────

  let urlAtual = location.pathname
  new MutationObserver(() => {
    if (location.pathname !== urlAtual) {
      urlAtual = location.pathname
      atualizar()
    }
  }).observe(document.body, { childList: true, subtree: true })

  atualizar()

})()
