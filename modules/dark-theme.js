;(function () {
  'use strict'

  if (!location.pathname.includes('/pdf/web/viewer.html')) return

    window.PjeTools = window.PjeTools || {}

    const CHAVE = 'pjt_tema'

    const TEMAS = {
      sepia:      { nome: 'Sépia Escuro',      fundo: '#2a2318', filtro: 'invert(0.88) sepia(0.25) hue-rotate(10deg) contrast(0.9)' },
  vscode:     { nome: 'VSCode Dark+',      fundo: '#1e1e1e', filtro: 'invert(0.88) hue-rotate(180deg) saturate(1.1) contrast(0.9)' },
  onedark:    { nome: 'One Dark',          fundo: '#282c34', filtro: 'invert(0.85) hue-rotate(185deg) saturate(1.2) contrast(0.88)' },
  solarized:  { nome: 'Solarized Dark',    fundo: '#002b36', filtro: 'invert(0.87) hue-rotate(175deg) saturate(0.85) contrast(0.92)' },
  noite:      { nome: 'Noite Suave',       fundo: '#1a1a2e', filtro: 'invert(0.85) hue-rotate(180deg) contrast(0.88)' },
  papel:      { nome: 'Papel Envelhecido', fundo: '#1c1a14', filtro: 'invert(0.82) sepia(0.4) hue-rotate(15deg) contrast(0.85)' },
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
