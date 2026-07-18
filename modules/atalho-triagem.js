;(function () {
  'use strict'

  // Detecção: a URL não muda por tarefa → o sinal vem do DOM (span.texto-tarefa-processo, do PJe).

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  const TAREFA_ALVO = 'triagem inicial'

  function ehTarefaTriagem(texto) {
    if (typeof texto !== 'string') return false
    return texto.replace(/\s+/g, ' ').trim().toLowerCase() === TAREFA_ALVO
  }

  // ── Fiação (browser-only) ───────────────────────────────────────────────────
  if (typeof document !== 'undefined' && typeof browser !== 'undefined') {
    const { aguardar, criarLog } = root.PjeTools.helpers
    const log = criarLog('[PJeTools Atalho-Triagem]')

    const ID_BOTAO = '_pjt_atalho_triagem'
    let geracao = 0

    function removerBotao() {
      document.getElementById(ID_BOTAO)?.remove()
    }

    function criarBotao(idProcesso) {
      removerBotao()
      const b = document.createElement('button')
      b.id = ID_BOTAO
      b.type = 'button'
      b.textContent = '📋 Dossiê de triagem'
      b.title = 'Severino JT — monta o dossiê de triagem deste processo'
      b.style.cssText =
        'position:fixed;left:18px;bottom:18px;z-index:2147483646;' +
        'padding:10px 16px;background:#1d4e89;color:#fff;border:none;border-radius:999px;' +
        'font:600 13px "Segoe UI","Helvetica Neue",Arial,sans-serif;cursor:pointer;' +
        'box-shadow:0 4px 14px rgba(11,37,69,.35);' +
        'transition:background .15s,transform .15s,box-shadow .15s'
      // hover via listeners — <style> injetado esbarraria no CSP da página.
      const realcar = ligado => {
        b.style.background = ligado ? '#13315c' : '#1d4e89'
        b.style.transform  = ligado ? 'translateY(-1px)' : 'none'
        b.style.boxShadow  = ligado ? '0 6px 18px rgba(11,37,69,.45)' : '0 4px 14px rgba(11,37,69,.35)'
      }
      b.addEventListener('mouseenter', () => realcar(true))
      b.addEventListener('mouseleave', () => realcar(false))
      b.addEventListener('focus',      () => realcar(true))
      b.addEventListener('blur',       () => realcar(false))
      b.addEventListener('click', () => {
        browser.runtime.sendMessage({ tipo: 'triagem:abrir_pagina', id: String(idProcesso) })
      })
      document.body.appendChild(b)
    }

    async function avaliar(processo) {
      const minhaGeracao = ++geracao
      removerBotao()
      if (!processo?.id) return
      if (!(await root.PjeTools.consentimento.concedido())) return
      for (let i = 0; i < 10; i++) {
        const el = document.querySelector('.texto-tarefa-processo')
        if (minhaGeracao !== geracao) return
        if (el) {
          if (ehTarefaTriagem(el.textContent)) {
            criarBotao(processo.id)
            log('tarefa Triagem Inicial detectada — botão exibido')
          }
          return
        }
        await aguardar(500)
      }
    }

    document.addEventListener('pjetools:contexto', ev => { avaliar(ev.detail) })
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ehTarefaTriagem }
  }

})()
