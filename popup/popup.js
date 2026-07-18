'use strict'

const CHAVE_TEMA = 'pjt_tema'

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('versao').textContent =
    `v${browser.runtime.getManifest().version} · alpha`

  if (!(await window.PjeTools.consentimento.concedido())) {
    mostrarPendente()
    return
  }

  const r = await browser.storage.local.get(CHAVE_TEMA)
  document.getElementById('sel-tema').value = r[CHAVE_TEMA] || ''

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  aplicarContexto(tab?.url || '')

  vincularEventos()
})

// Sem inline onclick — CSP do popup; tudo via listener.
function mostrarPendente() {
  document.querySelectorAll('section').forEach(s => { s.hidden = true })

  const secao = document.createElement('section')
  const aviso = document.createElement('p')
  aviso.className   = 'aviso'
  aviso.textContent = 'Aceite os termos de uso para ativar a extensão.'
  const botao = document.createElement('button')
  botao.textContent = '⚖️ Abrir termo de consentimento'
  botao.addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('pages/consentimento.html') })
    window.close()
  })
  secao.appendChild(aviso)
  secao.appendChild(botao)
  document.querySelector('header').after(secao)
}

function aplicarContexto(url) {
  const idProcesso = (url.match(/\/processo\/(\d+)\//) || [])[1]
  const naEcarta   = url.includes('/eCarta-web/')

  document.getElementById('btn-triagem').disabled  = !idProcesso
  document.getElementById('aviso-triagem').hidden  = !!idProcesso

  document.getElementById('btn-ecarta').disabled   = !naEcarta
  document.getElementById('aviso-ecarta').hidden   = naEcarta
}

function vincularEventos() {

  document.getElementById('btn-triagem').addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    const m = (tab.url || '').match(/\/processo\/(\d+)\//)
    if (!m) { document.getElementById('aviso-triagem').hidden = false; return }
    browser.tabs.create({ url: browser.runtime.getURL(`pages/triagem.html?id=${m[1]}`) })
    window.close()
  })

  document.getElementById('btn-ecarta').addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    browser.tabs.sendMessage(tab.id, { tipo: 'ecarta:executar_consulta' })
      .catch(() => {})
    window.close()
  })

  document.getElementById('btn-extrator').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('pages/extrator.html') })
  })

  document.getElementById('btn-historico').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('pages/relatorio.html') })
  })

  document.getElementById('sel-tema').addEventListener('change', async e => {
    const chave = e.target.value
    if (chave) {
      await browser.storage.local.set({ [CHAVE_TEMA]: chave })
    } else {
      await browser.storage.local.remove(CHAVE_TEMA)
    }
  })

}
