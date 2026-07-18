'use strict'

const CHAVE_STORAGE = 'pjt_historico'
let dadosAtuais = { data: '', consultas: [], assinaturas: [] }

// ── Inicialização ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await window.PjeTools.consentimento.concedido())) {
    location.replace('consentimento.html'); return
  }
  document.getElementById('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  })
  await carregarDados()
  vincularEventos()
})

async function carregarDados() {
  const resultado = await browser.storage.local.get(CHAVE_STORAGE)
  const historico = resultado[CHAVE_STORAGE]
  const hoje      = new Date().toISOString().slice(0, 10)
  dadosAtuais     = (historico && historico.data === hoje)
    ? historico
    : { data: hoje, consultas: [], assinaturas: [] }
  renderizarConsultas()
  renderizarAssinaturas()
}

// ── Vínculos de eventos ───────────────────────────────────────────────────

function vincularEventos() {
  document.getElementById('btn-aba-consultas').addEventListener('click',   () => trocarAba('consultas'))
  document.getElementById('btn-aba-assinaturas').addEventListener('click', () => trocarAba('assinaturas'))

  document.getElementById('copiar-consultas').addEventListener('click',    () => copiar('consultas'))
  document.getElementById('exportar-consultas').addEventListener('click',  () => exportar('consultas'))
  document.getElementById('btn-limpar-c').addEventListener('click',        () => limpar('consultas'))

  document.getElementById('copiar-assinaturas').addEventListener('click',  () => copiar('assinaturas'))
  document.getElementById('exportar-assinaturas').addEventListener('click',() => exportar('assinaturas'))
  document.getElementById('btn-limpar-a').addEventListener('click',        () => limpar('assinaturas'))
}

// ── Navegação por abas ────────────────────────────────────────────────────

function trocarAba(nome) {
  document.querySelectorAll('.aba').forEach(a => a.classList.remove('visivel'))
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('ativa'))
  document.getElementById('aba-' + nome).classList.add('visivel')
  document.getElementById('btn-aba-' + nome).classList.add('ativa')
}

// ── Renderização ──────────────────────────────────────────────────────────

function renderizarConsultas() {
  const consultas = dadosAtuais.consultas || []
  const tbody     = document.getElementById('tabela-consultas')

  document.getElementById('total-consultas').textContent = consultas.length
  document.getElementById('total-unicos').textContent    = new Set(consultas.map(c => c.identificador)).size

  tbody.innerHTML = consultas.length === 0
    ? `<tr><td colspan="3" class="vazio"><span>🔍</span>Nenhum processo registrado hoje</td></tr>`
    : consultas.map((c, i) => `
        <tr>
          <td style="color:var(--texto-suave);font-size:11px">${i + 1}</td>
          <td class="numero-processo">${escapar(c.identificador)}</td>
          <td class="hora">${escapar(c.timestamp)}</td>
        </tr>`).join('')
}

function renderizarAssinaturas() {
  const assinaturas = dadosAtuais.assinaturas || []
  const tbody       = document.getElementById('tabela-assinaturas')

  document.getElementById('total-assinaturas').textContent         = assinaturas.length
  document.getElementById('total-processos-assinados').textContent = new Set(assinaturas.map(a => a.identificador)).size

  tbody.innerHTML = assinaturas.length === 0
    ? `<tr><td colspan="4" class="vazio"><span>✍️</span>Nenhuma assinatura registrada hoje</td></tr>`
    : assinaturas.map((a, i) => `
        <tr>
          <td style="color:var(--texto-suave);font-size:11px">${i + 1}</td>
          <td class="numero-processo">${escapar(a.identificador)}</td>
          <td class="contexto">${escapar(a.contexto || '—')}</td>
          <td class="hora">${escapar(a.timestamp)}</td>
        </tr>`).join('')
}

// ── Ações ─────────────────────────────────────────────────────────────────

function copiar(tipo) {
  const texto = gerarTexto(tipo)
  navigator.clipboard.writeText(texto).then(() => {
    const btn      = document.getElementById('copiar-' + tipo)
    const original = btn.textContent
    btn.textContent = '✔ Copiado!'
    setTimeout(() => { btn.textContent = original }, 2000)
  })
}

function exportar(tipo) {
  const hoje = new Date().toISOString().slice(0, 10)
  const blob = new Blob([gerarTexto(tipo)], { type: 'text/plain;charset=utf-8' })
  const a    = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `historico-${tipo}-${hoje}.txt`
  })
  a.click()

  const btn      = document.getElementById('exportar-' + tipo)
  const original = btn.textContent
  btn.textContent = '✓ Baixado'
  setTimeout(() => { btn.textContent = original }, 2500)
}

async function limpar(tipo) {
  const rotulo = tipo === 'consultas' ? 'as consultas' : 'as assinaturas'
  if (!confirm(`Apagar ${rotulo} de hoje? A outra aba não é afetada.`)) return

  dadosAtuais[tipo] = []
  if (!dadosAtuais.consultas.length && !dadosAtuais.assinaturas.length) {
    await browser.storage.local.remove(CHAVE_STORAGE)
  } else {
    await browser.storage.local.set({ [CHAVE_STORAGE]: dadosAtuais })
  }
  renderizarConsultas()
  renderizarAssinaturas()
}

function gerarTexto(tipo) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const sep = '─'.repeat(50)

  if (tipo === 'consultas') {
    const lista = dadosAtuais.consultas || []
    if (!lista.length) return 'Nenhum processo consultado hoje.'
    return `PROCESSOS CONSULTADOS — ${hoje}\nTotal: ${lista.length} acessos\n${sep}\n` +
      lista.map((c, i) => `${String(i + 1).padStart(3, ' ')}. ${c.identificador}   ${c.timestamp}`).join('\n')
  }

  if (tipo === 'assinaturas') {
    const lista = dadosAtuais.assinaturas || []
    if (!lista.length) return 'Nenhum documento assinado hoje.'
    return `DOCUMENTOS ASSINADOS — ${hoje}\nTotal: ${lista.length} assinaturas\n${sep}\n` +
      lista.map((a, i) => `${String(i + 1).padStart(3, ' ')}. ${a.identificador}   [${a.contexto || '—'}]   ${a.timestamp}`).join('\n')
  }

  return ''
}

// ── Utilitários ───────────────────────────────────────────────────────────

function escapar(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
