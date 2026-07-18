;(function () {
  'use strict'

  const { extrairResumo, gerarCsv, gerarMarkdownCompleto, TABELAS_INFO, NOMES_AMIGAVEIS } =
    window.PjeTools.resumoCalculo

  window.PjeTools.consentimento.concedido().then(ok => {
    if (!ok) location.replace('consentimento.html')
  })

  // ── Inicialização do worker ───────────────────────────────────────────────

  let inicializacaoOk    = true
  let erroInicializacao  = null
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('lib/vendor/pdf.worker.js')
  } catch (e) {
    inicializacaoOk   = false
    erroInicializacao = e
  }

  // ── Download ──────────────────────────────────────────────────────────────

  function baixarBlob(conteudo, nomeArquivo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  function feedbackBaixado(el) {
    const original = el.textContent
    el.textContent = '✓ Baixado'
    setTimeout(() => { el.textContent = original }, 2500)
  }

  // ── Renderização ──────────────────────────────────────────────────────────

  function criarTabelaPrevia(cabecalho, linhas) {
    const tabela = document.createElement('table')
    tabela.className = 'previa'

    const thead = document.createElement('thead')
    const trh   = document.createElement('tr')
    cabecalho.forEach(c => {
      const th = document.createElement('th')
      th.textContent = c
      trh.appendChild(th)
    })
    thead.appendChild(trh)
    tabela.appendChild(thead)

    const tbody = document.createElement('tbody')
    const visiveis = linhas.slice(0, 8)
    visiveis.forEach(linha => {
      const tr = document.createElement('tr')
      linha.forEach((valor, idx) => {
        const td = document.createElement('td')
        td.textContent = valor
        if (idx > 0) td.className = 'num'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    tabela.appendChild(tbody)

    const wrapper = document.createElement('div')
    wrapper.appendChild(tabela)

    if (linhas.length > visiveis.length) {
      const aviso = document.createElement('div')
      aviso.style.fontSize = '12px'
      aviso.style.color    = 'var(--texto-suave)'
      aviso.textContent    = `… mostrando 8 de ${linhas.length} linhas. O CSV baixado contém todas.`
      wrapper.appendChild(aviso)
    }
    return wrapper
  }

  function renderizarResultado(nomeArquivo, resultado, erro) {
    const container = document.createElement('div')
    container.className = 'resultado'

    const cabecalho = document.createElement('div')
    cabecalho.className = 'resultado-cabecalho'

    const titulo = document.createElement('strong')
    titulo.textContent = resultado?.numeroCalculo ? `Cálculo ${resultado.numeroCalculo}` : nomeArquivo
    cabecalho.appendChild(titulo)

    const direita = document.createElement('div')
    direita.style.display    = 'flex'
    direita.style.alignItems = 'center'
    direita.style.gap        = '8px'

    const baseNome = resultado?.numeroCalculo
      ? `calculo_${resultado.numeroCalculo}`
      : nomeArquivo.replace(/\.pdf$/i, '')

    if (!erro) {
      const btnMd = document.createElement('button')
      btnMd.className   = 'botao-cabecalho'
      btnMd.textContent = 'Baixar Markdown (.md)'
      btnMd.addEventListener('click', () => {
        baixarBlob(gerarMarkdownCompleto(resultado), `${baseNome}_resumo_calculo.md`, 'text/markdown;charset=utf-8')
        feedbackBaixado(btnMd)
      })
      direita.appendChild(btnMd)
    }

    const selo = document.createElement('span')
    if (erro) {
      selo.className   = 'selo-estado selo-erro'
      selo.textContent = 'Erro'
    } else {
      const vazia = TABELAS_INFO.some(t => resultado.tabelas[t.chave].length === 0)
      selo.className   = vazia ? 'selo-estado selo-aviso' : 'selo-estado selo-ok'
      selo.textContent = vazia ? 'Verificar' : 'OK'
    }
    direita.appendChild(selo)
    cabecalho.appendChild(direita)
    container.appendChild(cabecalho)

    const corpo = document.createElement('div')
    corpo.className = 'resultado-corpo'

    if (erro) {
      const p = document.createElement('div')
      p.className   = 'erro-texto'
      p.textContent = `${nomeArquivo}: ${erro.message}`
      corpo.appendChild(p)
      container.appendChild(corpo)
      return container
    }

    TABELAS_INFO.forEach(info => {
      const linhas = resultado.tabelas[info.chave]
      const bloco  = document.createElement('div')
      bloco.className = 'tabela-bloco'

      const h3 = document.createElement('h3')
      h3.textContent = NOMES_AMIGAVEIS[info.chave]
      bloco.appendChild(h3)

      if (linhas.length === 0) {
        const aviso = document.createElement('div')
        aviso.className   = 'aviso-texto'
        aviso.textContent = 'Tabela não encontrada ou vazia neste PDF.'
        bloco.appendChild(aviso)
      } else {
        bloco.appendChild(criarTabelaPrevia(info.cabecalho, linhas))
      }

      const link = document.createElement('a')
      link.href        = '#'
      link.className   = 'baixar-link'
      link.textContent = `Baixar CSV (${linhas.length} linha${linhas.length === 1 ? '' : 's'})`
      link.addEventListener('click', e => {
        e.preventDefault()
        baixarBlob(gerarCsv(info.cabecalho, linhas), `${baseNome}_${info.sufixo}.csv`, 'text/csv;charset=utf-8')
        feedbackBaixado(link)
      })
      bloco.appendChild(link)

      corpo.appendChild(bloco)
    })

    container.appendChild(corpo)
    return container
  }

  // ── Ligações de interface ─────────────────────────────────────────────────

  const inputArquivo  = document.getElementById('inputArquivo')
  const btnEscolher   = document.getElementById('btnEscolher')
  const btnProcessar  = document.getElementById('btnProcessar')
  const btnLimpar     = document.getElementById('btnLimpar')
  const zonaArquivo   = document.getElementById('zonaArquivo')
  const listaArquivos = document.getElementById('listaArquivos')
  const resultadosEl  = document.getElementById('resultados')

  let arquivosSelecionados = []

  if (!inicializacaoOk) {
    document.getElementById('bannerDiagnostico').classList.add('mostrar')
    document.getElementById('detalheErroDiagnostico').textContent = String(erroInicializacao?.message ?? erroInicializacao ?? '')
    btnProcessar.disabled = true
    btnProcessar.title    = 'Motor de leitura de PDF não inicializado neste navegador.'
  }

  const ehPdf = f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')

  function atualizarListaArquivos() {
    listaArquivos.textContent = ''
    arquivosSelecionados.forEach(f => {
      const div = document.createElement('div')
      div.textContent = `• ${f.name}`
      listaArquivos.appendChild(div)
    })
    btnProcessar.disabled = !inicializacaoOk || arquivosSelecionados.length === 0
  }

  btnEscolher.addEventListener('click', () => inputArquivo.click())

  inputArquivo.addEventListener('change', () => {
    arquivosSelecionados = [...inputArquivo.files].filter(ehPdf)
    atualizarListaArquivos()
  })

  ;['dragenter', 'dragover'].forEach(evt =>
    zonaArquivo.addEventListener(evt, e => { e.preventDefault(); zonaArquivo.classList.add('arrastando') })
  )
  ;['dragleave', 'drop'].forEach(evt =>
    zonaArquivo.addEventListener(evt, e => { e.preventDefault(); zonaArquivo.classList.remove('arrastando') })
  )

  zonaArquivo.addEventListener('drop', e => {
    arquivosSelecionados = [...e.dataTransfer.files].filter(ehPdf)
    atualizarListaArquivos()
  })

  btnLimpar.addEventListener('click', () => {
    arquivosSelecionados = []
    inputArquivo.value = ''
    atualizarListaArquivos()
    resultadosEl.textContent = ''
  })

  btnProcessar.addEventListener('click', async () => {
    btnProcessar.disabled  = true
    resultadosEl.textContent = ''

    const total = arquivosSelecionados.length
    for (const [i, arquivo] of arquivosSelecionados.entries()) {
      btnProcessar.textContent = total > 1 ? `Processando ${i + 1}/${total}…` : 'Processando…'
      try {
        const resultado = await extrairResumo(await arquivo.arrayBuffer())
        resultadosEl.appendChild(renderizarResultado(arquivo.name, resultado, null))
      } catch (erro) {
        console.error('[PJeTools Extrator]', erro)
        resultadosEl.appendChild(renderizarResultado(arquivo.name, null, erro))
      }
    }

    btnProcessar.textContent = 'Processar'
    btnProcessar.disabled    = !inicializacaoOk || arquivosSelecionados.length === 0
  })

})()
