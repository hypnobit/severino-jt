;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  // Depende do global `pdfjsLib`, carregado antes por lib/vendor/pdf.js.
  // Nenhuma dependência de DOM, storage ou rede — funções puras sobre o PDF.

  // ── Constantes de reconhecimento do layout do PJe-Calc ────────────────────

  const INICIO_SECAO    = 'Resumo do Cálculo'
  const FIM_SECAO       = 'Critério de Cálculo e Fundamentação Legal'
  const HEADER_BRUTO    = 'Descrição do Bruto Devido ao Reclamante'
  const HEADER_CREDITOS = 'Créditos e Descontos do Reclamante'
  const HEADER_DEBITOS  = 'Débitos do Reclamado por Credor'
  const TOLERANCIA_Y    = 3

  const MARCADORES_PAGINA = [
    'Processo:', 'Reclamante:', 'Reclamado:', 'Período do Cálculo:',
    'PLANILHA DE CÁLCULO', 'Pág. ', 'Cálculo liquidado por offline',
    'Documento assinado eletronicamente'
  ]

  const PALAVRAS_CABECALHO = new Set(['valor corrigido', 'juros', 'total', 'valor', 'descrição'])

  const TABELAS_INFO = [
    { chave: 'bruto',    sufixo: 'bruto_devido_reclamante',       cabecalho: ['Descrição', 'Valor Corrigido', 'Juros', 'Total'] },
    { chave: 'creditos', sufixo: 'creditos_descontos_reclamante', cabecalho: ['Descrição', 'Valor'] },
    { chave: 'debitos',  sufixo: 'debitos_reclamado_credor',      cabecalho: ['Descrição', 'Valor'] }
  ]

  const NOMES_AMIGAVEIS = {
    bruto:    'Descrição do Bruto Devido ao Reclamante',
    creditos: 'Descrição de Créditos e Descontos do Reclamante',
    debitos:  'Descrição de Débitos do Reclamado por Credor'
  }

  // ── Leitura posicional do PDF ─────────────────────────────────────────────

  function pareceLinhaCabecalho(itens) {
    const textos = itens.map(it => it.str.trim().toLowerCase()).filter(s => s !== '')
    if (textos.length === 0) return true
    return textos.every(t => PALAVRAS_CABECALHO.has(t))
  }

  function contemMarcadorDePagina(itens) {
    return itens.some(it => MARCADORES_PAGINA.some(m => it.str.includes(m)))
  }

  function textoDaLinha(linha) {
    return linha.itens.map(it => it.str).join(' ')
  }

  // Agrupa os fragmentos de texto em linhas visuais, por proximidade no eixo Y
  async function extrairLinhasPorPagina(doc, indicePagina) {
    const page    = await doc.getPage(indicePagina + 1)
    const content = await page.getTextContent()

    const itens = content.items
      .filter(it => it.str.trim() !== '')
      .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))

    itens.sort((a, b) => b.y - a.y || a.x - b.x)

    const linhas = []
    for (const it of itens) {
      const ultima = linhas[linhas.length - 1]
      if (ultima && Math.abs(ultima.y - it.y) <= TOLERANCIA_Y) {
        ultima.itens.push(it)
        ultima.y = (ultima.y + it.y) / 2
      } else {
        linhas.push({ y: it.y, itens: [it] })
      }
    }
    for (const linha of linhas) linha.itens.sort((a, b) => a.x - b.x)
    return linhas
  }

  // ── Extração das três tabelas do Resumo ───────────────────────────────────

  async function extrairResumo(arrayBuffer) {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

    let paginaInicio  = null
    let numeroCalculo = null
    const limiteBusca = Math.min(doc.numPages - 1, 5)

    for (let i = 0; i <= limiteBusca; i++) {
      const linhas      = await extrairLinhasPorPagina(doc, i)
      const textoPagina = linhas.map(textoDaLinha).join('\n')

      if (numeroCalculo === null) {
        const m = textoPagina.match(/Cálculo:\s*(\d+)/)
        if (m) numeroCalculo = m[1]
      }
      if (textoPagina.includes(INICIO_SECAO)) { paginaInicio = i; break }
    }

    if (paginaInicio === null) {
      throw new Error('Não foi encontrado o cabeçalho "Resumo do Cálculo". Verifique se este é mesmo um relatório (Planilha de Cálculo) do PJe-Calc.')
    }

    const tabelas = { bruto: [], creditos: [], debitos: [] }
    let estado    = 'antes'
    let splitX    = null
    const limitePaginas = Math.min(paginaInicio + 6, doc.numPages - 1)

    for (let p = paginaInicio; p <= limitePaginas; p++) {
      const linhas = await extrairLinhasPorPagina(doc, p)
      let parar = false

      for (const linha of linhas) {
        const texto = textoDaLinha(linha)

        if (texto.includes(FIM_SECAO)) { parar = true; break }
        if (contemMarcadorDePagina(linha.itens)) continue

        if (texto.includes(HEADER_BRUTO)) { estado = 'table1'; continue }

        // As tabelas 2 e 3 dividem a mesma linha: o meio entre a 2ª e a 3ª
        // coluna do cabeçalho define a fronteira horizontal.
        if (texto.includes(HEADER_CREDITOS) && texto.includes(HEADER_DEBITOS)) {
          estado = 'table23'
          const ordenado = [...linha.itens].sort((a, b) => a.x - b.x)
          splitX = (ordenado[1].x + ordenado[2].x) / 2
          continue
        }

        if (estado === 'table1') {
          if (linha.itens.length >= 2 && !pareceLinhaCabecalho(linha.itens)) {
            tabelas.bruto.push(linha.itens.map(it => it.str))
          }
        } else if (estado === 'table23' && splitX !== null) {
          const esquerda = linha.itens.filter(it => it.x <  splitX)
          const direita  = linha.itens.filter(it => it.x >= splitX)
          if (esquerda.length >= 2 && !pareceLinhaCabecalho(esquerda)) tabelas.creditos.push(esquerda.map(it => it.str))
          if (direita.length  >= 2 && !pareceLinhaCabecalho(direita))  tabelas.debitos.push(direita.map(it => it.str))
        }
      }
      if (parar) break
    }

    return { numeroCalculo, tabelas, totalPaginas: doc.numPages }
  }

  // ── Serialização ──────────────────────────────────────────────────────────

  // Escaping de célula (blindagem de fórmula CWE-1236) vive em lib/csv.js,
  // carregado antes deste arquivo pelo manifest/HTML.
  function gerarCsv(cabecalho, linhas) {
    const corpo = [cabecalho, ...linhas]
      .map(linha => root.PjeTools.csv.linha(linha))
      .join('\r\n')
    return '\uFEFF' + corpo + '\r\n'
  }

  function escapeMarkdownCell(valor) {
    return String(valor ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  }

  function gerarTabelaMarkdown(cabecalho, linhas) {
    const cab = '| ' + cabecalho.map(escapeMarkdownCell).join(' | ') + ' |'
    const sep = '| ' + cabecalho.map(() => '---').join(' | ') + ' |'
    const dados = linhas.map(l => '| ' + l.map(escapeMarkdownCell).join(' | ') + ' |')
    return [cab, sep, ...dados].join('\n')
  }

  // nivelTitulo permite embutir o resumo dentro de um documento maior (dossiê)
  function gerarMarkdownCompleto(resultado, nivelTitulo = 1) {
    const h1 = '#'.repeat(nivelTitulo)
    const h2 = '#'.repeat(nivelTitulo + 1)

    const partes = [
      resultado.numeroCalculo
        ? `${h1} Resumo do Cálculo nº ${resultado.numeroCalculo}`
        : `${h1} Resumo do Cálculo`,
      ''
    ]

    TABELAS_INFO.forEach(info => {
      const linhas = resultado.tabelas[info.chave]
      partes.push(`${h2} ${NOMES_AMIGAVEIS[info.chave]}`, '')
      partes.push(linhas.length === 0
        ? '_Tabela não encontrada ou vazia neste PDF._'
        : gerarTabelaMarkdown(info.cabecalho, linhas))
      partes.push('')
    })

    return partes.join('\n')
  }

  root.PjeTools.resumoCalculo = {
    extrairResumo,
    gerarCsv,
    gerarMarkdownCompleto,
    TABELAS_INFO,
    NOMES_AMIGAVEIS
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PjeTools.resumoCalculo

})()
