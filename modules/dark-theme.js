;(function () {
  'use strict'

  if (!location.pathname.includes('/pdf/web/viewer.html')) return

    window.PjeTools = window.PjeTools || {}

    const CHAVE = 'pjt_tema'

    const TEMAS = {
      // Escuro: inverte o PDF (branco→escuro, preto→claro) e tinge de sépia.
      sepia: { nome: 'Sépia Escuro',      fundo: '#2a2318', filtro: 'invert(0.88) sepia(0.25) hue-rotate(10deg) contrast(0.9)' },
      // Claro: NÃO inverte — só afasta o branco puro, sépia parcial + brilho/contraste
      // levemente reduzidos, para descanso da vista sem virar modo escuro.
      papel: { nome: 'Papel Envelhecido', fundo: '#e8ddc7', filtro: 'sepia(0.25) brightness(0.97) contrast(0.96)' },
    }

    window.PjeTools.darkTheme = { TEMAS }

    // ── Aplicação do tema ─────────────────────────────────────────────────────

    function aplicarTema(chave) {
      const tema  = TEMAS[chave]
      let   style = document.getElementById('pjt-tema')

      if (!style) {
        style    = document.createElement('style')
        style.id = 'pjt-tema'
        document.head.appendChild(style)
      }

      style.textContent = tema
      ? `#viewerContainer { background: ${tema.fundo} !important; }
      .canvasWrapper canvas { filter: ${tema.filtro} !important; }`
      : ''
    }

    // ── Inicialização e reatividade ───────────────────────────────────────────

    const { consentimento } = window.PjeTools

    browser.storage.local.get(CHAVE).then(async r => {
      if (!(await consentimento.concedido())) return
      const chave = r[CHAVE]; if (chave) aplicarTema(chave)
    })

    browser.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local' && CHAVE in changes) {
        if (!(await consentimento.concedido())) return
        aplicarTema(changes[CHAVE].newValue || '')
      }
    })

})()
