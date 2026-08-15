;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  const { api, resumoCalculo, markdown } = root.PjeTools ?? {}

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('lib/vendor/pdf.worker.js')
  }

  // ── Configuração ──────────────────────────────────────────────────────────

  // ATENÇÃO: atualizar a cada reajuste (teto do sumaríssimo = 40 SM; teto de alçada = 2 SM).
  const SALARIO_MINIMO   = 1621.00           // Decreto 12.797/2025, vigente desde 01/01/2026
  const TETO_SUMARISSIMO = SALARIO_MINIMO * 40   // R$ 64.840,00
  const TETO_ALCADA      = SALARIO_MINIMO * 2    // R$ 3.242,00 — Lei 5.584/70, art. 2º, §§3º-4º

  // Nome gerado pelo próprio PJe-Calc; o número casa com o "Cálculo: N" impresso no PDF
  const PADRAO_PLANILHA        = /^RELATORIO_CALCULO_(\d+)_DATA_\d{8}_HORA_\d{6}$/i
  // .{0,8} (não .{0,3}) para vãos como " de ": "Planilha de cálculo", "Relatório do cálculo".
  const PADRAO_PLANILHA_FROUXO = /relat[óo]rio.{0,8}c[áa]lculo|planilha.{0,8}c[áa]lculo/i

  // `tipo` casado prova presença; não casado NÃO prova ausência (coringa "Documento Diverso").
  const TIPO_CTPS      = 'Carteira de Trabalho e Previdência Social (CTPS)'
  const TIPO_DIVERSO   = 'Documento Diverso'
  const TIPO_PLANILHA  = 'Planilha de Cálculos'   // tipo controlado da planilha do PJe-Calc (inconsistente: às vezes vem como Documento Diverso)

  const DOCS_OBRIGATORIOS = [
    { rotulo: 'Procuração',                 tipos: ['Procuração'],                                    titulo: /procura[çc][ãa]o/i },
    { rotulo: 'Documento oficial com foto', tipos: ['Carteira de Identidade/Registro Geral (RG)',
                                                     'Carteira Nacional de Habilitação (CNH)', TIPO_CTPS], titulo: /\b(rg|identidade|cnh|habilita[çc][ãa]o)\b/i },
    { rotulo: 'CTPS',                       tipos: [TIPO_CTPS],                                       titulo: /\bctps\b|carteira.{0,15}trabalho/i },
    // Comprovante de residência NÃO tem tipo controlado no PJe — só camada 2.
    { rotulo: 'Comprovante de residência',  tipos: [],                                                titulo: /comprovante.{0,6}(resid[êe]ncia|endere[çc]o)/i }
  ]

  // Heurística de nome (fallback); não decide sozinha — ver classificarNaturezaJuridica.
  const PADRAO_ENTE_PUBLICO = new RegExp([
    '\\bunião\\b', '\\bmunic[íi]pio\\b', '\\bestado d[eo]\\b', '\\bdistrito federal\\b',
    '\\bautarquia\\b', '\\bfunda[çc][ãa]o\\b',
    '\\buniversidade federal\\b', '\\buniversidade estadual\\b',
    '\\binstituto federal\\b', '\\binstituto nacional\\b',
    '\\bag[êe]ncia nacional\\b', '\\bconselho regional\\b',
    '\\binss\\b', '\\bibama\\b', '\\bincra\\b', '\\bunifap\\b'
  ].join('|'), 'i')

  // ── Utilidades ────────────────────────────────────────────────────────────

  const painel = typeof document !== 'undefined' ? document.getElementById('log') : null

  function relatar(mensagem, erro = false) {
    const linha = document.createElement('div')
    linha.className = 'linha' + (erro ? ' erro' : '')
    linha.textContent = mensagem
    painel.appendChild(linha)
    painel.scrollTop = painel.scrollHeight
  }

  const moeda = v =>
    typeof v === 'number'
      ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'

  // Vários campos do PJe são objetos aninhados ({ id, descricao, sigla, ... })
  const descrever = v =>
    v == null            ? '—'
    : typeof v === 'string' ? v
    : (v.descricao ?? v.nome ?? v.sigla ?? '—')

  const sanitizarNomeArquivo = s => String(s).replace(/[\\/:*?"<>|]/g, '_').trim()

  // ── Mascaramento de PII (modo mascarado do dossiê, p/ enviar à IA) ─────────
  // Conectores que não viram inicial ("PAULO CESAR DE SOUZA" → P.C.S., não P.C.D.S.)
  const CONECTORES = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E'])

  function iniciais(nome) {
    const letras = String(nome ?? '')
      .split(/\s+/)
      .filter(t => t && !CONECTORES.has(t.toUpperCase()))
      .map(t => t[0].toUpperCase())
    return letras.length ? letras.join('.') + '.' : '—'
  }

  // Mantém raiz do CNPJ (8 dígitos); formato inesperado → redige tudo (fail-closed).
  function mascararCnpj(doc) {
    const m = String(doc ?? '').match(/^(\d{2}\.\d{3}\.\d{3})\/\d{4}-\d{2}$/)
    return m ? `${m[1]}/xxxx-xx` : 'xx.xxx.xxx/xxxx-xx'
  }

  // Âncora best-effort da transição qualificação→mérito; a garantia de PII é a redação abaixo.
  const ANCORA_MERITO = /(?:pelos fatos e fundamentos|raz[õo]es de fato e (?:de )?direito[^.:]*passa a exp\w+|que passa a exp\w+)[^.:]*[.:]/i

  // Sem âncora, mantém o texto inteiro (redigido) — nunca omite o corpo (serve a pedidos×planilha).
  function recortarQualificacao(texto) {
    const t = String(texto ?? '')
    const m = t.match(ANCORA_MERITO)
    if (!m) return { corpo: t.trim(), cortou: false }
    return { corpo: t.slice(m.index + m[0].length).trim(), cortou: true }
  }

  const escaparRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // PF: redige nome completo + cada token (sobrenome comum pode over-redigir, aceito).
  // PJ: só nome completo (token isolado apagaria texto legítimo). Advogados ficam de fora.
  function nomesParaRedigir(partes) {
    const alvos = []
    for (const p of partes ?? []) {
      const nome = String(p?.nome ?? '').trim()
      if (nome.length >= 3) alvos.push(nome)
      const ehPf = p?.tipoDocumento === 'CPF' || p?.tipoPessoa === 'F'
      if (ehPf) {
        nome.split(/\s+/).forEach(tok => {
          if (tok.length >= 3 && !CONECTORES.has(tok.toUpperCase())) alvos.push(tok)
        })
      }
    }
    // Mais longos primeiro: redige "LUAN FERREIRA DO NASCIMENTO" antes de "LUAN".
    return [...new Set(alvos)].sort((a, b) => b.length - a.length)
  }

  // Defesa em profundidade p/ nomes que escapam da omissão estrutural. Lookaround de letra
  // (não \b, que trata "_" como palavra e deixaria escapar "Planilha_Leonardo").
  function redigirNomes(texto, partes) {
    let t = String(texto ?? '')
    for (const alvo of nomesParaRedigir(partes)) {
      t = t.replace(new RegExp('(?<!\\p{L})' + escaparRegex(alvo) + '(?!\\p{L})', 'giu'), '[…]')
    }
    return t
  }

  // Redige CPF/CNPJ/CEP/e-mail/tel em texto livre; `\s*` tolera fragmentação do pdf.js
  // (dígito partido no meio do grupo ainda escapa — best-effort, ver aviso no dossiê).
  function redigirFormatos(texto) {
    return String(texto ?? '')
      .replace(/(?<!\d)\d{3}\s*\.\s*\d{3}\s*\.\s*\d{3}\s*-\s*\d{2}(?!\d)/g, '[CPF]')
      .replace(/(?<!\d)(\d{2}\.\d{3}\.\d{3})\s*\/\s*\d{4}\s*-\s*\d{2}(?!\d)/g, '$1/xxxx-xx')
      .replace(/(?<!\d)\d{2}\s*\.?\s*\d{3}\s*-\s*\d{3}(?!\d)/g, '[CEP]')
      .replace(/[\w.+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/g, '[email]')
      .replace(/\(\d{2}\)\s?\d{4,5}-?\d{4}/g, '[tel]')
  }

  const CORRIGIR = '❌ **[CORREÇÃO NECESSÁRIA]**'
  const OK       = '✅'
  const ATENCAO  = '⚠️'

  function baixar(texto, nomeArquivo) {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  function feedbackBaixado(botao) {
    const original = botao.textContent
    botao.textContent = '✓ Baixado'
    setTimeout(() => { botao.textContent = original }, 2500)
  }

  // ── Texto do PDF ──────────────────────────────────────────────────────────

  // O pdf.js fatia palavras em vários runs; join(' ') fixo quebrava o texto
  // ("pel os fund amentos"). Cola por posição: vão horizontal pequeno = mesma
  // palavra; vão maior = espaço real; Y diferente = nova linha. Heurística
  // calibrada e validada contra PDF real (2026-07-17).
  const LIMIAR_ESPACO_PDF = 1
  const TOLERANCIA_Y_PDF  = 3

  function montarTextoPagina(itens) {
    const ordenados = itens.filter(it => it.str).sort((a, b) => b.y - a.y || a.x - b.x)
    let texto = ''
    let anterior = null
    for (const it of ordenados) {
      if (anterior) {
        if (Math.abs(anterior.y - it.y) > TOLERANCIA_Y_PDF) {
          texto += '\n'
        } else {
          const vao = it.x - (anterior.x + anterior.largura)
          const jaTemEspaco = /\s$/.test(anterior.str) || /^\s/.test(it.str)
          if (vao > LIMIAR_ESPACO_PDF && !jaTemEspaco) texto += ' '
        }
      }
      texto += it.str
      anterior = it
    }
    return texto
  }

  async function extrairTextoPdf(arrayBuffer) {
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const paginas = []
    for (let p = 1; p <= doc.numPages; p++) {
      const conteudo = await doc.getPage(p).then(pg => pg.getTextContent())
      const itens = conteudo.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], largura: it.width }))
      paginas.push(montarTextoPagina(itens))
    }
    return paginas.join('\n\n')
  }

  // ── Partes ────────────────────────────────────────────────────────────────

  // /partes devolve {ATIVO,PASSIVO} objeto, não array — achata preservando `polo`.
  function normalizarPartes(dados) {
    if (Array.isArray(dados)) return dados.filter(p => p?.nome)
    if (dados && typeof dados === 'object') {
      return Object.values(dados).flat().filter(p => p?.nome)
    }
    return []
  }

  const ehPassivo = p => /passivo/i.test(p.polo ?? '')
  const advogados = p => (p.representantes ?? []).filter(r => /advogado/i.test(r.tipo ?? ''))

  function descreverParte(p) {
    const doc  = p.documento ? `${p.tipoDocumento ?? 'documento'} ${p.documento}` : 'sem documento'
    const cep  = p.endereco?.nroCep ? `CEP ${p.endereco.nroCep}` : 'sem CEP'
    const advs = advogados(p)
    const rep  = advs.length
      ? advs.map(a => `${a.nome} (OAB ${a.numeroOab ?? '?'}, ${a.situacaoOab ?? 'situação não informada'})`).join('; ')
      : 'sem advogado constituído (jus postulandi?)'
    return `- **${(p.polo ?? '?').toUpperCase()} — ${p.tipo ?? '?'}**: ${p.nome}\n  - Documento: ${doc}\n  - Endereço: ${cep}\n  - Representação: ${rep}`
  }

  function descreverParteMascarada(p) {
    const ehPj = p.tipoDocumento === 'CNPJ' || p.tipoPessoa === 'J'
    const doc  = ehPj && p.documento ? ` · CNPJ ${mascararCnpj(p.documento)}` : ''
    const advs = advogados(p)
    const rep  = advs.length
      ? '\n  - Advogado: ' + advs.map(a => `${a.nome} (OAB ${a.numeroOab ?? '?'})`).join('; ')
      : ''
    return `- **${(p.polo ?? '?').toUpperCase()} — ${p.tipo ?? '?'} (${ehPj ? 'PJ' : 'PF'})**: ${iniciais(p.nome)}${doc}${rep}`
  }

  // ── Regras determinísticas ────────────────────────────────────────────────

  function checarQualificacao(partes) {
    if (!partes.length) return [{ marca: CORRIGIR, texto: 'Partes não puderam ser carregadas — qualificação não verificada.' }]

    const autores = partes.filter(p => !ehPassivo(p))
    const reus    = partes.filter(ehPassivo)
    const itens   = []

    autores.forEach(a => {
      itens.push({ marca: a.documento ? OK : CORRIGIR,        texto: `Autor ${a.nome}: documento (${a.tipoDocumento ?? '—'})` })
      itens.push({ marca: a.endereco?.nroCep ? OK : CORRIGIR, texto: `Autor ${a.nome}: endereço com CEP` })
      itens.push({
        marca: advogados(a).length ? OK : ATENCAO,
        texto: advogados(a).length
          ? `Autor ${a.nome}: representado por advogado`
          : `Autor ${a.nome}: sem advogado — verificar jus postulandi (art. 791 CLT)`
      })
    })

    if (!reus.length) itens.push({ marca: CORRIGIR, texto: 'Nenhuma parte no polo passivo.' })
    reus.forEach(r => {
      itens.push({ marca: r.documento ? OK : CORRIGIR,        texto: `Réu ${r.nome}: documento (${r.tipoDocumento ?? '—'})` })
      itens.push({ marca: r.endereco?.nroCep ? OK : CORRIGIR, texto: `Réu ${r.nome}: endereço com CEP` })
    })

    return itens
  }

  function checarDocumentos(anexos) {
    return DOCS_OBRIGATORIOS.map(doc => {
      if (anexos.some(a => doc.tipos.includes(a.tipo))) {
        return { rotulo: doc.rotulo, status: 'PRESENTE', detalhe: null }
      }
      const porTitulo = anexos.find(a => doc.titulo.test(a.titulo ?? ''))
      if (porTitulo) {
        return { rotulo: doc.rotulo, status: 'PROVAVEL', detalhe: porTitulo.titulo }
      }
      return { rotulo: doc.rotulo, status: 'NAO_LOCALIZADO', detalhe: null }
    })
  }

  // "Documento Diverso" é coringa — listados no dossiê para nada ficar invisível.
  function anexosDiversos(anexos) {
    return anexos.filter(a => a.tipo === TIPO_DIVERSO)
  }

  // 3 camadas do sinal mais forte ao mais fraco: tipo controlado → título canônico → título
  // parecido ("provável"). Nunca afirma ausência sozinha (bug real de falso negativo — REGISTRO §1.2).
  function localizarPlanilha(anexos) {
    const porTipo = anexos.find(a => a.tipo === TIPO_PLANILHA)
    if (porTipo) return { planilha: porTipo, aviso: null }

    const canonico = anexos.find(a => PADRAO_PLANILHA.test(a.titulo ?? ''))
    if (canonico) return { planilha: canonico, aviso: null }

    const frouxo = anexos.find(a => PADRAO_PLANILHA_FROUXO.test(a.titulo ?? ''))
    if (frouxo) return {
      planilha: frouxo,
      aviso: `Planilha identificada por semelhança de título ("${frouxo.titulo}"), e não pelo tipo controlado nem pelo padrão do PJe-Calc. **Confirmar manualmente.**`
    }

    return { planilha: null, aviso: null }
  }

  // tipoPessoa: 'O' = direito público (impõe ordinário); 'J' = direito privado (inclui
  // empresa pública/economia mista, não impede sumaríssimo). NUNCA usar
  // pessoaJuridica.orgaoPublico — inconsistente entre entes idênticos (bug REGISTRO §1.2).
  function classificarNaturezaJuridica(parte) {
    const dsTipo = parte?.pessoaJuridica?.dsTipoPessoa ?? ''

    if (parte?.tipoPessoa === 'O') {
      return { impoeOrdinario: true, determinado: true, categoria: dsTipo || 'Órgão Público', aviso: null }
    }

    if (parte?.tipoPessoa === 'J') {
      // Empresa pública c/ prerrogativas da Fazenda (INFRAERO, Correios): não decidir, sinalizar.
      const aviso = /empresa p[úu]blica/i.test(dsTipo)
        ? `Empresa pública no polo passivo (${parte.nome}): em regra admite o rito sumaríssimo, mas se houver prerrogativas da Fazenda Pública a exclusão do art. 852-A da CLT é controvertida. **Conferir.**`
        : null
      return { impoeOrdinario: false, determinado: true, categoria: dsTipo || 'Jurídica', aviso }
    }

    // Sem campo estrutural (dado antigo ou formato inesperado): heurística sobre o nome.
    if (PADRAO_ENTE_PUBLICO.test(parte?.nome ?? '')) {
      return { impoeOrdinario: true, determinado: false, categoria: 'nome sugere ente público', aviso: null }
    }
    return { impoeOrdinario: false, determinado: false, categoria: null, aviso: null }
  }

  // Fail-closed: sem partes ou sem valor da causa, não há conclusão.
  function analisarRito(valorCausa, partes, classeJudicial) {
    const atribuido = descrever(classeJudicial)
    const avisos    = []

    const tetoApi = classeJudicial?.tetoValorCausa
    if (typeof tetoApi === 'number' && tetoApi !== TETO_SUMARISSIMO) {
      avisos.push(`O PJe informa teto de ${moeda(tetoApi)} para esta classe, mas a extensão calculou ${moeda(TETO_SUMARISSIMO)} (40 × ${moeda(SALARIO_MINIMO)}). Verificar se a constante SALARIO_MINIMO está desatualizada.`)
    }

    if (!partes.length) {
      return { atribuido, conclusao: 'INDETERMINADO', motivo: 'As partes do processo não puderam ser carregadas. Sem o polo passivo, não é possível descartar a presença de ente público — e sem isso não há conclusão sobre o rito.', avisos }
    }
    if (typeof valorCausa !== 'number') {
      return { atribuido, conclusao: 'INDETERMINADO', motivo: 'Valor da causa não localizado nos metadados do processo.', avisos }
    }

    const reus = partes.filter(ehPassivo).map(p => ({ parte: p, nat: classificarNaturezaJuridica(p) }))
    reus.forEach(({ nat }) => { if (nat.aviso) avisos.push(nat.aviso) })

    const impoem = reus.filter(({ nat }) => nat.impoeOrdinario)
    if (impoem.length) {
      const determinado = impoem.some(({ nat }) => nat.determinado)
      if (determinado) {
        const citados = impoem.filter(({ nat }) => nat.determinado).map(({ parte, nat }) => `${parte.nome} (${nat.categoria})`)
        return {
          atribuido,
          conclusao: 'ORDINÁRIO',
          motivo: `Ente público de direito público no polo passivo: ${citados.join('; ')}. Administração direta, autarquia e fundação pública impõem o rito ordinário independentemente do valor da causa. Classificação estrutural pela natureza jurídica informada pelo PJe (campo tipoPessoa), não por heurística de nome.`,
          avisos
        }
      }
      return {
        atribuido,
        conclusao: 'ORDINÁRIO (provável)',
        motivo: `Possível ente público no polo passivo: ${impoem.map(({ parte }) => parte.nome).join('; ')}. A natureza jurídica estrutural não veio na resposta, então a detecção é heurística sobre o nome da parte. Se for administração direta, autarquia ou fundação pública, o rito é ordinário independentemente do valor. **Confirmação humana obrigatória.**`,
        avisos
      }
    }

    if (valorCausa <= TETO_ALCADA) {
      return {
        atribuido,
        conclusao: 'SUMÁRIO (alçada)',
        motivo: `Valor da causa (${moeda(valorCausa)}) não excede o teto de alçada de ${moeda(TETO_ALCADA)} (2 × ${moeda(SALARIO_MINIMO)} — Lei 5.584/70, art. 2º, §§3º-4º), e nenhum réu tem natureza jurídica de direito público. Sentença de alçada é irrecorrível, salvo violação constitucional (Súmula 356/TST) — por isso incompatível com ente público, cuja condenação admite reexame necessário/recurso (Art. 496, I, CPC).`,
        avisos
      }
    }

    return valorCausa < TETO_SUMARISSIMO
      ? { atribuido, conclusao: 'SUMARÍSSIMO', motivo: `Valor da causa (${moeda(valorCausa)}) inferior ao teto de ${moeda(TETO_SUMARISSIMO)}, e nenhum réu tem natureza jurídica de direito público. Empresa pública e sociedade de economia mista, quando presentes, não impedem o sumaríssimo.`, avisos }
      : { atribuido, conclusao: 'ORDINÁRIO',   motivo: `Valor da causa (${moeda(valorCausa)}) igual ou superior ao teto de ${moeda(TETO_SUMARISSIMO)}.`, avisos }
  }

  // Classifica um rótulo de rito em uma de três categorias (ou null, se não reconhecido).
  // "sumário" e "sumaríssimo" nunca colidem: a fronteira \b barra "sumar[íi]o" de casar
  // dentro de "sumaríssimo" (que segue com "ssimo", não com fim de palavra).
  function classificarRotuloRito(texto) {
    if (/sumar[íi]ssimo/i.test(texto)) return 'SUMARÍSSIMO'
    if (/sum[áa]rio\b/i.test(texto))   return 'SUMÁRIO'
    if (/ordin[áa]rio/i.test(texto))   return 'ORDINÁRIO'
    return null
  }

  function divergenciaDeRito(rito) {
    if (rito.conclusao === 'INDETERMINADO') return null
    const atribuido = classificarRotuloRito(rito.atribuido)
    const calculado  = classificarRotuloRito(rito.conclusao)
    // Rótulo atribuído não reconhecido: fail-closed, não afirma divergência sem confiança.
    if (atribuido === null || calculado === null) return null
    return atribuido === calculado
      ? null
      : `Rito atribuído pelo advogado ("${rito.atribuido}") diverge da checagem automática ("${rito.conclusao}").`
  }

  // ── Montagem do dossiê ────────────────────────────────────────────────────

  function montarMarkdown(d, modo = 'completo', opcoes = {}) {
    const mascarado = modo === 'mascarado'
    // No mascarado, redige nomes + PII com formato; no completo, passa direto.
    const red = s => mascarado ? redigirFormatos(redigirNomes(s, d.partes)) : s
    const p = []

    p.push(`# Dossiê de Triagem — ${d.numeroProcesso}`, '')
    p.push(`Gerado por Severino JT em ${new Date().toLocaleString('pt-BR')}.`, '')
    if (mascarado) p.push('> **MODO MASCARADO (para envio a IA).** Qualificação das partes removida da Seção 1; nome→iniciais, CPF/CEP/telefone/e-mail redigidos, CNPJ→raiz. A redação do texto da inicial (Seção 5) **não é garantida** — o pdf.js fragmenta números, então CPF/CNPJ/CEP muito quebrados, endereço de rua e RG em prosa podem ter sobrevivido. **Revisar antes de enviar.**', '')
    p.push('> As checagens automáticas verificam a **existência** de documentos e dados, nunca a adequação de seu conteúdo (por exemplo, se a procuração contém os poderes específicos exigidos, ou se a natureza jurídica do réu é de fato autárquica). Toda marcação abaixo é ponto de partida para conferência humana, não substituto dela.', '')

    p.push('## 1. Metadados e qualificação', '')
    p.push(`- Número: ${d.numeroProcesso}`)
    p.push(`- ID interno: ${d.idProcesso}`)
    p.push(`- Classe: ${descrever(d.classeJudicial)}`)
    p.push(`- Valor da causa: ${moeda(d.valorCausa)}`)
    p.push(`- Órgão julgador: ${descrever(d.orgaoJulgador)}`)
    p.push('')

    p.push('### Partes', '')
    if (d.partes.length) {
      d.partes.forEach(x => p.push(mascarado ? descreverParteMascarada(x) : descreverParte(x)))
    } else {
      p.push(`${CORRIGIR} Não foi possível listar as partes${d.erroPartes ? `: ${d.erroPartes}` : '.'}`)
    }
    p.push('')

    // A checagem de qualificação repete nome e documento de cada parte — omitida no mascarado.
    if (!mascarado) {
      p.push('### Checagem de qualificação (art. 319 CPC / art. 840 CLT)', '')
      d.qualificacao.forEach(i => p.push(`- ${i.marca} ${i.texto}`))
      p.push('')
    }

    p.push('## 2. Rito processual', '')
    p.push(`- Rito atribuído na inicial: **${d.rito.atribuido}**`)
    p.push(`- Conclusão da checagem automática: **${d.rito.conclusao}**`)
    p.push(`- Fundamento: ${d.rito.motivo}`)
    if (d.divergenciaRito) p.push(`- ${CORRIGIR} ${d.divergenciaRito}`)
    d.rito.avisos.forEach(a => p.push(`- ${ATENCAO} ${a}`))
    p.push('')

    p.push('## 3. Documentação obrigatória (existência)', '')
    p.push('> Camadas: **por tipo** (lista controlada do PJe, determinístico) → **por título** (heurístico, "provável") → **não localizado**. O `tipo` casado prova presença; o `tipo` ausente **não** prova ausência — o documento pode estar como "Documento Diverso" (abaixo) ou com nome opaco.', '')
    d.checklist.forEach(c => {
      if (c.status === 'PRESENTE')
        p.push(`- ${OK} ${c.rotulo} — presente (por tipo)`)
      else if (c.status === 'PROVAVEL')
        p.push(`- ${OK} ${c.rotulo} — **provável**, localizado pelo título *"${red(c.detalhe)}"*. Confirmar.`)
      else
        p.push(`- ${ATENCAO} ${c.rotulo} — não localizado por tipo nem título. Pode estar sob "Documento Diverso" ou com nome opaco. **Conferir.**`)
    })
    p.push('')

    if (d.diversos.length) {
      p.push('### Anexos "Documento Diverso" (coringa — conferir manualmente)', '')
      p.push('> O advogado pode arquivar qualquer documento sob este tipo genérico. A checagem acima não os identifica pelo tipo; confira se algum é documento obrigatório.', '')
      d.diversos.forEach(a => p.push(`- *${red(a.titulo ?? '—')}*`))
      p.push('')
    }

    p.push('### Todos os anexos da petição inicial', '')
    d.anexos.forEach(a => p.push(`- ${a.tipo ?? '—'} — *${red(a.titulo ?? '—')}*`))
    p.push('')

    p.push('## 4. Resumo do Cálculo (planilha do PJe-Calc)', '')
    if (d.avisoPlanilha) p.push(`> ${ATENCAO} ${red(d.avisoPlanilha)}`, '')
    if (d.resumoMarkdown) {
      p.push(red(d.resumoMarkdown))
    } else if (d.ausenciaPlanilhaConfirmada) {
      p.push('*Não há planilha de cálculo — ausência confirmada manualmente na triagem (o processo não juntou planilha).*')
    } else {
      p.push('*Planilha de cálculo não localizada ou não legível.*')
    }
    p.push('')

    p.push('## 5. Texto integral da petição inicial', '')
    p.push(`> ${ATENCAO} O texto abaixo vem da camada textual do PDF. **Tabelas e trechos inseridos como imagem não aparecem aqui** — se a inicial remete a "tabela abaixo" e nada se segue, o conteúdo é uma imagem e precisa ser conferido no PDF original.`, '')
    if (mascarado) {
      // Corte manual tem prioridade sobre a âncora; `red` roda por cima de qualquer forma.
      let corpo, aviso
      if (typeof opcoes.corpoInicial === 'string') {
        corpo = opcoes.corpoInicial
        aviso = '> ⚠️ Preâmbulo aparado manualmente; o texto retido ainda passou por redação automática (nomes das partes, CPF, CNPJ, CEP, e-mail e telefone). **Sem garantia de estar completa**: o pdf.js fragmenta números, então **endereço de rua e RG em prosa, ou algum número muito quebrado, ainda podem ter sobrevivido** — revisar antes de enviar.'
      } else {
        const r = recortarQualificacao(d.textoInicial)
        corpo = r.corpo
        aviso = r.cortou
          ? '> ⚠️ Preâmbulo de qualificação recortado; nomes das partes, CPF, CNPJ, CEP, e-mail e telefone redigidos no corpo — **sem garantia de estar completo**: o pdf.js fragmenta números (`08.272.547/0006 - 62`, `68 . 90 6 - 301`), então **algum CPF/CNPJ/CEP muito quebrado, além de endereço de rua e RG em prosa, pode ter sobrevivido**. Revisar antes de enviar.'
          : '> ⚠️ Não foi possível localizar o fim do preâmbulo de qualificação — o texto foi mantido **inteiro e redigido** (sem garantia de estar completo). O pdf.js fragmenta números, então **a qualificação inicial das partes — CPF/CNPJ/CEP quebrados, endereço de rua e RG — pode ter sobrevivido**. **Revisar com atenção antes de enviar.**'
      }
      p.push(aviso, '')
      p.push(red(corpo) || '(vazio)')
    } else {
      p.push(d.textoInicial || '(vazio)')
    }
    p.push('')

    return p.join('\n')
  }

  // Extrai as tabelas e valida o nº do cálculo (título × PDF). Compartilhado entre
  // auto-detecção e apontamento manual (4ª camada).
  async function extrairPlanilha(idProcesso, planilha) {
    relatar(`Planilha: ${planilha.titulo}. Extraindo tabelas…`)
    try {
      const resultado = await resumoCalculo.extrairResumo(await api.conteudo(idProcesso, planilha.id))
      const resumoMarkdown = resumoCalculo.gerarMarkdownCompleto(resultado, 3)

      // Nº do cálculo no título × PDF devem coincidir (título opaco → sem checagem).
      let avisoPlanilha = null
      const noTitulo = (planilha.titulo.match(PADRAO_PLANILHA) ?? [])[1]
      if (noTitulo && resultado.numeroCalculo && noTitulo !== resultado.numeroCalculo) {
        avisoPlanilha = `Divergência: o título do anexo indica o cálculo nº ${noTitulo}, mas o PDF informa nº ${resultado.numeroCalculo}.`
        relatar(avisoPlanilha, true)
      }
      relatar('Tabelas do Resumo do Cálculo extraídas.')
      return { resumoMarkdown, avisoPlanilha }
    } catch (e) {
      const avisoPlanilha = `A planilha foi localizada mas não pôde ser lida: ${e.message}`
      relatar(avisoPlanilha, true)
      return { resumoMarkdown: null, avisoPlanilha }
    }
  }

  // 4ª camada (browser-only): quando as 3 automáticas falham, humano escolhe o anexo ou
  // confirma ausência — { tipo:'anexo', anexo } ou { tipo:'ausente' }.
  function selecionarPlanilhaManual(anexos) {
    return new Promise(resolve => {
      const secao   = document.getElementById('selecaoPlanilha')
      const select  = document.getElementById('planilhaAnexo')
      const btnUsar = document.getElementById('btnUsarAnexo')
      const btnSem  = document.getElementById('btnSemPlanilha')

      select.innerHTML = ''   // limpa; opções entram via createElement (dado do servidor vai em textContent)
      anexos.forEach((a, i) => {
        const opt = document.createElement('option')
        opt.value = String(i)
        opt.textContent = `${a.tipo ?? '—'} — ${a.titulo ?? '(sem título)'}${a.tipoArquivo ? ` [${a.tipoArquivo}]` : ''}`
        select.appendChild(opt)
      })
      btnUsar.disabled = anexos.length === 0

      secao.hidden = false
      const encerrar = escolha => {
        secao.hidden = true
        btnUsar.removeEventListener('click', onUsar)
        btnSem.removeEventListener('click', onSem)
        resolve(escolha)
      }
      const onUsar = () => encerrar({ tipo: 'anexo', anexo: anexos[Number(select.value)] })
      const onSem  = () => encerrar({ tipo: 'ausente' })
      btnUsar.addEventListener('click', onUsar)
      btnSem.addEventListener('click', onSem)
    })
  }

  // ── Fluxo principal ───────────────────────────────────────────────────────

  async function executar() {
    const idProcesso = new URLSearchParams(location.search).get('id')
    if (!idProcesso) {
      relatar('Nenhum processo informado. Abra um processo no PJe e use o botão do popup.', true)
      return
    }

    relatar(`Processo interno ${idProcesso} — consultando metadados…`)
    document.getElementById('spinner').hidden = false   // TR4 — indicador de carga

    let erroPartes = null
    const [processo, partesBrutas, timeline] = await Promise.all([
      api.processo(idProcesso),
      api.partes(idProcesso).catch(e => { erroPartes = e.message; return null }),
      api.timeline(idProcesso)
    ])

    console.debug('[PJeTools Triagem] processo:', processo, 'partes:', partesBrutas)

    const partes = normalizarPartes(partesBrutas)
    if (erroPartes)       relatar(`Falha ao carregar partes: ${erroPartes}`, true)
    else if (!partes.length) relatar('Partes retornadas em formato não reconhecido.', true)
    else                  relatar(`${partes.length} parte(s) carregada(s).`)

    const numeroProcesso = processo.numero ?? processo.numeroProcesso ?? String(idProcesso)
    const valorCausa     = processo.valorCausa ?? processo.valorDaCausa ?? null
    relatar(`Processo ${numeroProcesso} — ${timeline.length} documento(s) na timeline.`)

    // TR3 — âncora "qual processo estou triando" no cabeçalho e no título da aba
    const cabProc = document.getElementById('proc-numero')
    cabProc.textContent = `Processo ${numeroProcesso}`
    cabProc.hidden = false
    document.title = `Triagem ${numeroProcesso} — Severino JT`

    const inicial = timeline.find(d => d.tipo === 'Petição Inicial')
      ?? timeline.find(d => /peti[çc][ãa]o inicial/i.test(`${d.tipo} ${d.titulo}`))
    if (!inicial) throw new Error('Petição inicial não encontrada na timeline deste processo.')

    relatar('Petição inicial localizada. Expandindo anexos…')
    const detalhe = await api.documento(idProcesso, inicial.id)
    const anexos  = detalhe.anexos ?? []
    relatar(`${anexos.length} anexo(s) encontrado(s).`)

    // /html devolve 200 vazio em PDF — decisão vem do metadado, nunca de sondagem.
    let textoInicial = ''
    if (detalhe.tipoArquivo === 'HTML') {
      relatar('Inicial em HTML — extraindo texto direto.')
      const html = await api.html(idProcesso, inicial.id)
      textoInicial = new DOMParser().parseFromString(html, 'text/html').body.textContent.trim()
    } else {
      relatar(`Inicial em ${detalhe.tipoArquivo} — extraindo texto com pdf.js…`)
      textoInicial = await extrairTextoPdf(await api.conteudo(idProcesso, inicial.id))
    }
    relatar(`Texto da inicial: ${textoInicial.length.toLocaleString('pt-BR')} caracteres.`)

    let resumoMarkdown = null
    let avisoPlanilha  = null
    let ausenciaPlanilhaConfirmada = false

    let { planilha, aviso: avisoLocalizacao } = localizarPlanilha(anexos)
    avisoPlanilha = avisoLocalizacao

    // 4ª camada — humano no loop; nunca afirmamos ausência sozinhos.
    if (!planilha) {
      relatar('Planilha não detectada automaticamente — aguardando verificação manual.', true)
      document.getElementById('spinner').hidden = true          // nada carregando; esperamos o humano
      const escolha = await selecionarPlanilhaManual(anexos)
      document.getElementById('spinner').hidden = false
      if (escolha.tipo === 'anexo') {
        planilha = escolha.anexo
        avisoPlanilha = null
        relatar(`Anexo apontado manualmente como planilha: ${planilha.titulo}.`)
      } else {
        ausenciaPlanilhaConfirmada = true
        avisoPlanilha = null
        relatar('Ausência de planilha confirmada manualmente pelo usuário.')
      }
    }

    if (planilha) {
      const r = await extrairPlanilha(idProcesso, planilha)
      resumoMarkdown = r.resumoMarkdown
      // Sucesso limpo não sobrescreve um aviso de localização já existente com null.
      if (r.avisoPlanilha) avisoPlanilha = r.avisoPlanilha
    }

    const rito = analisarRito(valorCausa, partes, processo.classeJudicial)

    const dossie = {
      idProcesso,
      numeroProcesso,
      valorCausa,
      classeJudicial: processo.classeJudicial,
      orgaoJulgador:  processo.orgaoJulgador,
      partes,
      erroPartes,
      qualificacao:    checarQualificacao(partes),
      rito,
      divergenciaRito: divergenciaDeRito(rito),
      checklist:       checarDocumentos(anexos),
      diversos:        anexosDiversos(anexos),
      anexos,
      textoInicial,
      resumoMarkdown,
      avisoPlanilha,
      ausenciaPlanilhaConfirmada
    }

    const base          = sanitizarNomeArquivo(numeroProcesso)
    const nomeCompleto  = `${base} - dossie.md`
    const nomeMascarado = `${base} - dossie-MASCARADO.md`

    const previa    = document.getElementById('previa')
    const corte     = document.getElementById('corteManual')
    const corpoEl   = document.getElementById('corpoInicial')
    const nota      = document.getElementById('modo-nota')
    const btnCopiar = document.getElementById('btnCopiar')
    const btnBaixar = document.getElementById('btnBaixar')
    const segC      = document.getElementById('modo-completo')
    const segM      = document.getElementById('modo-mascarado')

    let modo = 'completo'

    // Fonte única de prévia, copiar e baixar; mascarado reflete o corte manual da textarea.
    const markdownAtual = () => modo === 'mascarado'
      ? montarMarkdown(dossie, 'mascarado', { corpoInicial: corpoEl.value })
      : montarMarkdown(dossie)
    const nomeAtual = () => modo === 'mascarado' ? nomeMascarado : nomeCompleto

    // A prévia usa markdown RENDERIZADO (tabelas etc.), escape-first (lib/markdown).
    const renderizarPrevia = () => { previa.innerHTML = markdown.renderizar(markdownAtual()) }

    function aplicarModo(novo) {
      modo = novo
      segC.classList.toggle('ativo', modo === 'completo')
      segM.classList.toggle('ativo', modo === 'mascarado')
      if (modo === 'mascarado') {
        if (!corpoEl.value) corpoEl.value = recortarQualificacao(textoInicial).corpo
        corte.hidden   = false
        nota.textContent = 'Qualificação das partes removida (CPF, CEP, endereço) e nomes redigidos. Recomendado para enviar a IA — ainda assim, revise antes.'
        nota.className = 'modo-nota seguro'
        btnBaixar.classList.add('mascarado')    // levemente diferente do completo (Copiar fica branco)
      } else {
        corte.hidden   = true
        nota.textContent = '⚠ Contém CPF, endereço e dados sensíveis das partes. Uso interno — não enviar a IA.'
        nota.className = 'modo-nota pii'
        btnBaixar.classList.remove('mascarado')
      }
      btnBaixar.title = nomeAtual()
      renderizarPrevia()
    }

    segC.addEventListener('click', () => aplicarModo('completo'))
    segM.addEventListener('click', () => aplicarModo('mascarado'))

    // Re-renderiza a prévia ao editar o corte (debounce leve p/ dossiê grande)
    let tRender
    corpoEl.addEventListener('input', () => {
      if (modo !== 'mascarado') return
      clearTimeout(tRender); tRender = setTimeout(renderizarPrevia, 200)
    })

    btnCopiar.addEventListener('click', async () => {
      await navigator.clipboard.writeText(markdownAtual())
      const orig = btnCopiar.textContent
      btnCopiar.textContent = '✓ Copiado'
      setTimeout(() => { btnCopiar.textContent = orig }, 2500)
    })
    btnBaixar.addEventListener('click', () => { baixar(markdownAtual(), nomeAtual()); feedbackBaixado(btnBaixar) })

    aplicarModo('completo')   // estado inicial: completo, prévia já renderizada
    relatar('Dossiê pronto.')
    document.getElementById('resultado').hidden = false
    document.getElementById('spinner').hidden   = true   // TR4 — carga concluída
  }

  // Auto-executa só no browser; sem consentimento, redireciona antes de tocar na API.
  if (typeof document !== 'undefined') {
    root.PjeTools.consentimento.concedido().then(ok => {
    if (!ok) { location.replace('consentimento.html'); return }
    executar().catch(e => {
      console.error('[PJeTools Triagem]', e)
      document.getElementById('spinner').hidden = true
      relatar(e instanceof api.SessaoExpirada ? e.message : `Falha: ${e.message}`, true)
    })
    })
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classificarNaturezaJuridica, analisarRito, divergenciaDeRito, checarQualificacao, checarDocumentos, anexosDiversos, localizarPlanilha, iniciais, mascararCnpj, recortarQualificacao, redigirNomes, redigirFormatos, montarMarkdown, montarTextoPagina }
  }

})()
