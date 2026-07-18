'use strict'

const TAREFA_ASSINADOR = 'cnj.assinadorBase64'
const LOG              = '[PJeTools BG]'

const ultimasAssinaturas = {}

browser.webRequest.onBeforeRequest.addListener(
  detalhes => {
    try { processarRequisicao(detalhes) }
    catch (e) { console.error(LOG, e) }
  },
  { urls: ['*://localhost/*', '*://127.0.0.1/*'] }
)

browser.runtime.onInstalled.addListener(async detalhes => {
  if (detalhes.reason === 'install' ||
      (detalhes.reason === 'update' && !(await window.PjeTools.consentimento.concedido()))) {
    browser.tabs.create({ url: browser.runtime.getURL('pages/consentimento.html') })
  }
})

browser.runtime.onMessage.addListener(async msg => {
  if (msg?.tipo === 'triagem:abrir_pagina' && /^\d+$/.test(String(msg.id))) {
    if (!(await window.PjeTools.consentimento.concedido())) {
      browser.tabs.create({ url: browser.runtime.getURL('pages/consentimento.html') })
      return
    }
    browser.tabs.create({ url: browser.runtime.getURL(`pages/triagem.html?id=${msg.id}`) })
  }
})

function processarRequisicao(detalhes) {
  const match = (detalhes.url || '').match(/[?&]r=([^&]+)/)
  if (!match) return

  let p
  try { p = JSON.parse(decodeURIComponent(match[1])) }
  catch { return }

  if (p.tarefaId !== TAREFA_ASSINADOR) return

  // PJeOffice dispara a mesma requisição 2× por assinatura → debounce por aba.
  const agora = Date.now()
  if ((agora - (ultimasAssinaturas[detalhes.tabId] || 0)) < 5000) return
  ultimasAssinaturas[detalhes.tabId] = agora

  console.log(LOG, 'Assinatura detectada na aba', detalhes.tabId)

  browser.tabs.sendMessage(detalhes.tabId, { tipo: 'historico:assinatura_detectada' })
    .catch(e => console.log(LOG, 'Aba encerrada:', e.message))
}
