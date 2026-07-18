;(function () {
  'use strict'

  const root = typeof window !== 'undefined' ? window : globalThis
  root.PjeTools = root.PjeTools || {}

  // Ponto de adaptação para outro TRT (ver manifest.json).
  const BASE = 'https://pje.trt8.jus.br'

  // Nomenclatura de IDs de documento no PJe — os dois existem e NÃO se substituem:
  //   id                → numérico. Usado em /documentos/id/{id}/... (detalhe, conteúdo)
  //   idUnicoDocumento  → hexadecimal de 7 posições. Usado só em /preview e no rodapé do PDF
  // Usar o segundo nas rotas do primeiro devolve erro.

  class SessaoExpirada extends Error {
    constructor() { super('Sessão do PJe expirada. Faça login novamente e repita a operação.') }
  }

  async function requisitar(caminho, tipoEsperado) {
    const r = await fetch(BASE + caminho, { credentials: 'include' })

    // Sessão expirada devolve a página de login: HTTP 200 com content-type text/html
    const ct = r.headers.get('content-type') || ''
    if (r.status === 401 || r.status === 403 || ct.includes('text/html')) throw new SessaoExpirada()
    if (!r.ok) throw new Error(`O PJe respondeu HTTP ${r.status} em ${caminho}`)
    if (!ct.includes(tipoEsperado)) throw new Error(`Resposta inesperada (${ct || 'sem content-type'}) em ${caminho}`)

    return r
  }

  const json = async caminho => (await requisitar(caminho, 'application/json')).json()
  const pdf  = async caminho => (await requisitar(caminho, 'application/pdf')).arrayBuffer()

  root.PjeTools.api = {

    SessaoExpirada,

    processo: id =>
      json(`/pje-comum-api/api/processos/id/${id}`),

    partes: id =>
      json(`/pje-comum-api/api/processos/id/${id}/partes`),

    timeline: id =>
      json(`/pje-comum-api/api/processos/id/${id}/timeline?buscarMovimentos=false&buscarDocumentos=true`),

    // incluirAnexos é a única forma de enxergar os anexos: a timeline não os traz
    documento: (idProcesso, idDocumento) =>
      json(`/pje-comum-api/api/processos/id/${idProcesso}/documentos/id/${idDocumento}?incluirAnexos=true&incluirAssinatura=false&incluirMovimentos=false&incluirApreciacao=false`),

    // Só chamar quando o metadado disser tipoArquivo === 'HTML'.
    // Em documento PDF esta rota devolve 200 com corpo vazio — não é erro detectável.
    html: (idProcesso, idDocumento) =>
      requisitar(`/pje-comum-api/api/processos/id/${idProcesso}/documentos/id/${idDocumento}/html`, 'text/html')
        .then(r => r.text()),

    conteudo: (idProcesso, idDocumento) =>
      pdf(`/pje-comum-api/api/processos/id/${idProcesso}/documentos/id/${idDocumento}/conteudo`)

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = root.PjeTools.api

})()
