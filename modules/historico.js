;(function () {
  'use strict'

  const { helpers, context, consentimento } = window.PjeTools
  const log  = helpers.criarLog('[PJeTools Histórico]')
  const CHAVE = 'pjt_historico'

  function contextoUrl() {
    const p = location.pathname
    if (p.includes('/documento/anexar')) return 'Anexar Documento'
    if (/\/tarefa\/\d+/.test(p))        return 'Tarefa'
    if (p.includes('/comunicacao'))     return 'Comunicação'
    return 'Processo'
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  async function lerHistorico() {
    const h = (await browser.storage.local.get(CHAVE))[CHAVE] ?? null
    return (h?.data === helpers.dataHoje())
      ? h
      : { data: helpers.dataHoje(), consultas: [], assinaturas: [] }
  }

  async function purgarSeAntigo() {
    const h = (await browser.storage.local.get(CHAVE))[CHAVE] ?? null
    if (h && h.data !== helpers.dataHoje()) {
      await browser.storage.local.remove(CHAVE)
      log('Histórico de dia anterior purgado.')
    }
  }

  // ── Registro de consulta ──────────────────────────────────────────────────

  async function registrarConsulta(processo) {
    if (!processo) return
    if (!(await consentimento.concedido())) return

    const identificador = processo.numero || `ID:${processo.id}`
    const h    = await lerHistorico()
    const agora = Date.now()

    if (h.consultas.some(c =>
      c.identificador === identificador &&
      agora - new Date(c._iso) < 60_000
    )) return

    h.consultas.push({
      identificador,
      numero:    processo.numero,
      idInterno: processo.id,
      timestamp: helpers.timestampAgora(),
      _iso:      new Date().toISOString()
    })

    await browser.storage.local.set({ [CHAVE]: h })
    log('Consulta registrada:', identificador)
  }

  // ── Registro de assinatura ────────────────────────────────────────────────

  async function registrarAssinatura() {
    if (!(await consentimento.concedido())) return
    const processo      = context.processo
    const identificador = processo?.numero || (processo ? `ID:${processo.id}` : '—')

    const h = await lerHistorico()
    h.assinaturas.push({
      identificador,
      numero:    processo?.numero    || '',
      idInterno: processo?.id        || '',
      contexto:  contextoUrl(),
      timestamp: helpers.timestampAgora(),
      _iso:      new Date().toISOString()
    })

    await browser.storage.local.set({ [CHAVE]: h })
    log('Assinatura registrada:', identificador)
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  purgarSeAntigo()

  document.addEventListener('pjetools:contexto', e => registrarConsulta(e.detail))

  browser.runtime.onMessage.addListener(msg => {
    if (msg.tipo === 'historico:assinatura_detectada') registrarAssinatura()
  })

})()
