;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  root.PjeTools.helpers = {

    aguardar: ms => new Promise(r => setTimeout(r, ms)),

    dataHoje: () => new Date().toISOString().slice(0, 10),

    timestampAgora: () => new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }),

    escapar: s => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),

    criarLog: prefixo => (msg, dados) =>
      dados !== undefined
        ? console.log(prefixo, msg, dados)
        : console.log(prefixo, msg),

    // Decide se um valor salvo em storage precisa virar `fallback` (chave removida
    // num update) ou se já é válido/vazio e não deve ser tocado. Retorna null
    // quando não há migração a fazer, para o chamador só escrever quando preciso.
    migrarTema: (temaAtual, chavesValidas, fallback) =>
      !temaAtual || chavesValidas.includes(temaAtual) ? null : fallback

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PjeTools.helpers

})()
