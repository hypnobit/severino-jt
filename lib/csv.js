;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  // CWE-1236: célula iniciada por = + - @ vira fórmula ao abrir no Excel/Calc.
  function escaparCelula(valor) {
    let s = String(valor ?? '')
    if (/^[=+\-@]/.test(s)) s = "'" + s
    return '"' + s.replace(/"/g, '""') + '"'
  }

  function linha(campos) {
    return campos.map(escaparCelula).join(',')
  }

  root.PjeTools.csv = { escaparCelula, linha }

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PjeTools.csv

})()
