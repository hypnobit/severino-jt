;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis

  if (typeof location !== 'undefined' && !location.href.includes('/eCarta-web/')) return

  // ── CONSTANTES ────────────────────────────────────────────────────────────

  const PADRAO_PROCESSO  = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g
  const MAX_CAMPOS       = 5
  const TAMANHO_PAGINA   = 20
  const MAX_PAGINAS      = 50
  const PAUSA_GRUPOS_MS  = 600
  const PAUSA_PAGINAS_MS = 300
  const TIMEOUT_SETUP_MS = 5000
  const aguardar         = ms => root.PjeTools.helpers.aguardar(ms)

  const estadoConsulta   = { cancelar: false }

  // ── LEITURA DO DOM ────────────────────────────────────────────────────────

  const obterCampos    = () => [...document.querySelectorAll('input.ui-inputmask[type="text"]')]
  const obterViewState = () => {
    const el = document.querySelector('input[name="javax.faces.ViewState"]')
    if (!el?.value) throw new Error('ViewState não encontrado. Recarregue o E-Carta.')
    return el.value
  }

  async function prepararCampos(qtdNecessaria) {
    const alvo = Math.min(qtdNecessaria, MAX_CAMPOS)
    while (obterCampos().length < alvo) {
      const antes = obterCampos().length
      const bt = document.getElementById('main:j_idt67') ??
        [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Adicionar')
      if (!bt) break
      bt.click()
      const t0 = Date.now()
      while (obterCampos().length === antes && Date.now() - t0 < TIMEOUT_SETUP_MS) await aguardar(200)
      if (obterCampos().length === antes) break
    }
    return obterCampos().map(c => c.name)
  }

  // ── PARSER: XML → dados ───────────────────────────────────────────────────

  function parsearRespostaJSF(xmlTexto) {
    if (xmlTexto.includes('Confirme o Usuário') || xmlTexto.includes('loginForm'))
      throw new Error('Sessão do E-Carta expirada. Faça login novamente.')

    const doc       = new DOMParser().parseFromString(xmlTexto, 'application/xml')
    const getUpdate = id => [...doc.querySelectorAll('update')]
      .find(n => n.getAttribute('id') === id)?.textContent ?? ''

    const novoViewState = getUpdate('javax.faces.ViewState').trim()
    const htmlTabela    = getUpdate('main:tabDoc')
    // DOMParser('text/html') é inerte: não roda script nem carrega `<img onerror>` (≠ innerHTML).
    const docTabela     = new DOMParser().parseFromString(htmlTabela, 'text/html')

    const linhas = [...docTabela.querySelectorAll('tbody tr')]
      .filter(tr => tr.querySelectorAll('td').length >= 6 && !tr.classList.contains('ui-datatable-empty-message'))
      .map(tr => {
        const td  = tr.querySelectorAll('td')
        const txt = el => el?.textContent.trim() ?? ''
        return {
          dataEnvio: txt(td[0]), dataEntrega: txt(td[1]), processo: txt(td[2]),
          idPje: txt(td[3]), objeto: txt(td[4]), status: txt(td[5]), destinatario: txt(td[6])
        }
      })
      .filter(r => r.processo)

    return { novoViewState, linhas, temMaisUmaPagina: linhas.length >= TAMANHO_PAGINA }
  }

  // ── FETCH ─────────────────────────────────────────────────────────────────

  async function buscarPagina1(processos, nomesDoCampos, viewState) {
    const body = new URLSearchParams()
    body.append('javax.faces.partial.ajax',    'true')
    body.append('javax.faces.source',          'main:pesquisar')
    body.append('javax.faces.partial.execute', '@all')
    body.append('javax.faces.partial.render',  'main:tabDoc')
    body.append('main:pesquisar',              'main:pesquisar')
    body.append('main',                        'main')
    nomesDoCampos.forEach((nome, i) => body.append(nome, processos[i] ?? ''))
    body.append('javax.faces.ViewState', viewState)

    const resp = await fetch(location.href, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Faces-Request': 'partial/ajax', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString()
    })
    if (!resp.ok) throw new Error(`Servidor retornou HTTP ${resp.status}.`)
    return parsearRespostaJSF(await resp.text())
  }

  async function buscarPaginaSeguinte(processos, nomesDoCampos, viewState, first) {
    const body = new URLSearchParams()
    body.append('javax.faces.partial.ajax',    'true')
    body.append('javax.faces.source',          'main:tabDoc')
    body.append('javax.faces.partial.execute', 'main:tabDoc')
    body.append('javax.faces.partial.render',  'main:tabDoc')
    body.append('javax.faces.behavior.event',  'page')
    body.append('javax.faces.partial.event',   'page')
    body.append('main:tabDoc_pagination',      'true')
    body.append('main:tabDoc_first',           String(first))
    body.append('main:tabDoc_rows',            String(TAMANHO_PAGINA))
    body.append('main:tabDoc_skipChildren',    'true')
    body.append('main:tabDoc_encodeFeature',   'true')
    body.append('main',                        'main')
    nomesDoCampos.forEach((nome, i) => body.append(nome, processos[i] ?? ''))
    body.append('javax.faces.ViewState', viewState)

    const resp = await fetch(location.href, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Faces-Request': 'partial/ajax', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString()
    })
    if (!resp.ok) throw new Error(`Paginação retornou HTTP ${resp.status}.`)
    return parsearRespostaJSF(await resp.text())
  }

  // ── FLUXO PRINCIPAL ───────────────────────────────────────────────────────

  async function consultarGrupoCompleto(processos, nomesDoCampos, viewState, onProgresso, label) {
    onProgresso(`${label} — página 1...`)
    const pag1 = await buscarPagina1(processos, nomesDoCampos, viewState)

    const todasLinhas    = [...pag1.linhas]
    let   viewStateAtual = pag1.novoViewState || viewState
    let   paginasExtra   = 0

    if (pag1.temMaisUmaPagina) {
      let first = TAMANHO_PAGINA, pagNum = 2
      while (pagNum <= MAX_PAGINAS) {
        if (estadoConsulta.cancelar) break
        onProgresso(`${label} — página ${pagNum}...`)
        await aguardar(PAUSA_PAGINAS_MS)
        const pag = await buscarPaginaSeguinte(processos, nomesDoCampos, viewStateAtual, first)
        todasLinhas.push(...pag.linhas)
        if (pag.novoViewState) viewStateAtual = pag.novoViewState
        paginasExtra++
        if (pag.linhas.length < TAMANHO_PAGINA) break
        first += TAMANHO_PAGINA; pagNum++
      }
    }

    return { linhas: todasLinhas, novoViewState: viewStateAtual, paginasExtra }
  }

  async function executarConsulta(processos, onProgresso) {
    estadoConsulta.cancelar = false
    onProgresso('⚙️ Preparando campos...')
    const nomesDoCampos = await prepararCampos(Math.min(processos.length, MAX_CAMPOS))
    if (!nomesDoCampos.length) throw new Error('Campos não encontrados. Recarregue o E-Carta.')

    let viewState      = obterViewState()
    const tamGrupo     = nomesDoCampos.length
    const grupos       = []
    for (let i = 0; i < processos.length; i += tamGrupo) grupos.push(processos.slice(i, i + tamGrupo))

    const todos = []; let totalPagExtra = 0; const consultados = []
    for (const [idx, grupo] of grupos.entries()) {
      if (estadoConsulta.cancelar) break
      const label = `⏳ Grupo ${idx + 1}/${grupos.length} (${todos.length} objeto(s) coletado(s))`
      const { linhas, novoViewState, paginasExtra } =
        await consultarGrupoCompleto(grupo, nomesDoCampos, viewState, onProgresso, label)
      todos.push(...linhas)
      consultados.push(...grupo)
      if (novoViewState) viewState = novoViewState
      totalPagExtra += paginasExtra
      if (idx < grupos.length - 1) await aguardar(PAUSA_GRUPOS_MS)
    }

    return { resultados: todos, totalPagExtra, cancelado: estadoConsulta.cancelar, consultados }
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  const csvLinha = campos => root.PjeTools.csv.linha(campos)

  function gerarConteudoCSV(resultados, semResultado) {
    const cab = csvLinha(['Processo','ID PJe','Objeto (AR)','Status','Destinatário','Data Envio','Data Entrega'])
    const lin = resultados.map(r => csvLinha([r.processo, r.idPje, r.objeto, r.status, r.destinatario, r.dataEnvio, r.dataEntrega]))
    semResultado.forEach(p => lin.push(csvLinha([p, '', '', 'Sem objeto encontrado', '', '', ''])))
    return [cab, ...lin].join('\r\n')
  }

  function baixarCSV(conteudo, nome) {
    const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8;' })
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nome })
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(a.href)
  }

  function nomeArquivoComData() {
    const p = n => String(n).padStart(2, '0'), d = new Date()
    return `ecarta-lote-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`
  }

  // ── PAINEL DE ENTRADA ─────────────────────────────────────────────────────

  const extrairProcessos = txt => [...new Set(txt.match(PADRAO_PROCESSO) ?? [])]

  async function criarPainelEntrada() {
    if (!(await root.PjeTools.consentimento.concedido())) return
    if (!document.getElementById('main:pesquisar')) {
      console.warn('[PJeTools E-Carta] Navegue até "Consultar Processos" e tente novamente.')
      return
    }
    document.getElementById('_ecl_root')?.remove()

    const overlay = document.createElement('div')
    overlay.id = '_ecl_root'
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif'

    const painel = document.createElement('div')
    painel.style.cssText = 'background:#fff;color:#1c2430;border-radius:8px;padding:22px;width:580px;max-width:94vw;box-shadow:0 8px 32px rgba(0,0,0,.35);border:1px solid #d9dde3'
    painel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <b style="color:#0b2545;font-size:15px">📮 E-Carta — Consulta em Lote</b>
        <button id="_ecl_x" style="background:none;border:none;color:#5b6472;font-size:20px;cursor:pointer">✕</button>
      </div>
      <p style="margin:0 0 10px;font-size:12px;color:#5b6472;line-height:1.6">
        Cole os números dos processos abaixo (um por linha).<br>
        As consultas são feitas em segundo plano — a tela não muda.<br>
        Paginação capturada automaticamente.<br>
        <span style="color:#8a5a00">⚠ Certifique-se de estar logado no E-Carta.</span>
      </p>
      <textarea id="_ecl_lista" style="width:100%;height:160px;background:#fff;color:#1c2430;border:1px solid #d9dde3;border-radius:4px;padding:8px;font-family:monospace;font-size:12px;box-sizing:border-box;resize:vertical" placeholder="0000311-94.2026.5.08.0207&#10;0000313-64.2026.5.08.0207&#10;..."></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span id="_ecl_contador" style="font-size:11px;color:#5b6472">0 processo(s)</span>
        <div style="display:flex;gap:8px">
          <button id="_ecl_cancelar" style="padding:7px 14px;background:#fff;color:#13315c;border:1px solid #1d4e89;border-radius:4px;cursor:pointer;font-size:13px">Cancelar</button>
          <button id="_ecl_ok" style="padding:7px 18px;background:#1d4e89;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold">▶ Consultar</button>
        </div>
      </div>
      <div id="_ecl_prog" style="display:none;margin-top:12px;font-size:12px;color:#5b6472;background:#f4f5f7;border-radius:4px;padding:8px;line-height:1.6"></div>
      <div id="_ecl_erro" style="display:none;margin-top:12px;font-size:12px;color:#a32626;background:#fbeaea;border-radius:4px;padding:8px"></div>`

    overlay.appendChild(painel)
    document.body.appendChild(overlay)

    const fechar = () => overlay.remove()
    document.getElementById('_ecl_x').onclick        = fechar
    document.getElementById('_ecl_cancelar').onclick = fechar
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar() })

    document.getElementById('_ecl_lista').addEventListener('input', () => {
      const n = extrairProcessos(document.getElementById('_ecl_lista').value).length
      document.getElementById('_ecl_contador').textContent = `${n} processo(s) identificado(s)`
      document.getElementById('_ecl_erro').style.display = 'none'
    })

    document.getElementById('_ecl_ok').onclick = async () => {
      const processos = extrairProcessos(document.getElementById('_ecl_lista').value)
      if (!processos.length) {
        const erro = document.getElementById('_ecl_erro')
        erro.style.display = 'block'
        erro.textContent   = '⚠ Nenhum número de processo válido. Formato: 0000311-94.2026.5.08.0207'
        return
      }

      ;['_ecl_lista','_ecl_contador','_ecl_ok'].forEach(id => { document.getElementById(id).style.display = 'none' })
      painel.querySelector('p').style.display     = 'none'
      painel.querySelector('div > b').textContent = '📮 E-Carta em Lote...'
      document.getElementById('_ecl_x').style.display   = 'none'

      const btnCancelar = document.getElementById('_ecl_cancelar')
      btnCancelar.textContent   = '⛔ Cancelar consulta'
      btnCancelar.style.cssText += ';color:#a32626;border-color:#a32626'
      btnCancelar.onclick = () => {
        estadoConsulta.cancelar = true
        btnCancelar.textContent = 'Cancelando…'
        btnCancelar.disabled    = true
      }

      overlay.style.cssText += ';background:rgba(0,0,0,.15);pointer-events:none;display:block'
      painel.style.cssText += ';position:fixed;bottom:16px;right:16px;width:340px;pointer-events:all'
      document.getElementById('_ecl_prog').style.display = 'block'

      try {
        const { resultados, totalPagExtra, cancelado, consultados } = await executarConsulta(processos, msg => {
          document.getElementById('_ecl_prog').innerHTML = msg
        })
        overlay.remove()
        exibirRelatorio(resultados, cancelado ? consultados : processos, totalPagExtra, cancelado)
      } catch (e) {
        console.error('[PJeTools E-Carta]', e)
        document.getElementById('_ecl_erro').style.display = 'block'
        document.getElementById('_ecl_erro').textContent   = '❌ ' + e.message
        document.getElementById('_ecl_prog').style.display = 'none'
      }
    }

    setTimeout(() => document.getElementById('_ecl_lista')?.focus(), 80)
  }

  // ── RELATÓRIO ─────────────────────────────────────────────────────────────

  const corStatus = s => {
    const sl = (s ?? '').toLowerCase()
    if (sl.includes('entregue'))                              return '#e9f5ee'
    if (sl.includes('devolvido') || sl.includes('destruído')) return '#fdf2dd'
    if (sl.includes('postado')   || sl.includes('enviado'))   return '#e7eef7'
    if (sl.includes('rejeitado'))                             return '#efe6f5'
    return '#f4f5f7'
  }

  // Dado do servidor vai a innerHTML → passa por escapar. corStatus devolve hex de whitelist (não escapa).
  function montarLinhaObjeto(r, proc, primeira) {
    const esc = root.PjeTools.helpers.escapar
    return `
        <tr style="border-bottom:1px solid #d9dde3">
          <td style="padding:5px 8px;font-size:11px;color:#5b6472;white-space:nowrap;font-family:monospace;vertical-align:top">${primeira ? esc(proc) : ''}</td>
          <td style="padding:5px 8px;font-size:12px;color:#1d4e89;font-family:monospace;white-space:nowrap">${esc(r.idPje) || '—'}</td>
          <td style="padding:5px 8px;font-size:12px;color:#1c2430;font-family:monospace;white-space:nowrap">${esc(r.objeto) || '—'}</td>
          <td style="padding:5px 8px;font-size:12px;color:#1c2430;white-space:nowrap;background:${corStatus(r.status)}">${esc(r.status) || '—'}</td>
          <td style="padding:5px 8px;font-size:11px;color:#5b6472;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.destinatario)}">${esc(r.destinatario) || '—'}</td>
          <td style="padding:5px 8px;font-size:11px;color:#5b6472;white-space:nowrap">${esc(r.dataEnvio) || '—'}</td>
          <td style="padding:5px 8px;font-size:11px;color:#5b6472;white-space:nowrap">${esc(r.dataEntrega) || '—'}</td>
        </tr>`
  }

  function montarLinhaSemResultado(proc) {
    const esc = root.PjeTools.helpers.escapar
    return `
      <tr style="border-bottom:1px solid #d9dde3;background:#fbeaea">
        <td colspan="7" style="padding:6px 8px;font-size:11px;color:#5b6472;font-family:monospace">
          ${esc(proc)} <span style="color:#8a94a0;font-style:italic;margin-left:8px">— nenhum objeto nesta consulta</span>
        </td>
      </tr>`
  }

  function exibirRelatorio(resultados, processosConsultados, totalPagExtra, cancelado) {
    const porProcesso  = {}
    resultados.forEach(r => (porProcesso[r.processo] ??= []).push(r))
    const semResultado = processosConsultados.filter(p => !(p in porProcesso))

    const linhas = Object.entries(porProcesso).flatMap(([proc, itens]) =>
      itens.map((r, i) => montarLinhaObjeto(r, proc, i === 0))
    ).join('')

    const linhasSemResultado = semResultado.map(montarLinhaSemResultado).join('')

    const modal = document.createElement('div')
    modal.id = '_ecl_root'
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif'
    modal.innerHTML = `
      <div style="background:#fff;color:#1c2430;border-radius:8px;padding:22px;width:min(96vw,1100px);box-shadow:0 8px 32px rgba(0,0,0,.35);border:1px solid #d9dde3;display:flex;flex-direction:column;max-height:92vh">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-shrink:0">
          <div>
            <b style="color:#0b2545;font-size:15px">📮 Relatório E-Carta em Lote</b>
            <div style="font-size:12px;color:#5b6472;margin-top:4px">
              ${resultados.length} objeto(s) em ${processosConsultados.length} processo(s)
              ${totalPagExtra > 0 ? `<br><span style="color:#1f7a4d;font-size:11px">✓ ${totalPagExtra} página(s) adicional(is) capturada(s) automaticamente.</span>` : ''}
              ${cancelado ? `<br><span style="color:#a32626;font-size:11px">⚠ Consulta cancelada — mostrando só os processos consultados até o cancelamento.</span>` : ''}
            </div>
          </div>
          <button id="_ecl_r_x" style="background:none;border:none;color:#5b6472;font-size:20px;cursor:pointer;flex-shrink:0;margin-left:12px">✕</button>
        </div>
        <div style="overflow:auto;flex:1;min-height:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#e7eef7;color:#13315c;position:sticky;top:0;z-index:1">
                <th style="padding:8px;text-align:left;font-size:12px;white-space:nowrap">Processo</th>
                <th style="padding:8px;text-align:left;font-size:12px">ID PJe</th>
                <th style="padding:8px;text-align:left;font-size:12px">Objeto (AR)</th>
                <th style="padding:8px;text-align:left;font-size:12px">Status</th>
                <th style="padding:8px;text-align:left;font-size:12px">Destinatário</th>
                <th style="padding:8px;text-align:left;font-size:12px;white-space:nowrap">Envio</th>
                <th style="padding:8px;text-align:left;font-size:12px;white-space:nowrap">Entrega</th>
              </tr>
            </thead>
            <tbody style="background:#fff">${linhas}${linhasSemResultado}</tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-shrink:0">
          <button id="_ecl_r_csv" style="padding:7px 16px;background:#1f7a4d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">📄 Extrair Tabela (.csv)</button>
          <button id="_ecl_r_fechar" style="padding:7px 14px;background:#fff;color:#13315c;border:1px solid #1d4e89;border-radius:4px;cursor:pointer;font-size:13px">✕ Fechar</button>
        </div>
      </div>`

    document.body.appendChild(modal)

    const fechar = () => modal.remove()
    document.getElementById('_ecl_r_x').onclick      = fechar
    document.getElementById('_ecl_r_fechar').onclick = fechar
    modal.addEventListener('click', e => { if (e.target === modal) fechar() })

    document.getElementById('_ecl_r_csv').onclick = () => {
      baixarCSV(gerarConteudoCSV(resultados, semResultado), nomeArquivoComData())
      const bt = document.getElementById('_ecl_r_csv')
      bt.textContent = '✓ Baixado'; bt.style.background = '#2e7d32'
      setTimeout(() => { bt.textContent = '📄 Extrair Tabela (.csv)'; bt.style.background = '#1f7a4d' }, 2500)
    }
  }

  // ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────

  if (typeof browser !== 'undefined') {
    browser.runtime.onMessage.addListener(msg => {
      if (msg.tipo === 'ecarta:executar_consulta') criarPainelEntrada()
    })
  }

  if (typeof document !== 'undefined' && typeof browser !== 'undefined' &&
      location.pathname.endsWith('/eCarta-web/consultarProcesso.xhtml')) {
    root.PjeTools.consentimento.concedido().then(ok => {
    if (!ok) return
    const atalho = document.createElement('button')
    atalho.id = '_ecl_atalho'
    atalho.type = 'button'
    atalho.textContent = '📮 E-Carta em lote'
    atalho.title = 'Severino JT — consulta vários processos no E-Carta de uma vez'
    atalho.style.cssText =
      'position:fixed;right:18px;bottom:18px;z-index:2147483646;' +
      'padding:10px 16px;background:#1d4e89;color:#fff;border:none;border-radius:999px;' +
      'font:600 13px "Segoe UI","Helvetica Neue",Arial,sans-serif;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(11,37,69,.35);' +
      'transition:background .15s,transform .15s,box-shadow .15s'
    // hover via listeners — <style> injetado esbarraria no CSP da página.
    const realcar = ligado => {
      atalho.style.background = ligado ? '#13315c' : '#1d4e89'
      atalho.style.transform  = ligado ? 'translateY(-1px)' : 'none'
      atalho.style.boxShadow  = ligado ? '0 6px 18px rgba(11,37,69,.45)' : '0 4px 14px rgba(11,37,69,.35)'
    }
    atalho.addEventListener('mouseenter', () => realcar(true))
    atalho.addEventListener('mouseleave', () => realcar(false))
    atalho.addEventListener('focus',      () => realcar(true))
    atalho.addEventListener('blur',       () => realcar(false))
    atalho.addEventListener('click', criarPainelEntrada)
    document.body.appendChild(atalho)
    })
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { montarLinhaObjeto, montarLinhaSemResultado, corStatus }
  }

})()
