'use strict'

// Regras determinísticas de rito e natureza jurídica da triagem.
// Fixtures ANONIMIZADOS: preservam apenas a forma dos campos que a regra lê
// (tipoPessoa, dsTipoPessoa, nome). CNPJ/e-mail/endereço reais foram removidos.
// Os valores de `orgaoPublico` são mantidos DE PROPÓSITO com a armadilha real —
// true no Estado, false na fundação — para travar que o classificador os ignora.

const { test } = require('node:test')
const assert = require('node:assert/strict')

const {
  classificarNaturezaJuridica, analisarRito, checarQualificacao, checarDocumentos, anexosDiversos, localizarPlanilha,
  iniciais, mascararCnpj, recortarQualificacao, montarMarkdown, redigirNomes, redigirFormatos, montarTextoPagina
} = require('../pages/triagem.js')

// ── Fixtures: os 6 réus reais observados, anonimizados ──────────────────────

const reuEstado = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'ESTADO DO EXEMPLO', tipoPessoa: 'O',
  pessoaJuridica: { dsTipoPessoa: 'Estado ou Distrito Federal', tipoOrgaoPublico: 'E', orgaoPublico: true }
}
const reuFundacao = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'FUNDACAO UNIVERSIDADE FEDERAL DE EXEMPLO', tipoPessoa: 'O',
  pessoaJuridica: { dsTipoPessoa: 'Fundação Pública de Direito Público Federal', tipoOrgaoPublico: 'F', orgaoPublico: false }
}
const reuEconomiaMista = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'BANCO EXEMPLO SA', tipoPessoa: 'J',
  pessoaJuridica: { dsTipoPessoa: 'Sociedade de Economia Mista', orgaoPublico: false }
}
const reuEmpresaPublica = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'EMPRESA EXEMPLO DE INFRAESTRUTURA', tipoPessoa: 'J',
  pessoaJuridica: { dsTipoPessoa: 'Empresa Pública com prerrogativas da Fazenda Pública', orgaoPublico: false }
}
const reuLtda = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'CONSTRUTORA EXEMPLO LTDA', tipoPessoa: 'J',
  pessoaJuridica: { dsTipoPessoa: 'Sociedade Empresária Limitada', orgaoPublico: false }
}
const reuAssociacao = {
  polo: 'passivo', tipo: 'RECLAMADO', nome: 'UNIDADE EXEMPLO DE EDUCACAO', tipoPessoa: 'J',
  pessoaJuridica: { dsTipoPessoa: 'Associação Privada', orgaoPublico: false }
}

// Sem campo estrutural (dado antigo): força o fallback heurístico sobre o nome.
const reuSemEstruturaPublico  = { polo: 'passivo', tipo: 'RECLAMADO', nome: 'MUNICÍPIO DE EXEMPLO' }
const reuSemEstruturaPrivado  = { polo: 'passivo', tipo: 'RECLAMADO', nome: 'FULANO DE TAL' }

const autor = { polo: 'ativo', tipo: 'RECLAMANTE', nome: 'AUTOR EXEMPLO', tipoPessoa: 'F' }

const classeSumarissimo = {
  descricao: 'Ação Trabalhista - Rito Sumaríssimo', sigla: 'ATSum', tetoValorCausa: 64840
}

// ── classificarNaturezaJuridica ─────────────────────────────────────────────

test('tipoPessoa "O" (administração direta) impõe ordinário, determinístico', () => {
  const r = classificarNaturezaJuridica(reuEstado)
  assert.equal(r.impoeOrdinario, true)
  assert.equal(r.determinado, true)
  assert.equal(r.categoria, 'Estado ou Distrito Federal')
  assert.equal(r.aviso, null)
})

test('tipoPessoa "O" (fundação pública) impõe ordinário, determinístico', () => {
  const r = classificarNaturezaJuridica(reuFundacao)
  assert.equal(r.impoeOrdinario, true)
  assert.equal(r.determinado, true)
  assert.match(r.categoria, /Fundação Pública/)
})

test('ignora orgaoPublico: Estado (true) e fundação (false) têm o mesmo veredito', () => {
  // A armadilha: orgaoPublico diverge entre dois entes de direito público idênticos.
  assert.equal(classificarNaturezaJuridica(reuEstado).impoeOrdinario, true)
  assert.equal(classificarNaturezaJuridica(reuFundacao).impoeOrdinario, true)
})

test('economia mista não impõe ordinário, sem aviso', () => {
  const r = classificarNaturezaJuridica(reuEconomiaMista)
  assert.equal(r.impoeOrdinario, false)
  assert.equal(r.determinado, true)
  assert.equal(r.aviso, null)
})

test('empresa pública não impõe ordinário, mas emite aviso de controvérsia', () => {
  const r = classificarNaturezaJuridica(reuEmpresaPublica)
  assert.equal(r.impoeOrdinario, false)
  assert.equal(r.determinado, true)
  assert.match(r.aviso, /empresa p[úu]blica/i)
  assert.match(r.aviso, /Fazenda|controvertid/i)
})

test('sociedade limitada e associação privada não impõem ordinário', () => {
  for (const reu of [reuLtda, reuAssociacao]) {
    const r = classificarNaturezaJuridica(reu)
    assert.equal(r.impoeOrdinario, false)
    assert.equal(r.determinado, true)
    assert.equal(r.aviso, null)
  }
})

test('sem campo estrutural, nome de ente público cai no fallback heurístico (não determinado)', () => {
  const r = classificarNaturezaJuridica(reuSemEstruturaPublico)
  assert.equal(r.impoeOrdinario, true)
  assert.equal(r.determinado, false)
})

test('sem campo estrutural e nome não reconhecido: não impõe, não determinado', () => {
  const r = classificarNaturezaJuridica(reuSemEstruturaPrivado)
  assert.equal(r.impoeOrdinario, false)
  assert.equal(r.determinado, false)
})

// ── analisarRito ────────────────────────────────────────────────────────────

test('réu de direito público (tipoPessoa O) → ORDINÁRIO determinístico, sem "(provável)"', () => {
  const r = analisarRito(50000, [autor, reuEstado], classeSumarissimo)
  assert.equal(r.conclusao, 'ORDINÁRIO')
  assert.match(r.motivo, /Estado ou Distrito Federal/)
})

test('empresa pública abaixo do teto → SUMARÍSSIMO com aviso de conferência', () => {
  const r = analisarRito(50000, [autor, reuEmpresaPublica], classeSumarissimo)
  assert.equal(r.conclusao, 'SUMARÍSSIMO')
  assert.ok(r.avisos.some(a => /empresa p[úu]blica/i.test(a)))
})

test('economia mista abaixo do teto → SUMARÍSSIMO', () => {
  const r = analisarRito(50000, [autor, reuEconomiaMista], classeSumarissimo)
  assert.equal(r.conclusao, 'SUMARÍSSIMO')
})

test('fallback heurístico (sem campo estrutural) → ORDINÁRIO (provável)', () => {
  const r = analisarRito(50000, [autor, reuSemEstruturaPublico], classeSumarissimo)
  assert.equal(r.conclusao, 'ORDINÁRIO (provável)')
})

test('valor igual ou acima do teto, só réu privado → ORDINÁRIO por valor', () => {
  const r = analisarRito(70000, [autor, reuLtda], classeSumarissimo)
  assert.equal(r.conclusao, 'ORDINÁRIO')
  assert.match(r.motivo, /teto/i)
})

test('fail-closed: sem partes → INDETERMINADO', () => {
  const r = analisarRito(50000, [], classeSumarissimo)
  assert.equal(r.conclusao, 'INDETERMINADO')
})

test('fail-closed: valor da causa ausente → INDETERMINADO', () => {
  const r = analisarRito(null, [autor, reuLtda], classeSumarissimo)
  assert.equal(r.conclusao, 'INDETERMINADO')
})

test('teto do PJe divergente da constante gera aviso de SALARIO_MINIMO desatualizado', () => {
  const classeVelha = { ...classeSumarissimo, tetoValorCausa: 60720 } // teto de 2025
  const r = analisarRito(50000, [autor, reuLtda], classeVelha)
  assert.ok(r.avisos.some(a => /SALARIO_MINIMO/.test(a)))
})

// ── checarDocumentos: modelo de 3 camadas ───────────────────────────────────

// Os 8 anexos reais de um processo (com comprovante e CNH), títulos anonimizados.
// Reproduz as armadilhas: comprovante entrou como "Documento Diverso" (não há tipo
// controlado), e a CNH entrou sob o tipo "RG".
const anexosReais = [
  { tipo: 'Planilha de Cálculos',                                  titulo: 'RELATORIO_CALCULO_EXEMPLO' },
  { tipo: 'Extrato de FGTS',                                       titulo: 'extrato_fgts_exemplo' },
  { tipo: 'Carteira de Trabalho e Previdência Social (CTPS)',      titulo: 'CTPS Exemplo Digi' },
  { tipo: 'Documento Diverso',                                     titulo: 'comprovante de residencia' },
  { tipo: 'Carteira de Identidade/Registro Geral (RG)',           titulo: 'CNH identidade' },
  { tipo: 'Declaração de Hipossuficiência',                        titulo: 'declaração hipossuficiencia exemplo' },
  { tipo: 'Substabelecimento com Reserva de Poderes',             titulo: 'subestabelecimento exemplo' },
  { tipo: 'Procuração',                                            titulo: 'procuração exemplo' }
]

const item = (checklist, rotulo) => checklist.find(c => c.rotulo === rotulo)

test('camada 1: procuração, CTPS e foto (por tipo) → PRESENTE', () => {
  const r = checarDocumentos(anexosReais)
  assert.equal(item(r, 'Procuração').status, 'PRESENTE')
  assert.equal(item(r, 'CTPS').status, 'PRESENTE')
  assert.equal(item(r, 'Documento oficial com foto').status, 'PRESENTE') // via tipo RG
})

test('camada 1: CNH arquivada sob tipo RG satisfaz "documento com foto"', () => {
  const soCnhComoRg = [{ tipo: 'Carteira de Identidade/Registro Geral (RG)', titulo: 'CNH identidade' }]
  assert.equal(item(checarDocumentos(soCnhComoRg), 'Documento oficial com foto').status, 'PRESENTE')
})

test('camada 2: comprovante como "Documento Diverso" → PROVÁVEL pelo título', () => {
  const c = item(checarDocumentos(anexosReais), 'Comprovante de residência')
  assert.equal(c.status, 'PROVAVEL')
  assert.equal(c.detalhe, 'comprovante de residencia')
})

test('camada 3: documento ausente por tipo e por título → NAO_LOCALIZADO (nunca ❌ duro)', () => {
  const semComprovante = anexosReais.filter(a => a.titulo !== 'comprovante de residencia')
  assert.equal(item(checarDocumentos(semComprovante), 'Comprovante de residência').status, 'NAO_LOCALIZADO')
})

test('camada 2 pega comprovante mesmo escrito como "comprovante de endereço"', () => {
  const anexos = [{ tipo: 'Documento Diverso', titulo: 'comprovante de endereço atualizado' }]
  assert.equal(item(checarDocumentos(anexos), 'Comprovante de residência').status, 'PROVAVEL')
})

test('anexosDiversos devolve só os coringas "Documento Diverso"', () => {
  const diversos = anexosDiversos(anexosReais)
  assert.equal(diversos.length, 1)
  assert.equal(diversos[0].titulo, 'comprovante de residencia')
})

// ── localizarPlanilha: modelo de 3 camadas (tipo → título canônico → título frouxo) ─

test('camada 1: tipo "Planilha de Cálculos" com título opaco → localizada, sem aviso', () => {
  // Caso real do proc. 0002222-33: o tipo controlado casa, mas o título "Planilha
  // de Cálculos" não bate o frouxo (" de " tem 4 chars; .{0,3} só admite 3).
  // Antes do modelo de 3 camadas o dossiê declarava falsa ausência (§1.2).
  const anexos = [{ tipo: 'Planilha de Cálculos', titulo: 'Planilha de Cálculos' }]
  const r = localizarPlanilha(anexos)
  assert.equal(r.planilha, anexos[0])
  assert.equal(r.aviso, null)
})

test('camada 2: título canônico do PJe-Calc sem o tipo → localizada, sem aviso', () => {
  const anexos = [{ tipo: 'Documento Diverso', titulo: 'RELATORIO_CALCULO_4515_DATA_04072026_HORA_181150' }]
  const r = localizarPlanilha(anexos)
  assert.equal(r.planilha, anexos[0])
  assert.equal(r.aviso, null)
})

test('camada 3: título frouxo sem o tipo → localizada, com aviso de conferência', () => {
  // Título visto num processo real (nome camuflado): casa o frouxo (RELATORIO_CALCULO),
  // mas não é canônico (sem _DATA_..._HORA_...) e o anexo não veio com o tipo controlado.
  const anexos = [{ tipo: 'Documento Diverso', titulo: 'RELATORIO_CALCULO_FULANO DE TAL' }]
  const r = localizarPlanilha(anexos)
  assert.equal(r.planilha, anexos[0])
  assert.match(r.aviso, /confirmar|semelhança/i)
})

test('tipo (camada 1) tem prioridade sobre um título frouxo de outro anexo', () => {
  const porTipo    = { tipo: 'Planilha de Cálculos', titulo: 'documento sem padrão' }
  const porTitulo  = { tipo: 'Documento Diverso',    titulo: 'planilha de calculo antiga' }
  const r = localizarPlanilha([porTitulo, porTipo])
  assert.equal(r.planilha, porTipo)
  assert.equal(r.aviso, null)
})

test('nada compatível → planilha nula, sem aviso (a mensagem de ausência é do chamador)', () => {
  const r = localizarPlanilha([{ tipo: 'Procuração', titulo: 'procuração exemplo' }])
  assert.equal(r.planilha, null)
  assert.equal(r.aviso, null)
})

test('camada 3: título "Planilha de cálculo_Nome" (Documento Diverso) casa o frouxo apesar do " de "', () => {
  // Caso real do proc. 0001111-22: " de " entre "planilha" e "cálculo" tem 4 chars;
  // o .{0,3} antigo perdia e declarava falsa ausência (classe §1.8).
  const anexos = [{ tipo: 'Documento Diverso', titulo: 'Planilha de cálculo_Leonardo' }]
  const r = localizarPlanilha(anexos)
  assert.equal(r.planilha, anexos[0])
  assert.match(r.aviso, /confirmar|semelhança/i)
})

// ── Modo mascarado do dossiê: helpers puros ─────────────────────────────────

test('iniciais: nome vira iniciais, pulando conectores (de/da/do/e)', () => {
  assert.equal(iniciais('PAULO CESAR DE SOUZA NASCIMENTO'), 'P.C.S.N.')
  assert.equal(iniciais('EMPRESA Z LTDA'), 'E.Z.L.')
})

test('mascararCnpj: mantém a raiz (grupo econômico), redige filial e dígitos', () => {
  assert.equal(mascararCnpj('33.444.555/0001-66'), '33.444.555/xxxx-xx')
})

test('recortarQualificacao: remove o preâmbulo até a âncora "pelos fatos e fundamentos"', () => {
  const t = 'CABEÇALHO. FULANO, brasileiro, CPF 000.000.000-00, residente na Rua Y, ' +
            'em face de EMPRESA Z LTDA, pelos fatos e fundamentos abaixo descritos: ' +
            'I. DOS FATOS corpo aqui.'
  const r = recortarQualificacao(t)
  assert.equal(r.cortou, true)
  assert.match(r.corpo, /DOS FATOS corpo aqui/)
  assert.doesNotMatch(r.corpo, /residente na Rua Y/)
  assert.doesNotMatch(r.corpo, /000\.000\.000-00/)
})

test('recortarQualificacao: âncora com "." em vez de ":" também casa', () => {
  const r = recortarQualificacao('X, CPF 1, em face de Y, pelos fatos e fundamentos a seguir expostos. 1. DA SÍNTESE ...')
  assert.equal(r.cortou, true)
  assert.match(r.corpo, /DA SÍNTESE/)
})

test('recortarQualificacao: âncora "razões de fato e de direito … passa a expender" (caso real)', () => {
  const t = 'FULANO, CPF 1, residente na rua X, ajuizar a presente: Em desfavor de: ' +
            'Pelas razões de fato e de direito que passa a expender: 1. DA RECLAMAÇÃO o reclamante foi admitido...'
  const r = recortarQualificacao(t)
  assert.equal(r.cortou, true)
  assert.match(r.corpo, /DA RECLAMAÇÃO/)
  assert.doesNotMatch(r.corpo, /residente na rua X/)
})

test('recortarQualificacao: sem âncora, mantém o texto inteiro (cortou=false) — a redação cobre a PII', () => {
  const r = recortarQualificacao('texto sem a fórmula ritual, nada reconhecível aqui')
  assert.equal(r.cortou, false)
  assert.match(r.corpo, /texto sem a fórmula ritual/)
})

// ── Modo mascarado do dossiê: montarMarkdown(d, 'mascarado') ─────────────────

function dossieFixture() {
  return {
    numeroProcesso: '0000000-00.2026.5.08.0207',
    idProcesso: 999999,
    classeJudicial: { descricao: 'Ação Trabalhista - Rito Sumaríssimo' },
    valorCausa: 36568.91,
    orgaoJulgador: { descricao: '8ª VARA DO TRABALHO DE MACAPÁ' },
    partes: [
      { polo: 'ativo', tipo: 'RECLAMANTE', nome: 'FULANO DE TAL SILVA',
        documento: '000.000.000-00', tipoDocumento: 'CPF', tipoPessoa: 'F',
        endereco: { nroCep: '68900-000' },
        representantes: [ { tipo: 'ADVOGADO', nome: 'BELTRANO SOUZA', numeroOab: 'AP0001', situacaoOab: 'REGULAR' } ] },
      { polo: 'passivo', tipo: 'RECLAMADO', nome: 'EMPRESA Z LTDA',
        documento: '11.222.333/0001-44', tipoDocumento: 'CNPJ', tipoPessoa: 'J',
        endereco: { nroCep: '68901-000' }, representantes: [] }
    ],
    erroPartes: null,
    qualificacao: [ { marca: '✅', texto: 'Autor FULANO DE TAL SILVA: documento (CPF)' } ],
    rito: { atribuido: 'Ação Trabalhista - Rito Sumaríssimo', conclusao: 'SUMARÍSSIMO', motivo: 'Valor da causa inferior ao teto.', avisos: [] },
    divergenciaRito: null,
    checklist: [ { rotulo: 'Procuração', status: 'PRESENTE', detalhe: null } ],
    diversos: [],
    anexos: [ { tipo: 'Procuração', titulo: 'procuração do autor' } ],
    textoInicial: 'ESCRITORIO XPTO. FULANO DE TAL SILVA, brasileiro, CPF 000.000.000-00, ' +
                  'residente na Rua Y, nº 1, CEP 68900-000, em face de EMPRESA Z LTDA, ' +
                  'CNPJ 11.222.333/0001-44, pelos fatos e fundamentos abaixo descritos: ' +
                  'I. DOS FATOS o reclamante trabalhou muito. DOS PEDIDOS paga tudo.',
    resumoMarkdown: '### Resumo do Cálculo\n| Descrição | Valor |\n| --- | --- |\n| Total | 1,00 |',
    avisoPlanilha: null
  }
}

test('modo completo (default) inalterado: mantém CPF, nome e checagem de qualificação', () => {
  const md = montarMarkdown(dossieFixture())
  assert.match(md, /000\.000\.000-00/)
  assert.match(md, /FULANO DE TAL SILVA/)
  assert.match(md, /Checagem de qualificação/)
  assert.ok(montarMarkdown(dossieFixture(), 'completo').includes('000.000.000-00'))
})

test('modo mascarado: sem CPF, sem CEP e sem endereço da parte', () => {
  const md = montarMarkdown(dossieFixture(), 'mascarado')
  assert.doesNotMatch(md, /\d{3}\.\d{3}\.\d{3}-\d{2}/)   // nenhum CPF
  assert.doesNotMatch(md, /\d{5}-\d{3}/)                 // nenhum CEP
  assert.doesNotMatch(md, /Rua Y/)                       // endereço do preâmbulo sumiu
})

test('modo mascarado: nome da parte vira iniciais', () => {
  const md = montarMarkdown(dossieFixture(), 'mascarado')
  assert.doesNotMatch(md, /FULANO DE TAL SILVA/)
  assert.match(md, /F\.T\.S\./)
})

test('modo mascarado: CNPJ mantém raiz, redige filial e dígitos', () => {
  const md = montarMarkdown(dossieFixture(), 'mascarado')
  assert.doesNotMatch(md, /11\.222\.333\/0001-44/)
  assert.match(md, /11\.222\.333\/xxxx-xx/)
})

test('modo mascarado: advogado e OAB preservados (dado público)', () => {
  const md = montarMarkdown(dossieFixture(), 'mascarado')
  assert.match(md, /BELTRANO SOUZA/)
  assert.match(md, /AP0001/)
})

test('modo mascarado: remove a checagem de qualificação art. 319/840', () => {
  assert.doesNotMatch(montarMarkdown(dossieFixture(), 'mascarado'), /Checagem de qualificação/)
})

test('modo mascarado: Seção 5 sem preâmbulo, com o corpo (fatos/pedidos)', () => {
  const md = montarMarkdown(dossieFixture(), 'mascarado')
  assert.match(md, /DOS FATOS/)
  assert.match(md, /DOS PEDIDOS/)
  assert.doesNotMatch(md, /brasileiro, CPF/)   // preâmbulo cortado
})

test('Seção 5: texto da inicial sai sem cerca de código (IA lê como texto, não bloco literal)', () => {
  // Fence ```text fazia a IA tratar a inicial como bloco a exibir, não como conteúdo
  // a interpretar — e crases na própria petição quebravam a cerca. Sai plano nos dois modos.
  assert.doesNotMatch(montarMarkdown(dossieFixture(), 'completo'),  /```/)
  assert.doesNotMatch(montarMarkdown(dossieFixture(), 'mascarado'), /```/)
  // o texto em si continua presente (só perdeu o embrulho)
  assert.match(montarMarkdown(dossieFixture(), 'completo'), /trabalhou muito/)
})

// ── Corte manual do preâmbulo (humano no loop): opcoes.corpoInicial ─────────

test('corte manual: opcoes.corpoInicial substitui o corpo da Seção 5 pela versão aparada à mão', () => {
  const corpoAparado = 'I. DOS FATOS trecho aparado pelo humano. DOS PEDIDOS x.'
  const md = montarMarkdown(dossieFixture(), 'mascarado', { corpoInicial: corpoAparado })
  assert.match(md, /aparado pelo humano/)
  assert.doesNotMatch(md, /trabalhou muito/)   // texto cru original substituído
})

test('corte manual: o corpo fornecido ainda passa por redação (defesa em profundidade)', () => {
  // Se sobrou nome/CPF de parte no que o humano reteve, a redação automática pega.
  const corpoComVazamento = 'sobrou FULANO DE TAL SILVA com CPF 000.000.000-00 no meio do corpo'
  const md = montarMarkdown(dossieFixture(), 'mascarado', { corpoInicial: corpoComVazamento })
  assert.doesNotMatch(md, /FULANO DE TAL SILVA/)
  assert.doesNotMatch(md, /000\.000\.000-00/)
})

test('corte manual: opcoes.corpoInicial é ignorado no modo completo', () => {
  const md = montarMarkdown(dossieFixture(), 'completo', { corpoInicial: 'NAO_DEVE_APARECER' })
  assert.doesNotMatch(md, /NAO_DEVE_APARECER/)
  assert.match(md, /trabalhou muito/)          // completo mantém o texto cru intacto
})

// ── Commit 2: redigirNomes (nomes conhecidos em texto livre) ────────────────

const partesRedacao = [
  { nome: 'PRIMEIRO ALFA SILVA',         tipoDocumento: 'CPF',  tipoPessoa: 'F' },
  { nome: 'SEGUNDO BETA COSTA',          tipoDocumento: 'CPF',  tipoPessoa: 'F' },
  { nome: 'V. L. VEICULOS LTDA',         tipoDocumento: 'CNPJ', tipoPessoa: 'J' }
]

test('redigirNomes: redige nome completo e primeiro nome (PF)', () => {
  assert.doesNotMatch(redigirNomes('2. Procuracao - Primeiro', partesRedacao), /Primeiro/i)
  assert.doesNotMatch(redigirNomes('o proprietario Segundo avisou', partesRedacao), /\bSegundo\b/i)
  assert.doesNotMatch(redigirNomes('contratou SEGUNDO BETA COSTA', partesRedacao), /SEGUNDO BETA/i)
})

test('redigirNomes: redige TODOS os tokens de PF (sobrenome incluso) — over-redação aceita', () => {
  // sobrenome de PF vira alvo: "Gama" da parte "TERCEIRO GAMA SOUZA"
  const partes = [{ nome: 'TERCEIRO GAMA SOUZA', tipoDocumento: 'CPF', tipoPessoa: 'F' }]
  assert.doesNotMatch(redigirNomes('assinado por GAMA', partes), /GAMA/i)
})

test('redigirNomes: preserva token de EMPRESA (evita apagar palavra comum)', () => {
  // PJ redige só o nome completo → "veículos" (profissão) sobrevive apesar da ré "V. L. VEICULOS LTDA"
  assert.match(redigirNomes('era vendedor de veículos', partesRedacao), /vendedor de veículos/)
})

test('redigirNomes: redige nome colado a "_" ou pontuação (não depende de \\b)', () => {
  const partes = [{ nome: 'TERCEIRO GAMA SOUZA', tipoDocumento: 'CPF', tipoPessoa: 'F' }]
  assert.doesNotMatch(redigirNomes('Planilha de cálculo_Terceiro', partes), /Terceiro/i)
  assert.doesNotMatch(redigirNomes('Atestado_Terceiro Gama', partes), /Terceiro|Gama/i)
})

// ── redigirFormatos: PII com formato reconhecível em texto livre ─────────────

test('redigirFormatos: redige CPF mesmo colado a underscore/letras', () => {
  const r = redigirFormatos('CTPSContratosDigitais_111.222.333-44_26-06-2026')
  assert.doesNotMatch(r, /111\.222\.333-44/)
  assert.match(r, /\[CPF\]/)
})

test('redigirFormatos: redige e-mail e telefone; CNPJ vira raiz', () => {
  assert.match(redigirFormatos('contato@escritorioexemplo.com.br'), /\[email\]/)
  assert.match(redigirFormatos('fone (96) 99999-0000 e (61) 3000-0000'), /\[tel\].*\[tel\]/)
  assert.match(redigirFormatos('CNPJ 22.333.444/0001-55'), /22\.333\.444\/xxxx-xx/)
})

test('redigirFormatos: NÃO confunde número de processo com CPF', () => {
  assert.match(redigirFormatos('0001111-22.2026.5.08.0207'), /0001111-22\.2026\.5\.08\.0207/)
})

test('redigirFormatos: redige CEP (com e sem ponto), sem tocar processo/valor', () => {
  assert.doesNotMatch(redigirFormatos('CEP: 68.909-819'), /68\.909-819/)
  assert.doesNotMatch(redigirFormatos('CEP 68906-301'), /68906-301/)
  assert.match(redigirFormatos('mora no CEP 68.909-819'), /\[CEP\]/)
  // não pode devorar nº de processo nem valor monetário
  assert.match(redigirFormatos('proc 0001111-22.2026.5.08.0207 vale R$ 2.691,79'), /0001111-22\.2026\.5\.08\.0207/)
  assert.match(redigirFormatos('R$ 2.691,79'), /2\.691,79/)
})

test('redigirFormatos: tolera espaços que o pdf.js insere nos separadores (caso real)', () => {
  // CNPJ e CPF fragmentados pela extração do pdf.js
  assert.match(redigirFormatos('CNPJ 44.555.666/0007 - 88'), /44\.555\.666\/xxxx-xx/)
  assert.doesNotMatch(redigirFormatos('CNPJ 44.555.666/0007 - 88'), /0007 - 88/)
  assert.match(redigirFormatos('CPF 111 . 222 . 333 - 44'), /\[CPF\]/)
  assert.match(redigirFormatos('CEP: 68 . 909 - 819'), /\[CEP\]/)
})

test('redigirNomes: redige nome completo de PJ, escapando metacaracteres (. e &)', () => {
  const partes = [{ nome: 'GHR CONSTRUCOES & TERRAPLENAGEM LTDA', tipoDocumento: 'CNPJ', tipoPessoa: 'J' }]
  assert.doesNotMatch(redigirNomes('a ré GHR CONSTRUCOES & TERRAPLENAGEM LTDA respondeu', partes), /GHR CONSTRUCOES/)
})

test('redigirNomes: não toca no advogado (não está na lista de partes)', () => {
  // QUARTA é advogada → não vem em d.partes → preservada
  assert.match(redigirNomes('HONORÁRIOS PARA QUARTA DELTA PEREIRA', partesRedacao), /QUARTA DELTA PEREIRA/)
})

test('modo mascarado (Commit 2): redige nome conhecido em anexo, planilha e corpo', () => {
  const d = dossieFixture()
  d.diversos       = [{ titulo: 'Conversa - proprietario FULANO' }]
  d.anexos         = [{ tipo: 'Documento Diverso', titulo: 'Conversa - proprietario FULANO' }]
  d.resumoMarkdown = '| LÍQUIDO PARA FULANO DE TAL SILVA | 1,00 |'
  d.textoInicial   = 'X, CPF 000.000.000-00, pelos fatos e fundamentos abaixo: DOS FATOS FULANO DE TAL SILVA trabalhou. DOS PEDIDOS.'
  const md = montarMarkdown(d, 'mascarado')
  assert.doesNotMatch(md, /FULANO DE TAL SILVA/)          // corpo e planilha redigidos
  assert.doesNotMatch(md, /proprietario FULANO\b/)        // título de anexo redigido
})

test('modo completo NÃO redige nomes (redação é só do mascarado)', () => {
  const d = dossieFixture()
  d.textoInicial = 'pelos fatos e fundamentos abaixo: FULANO DE TAL SILVA trabalhou.'
  assert.match(montarMarkdown(d, 'completo'), /FULANO DE TAL SILVA/)
})

test('modo mascarado: CPF embutido em título de anexo é redigido', () => {
  const d = dossieFixture()
  d.anexos = [{ tipo: 'Contrato de Trabalho', titulo: 'CTPSContratosDigitais_111.222.333-44_26-06-2026' }]
  const md = montarMarkdown(d, 'mascarado')
  assert.doesNotMatch(md, /111\.222\.333-44/)
})

test('modo mascarado: Seção 5 sem âncora é MANTIDA e redigida (não mais omitida)', () => {
  const d = dossieFixture()
  d.textoInicial = 'SEM ANCORA. FULANO DE TAL SILVA, CPF 000.000.000-00, CEP 68900-000. DOS FATOS trabalhou muito.'
  const md = montarMarkdown(d, 'mascarado')
  assert.match(md, /DOS FATOS trabalhou muito/)      // corpo mantido
  assert.doesNotMatch(md, /FULANO DE TAL SILVA/)      // nome redigido
  assert.doesNotMatch(md, /000\.000\.000-00/)         // CPF redigido
  assert.doesNotMatch(md, /68900-000/)                // CEP redigido
  assert.doesNotMatch(md, /Texto integral omitido/)   // não omitiu
})

// ── Caminhos frios (REGISTRO §3): caracterização antes do alpha ──────────────
// Travam o comportamento atual de trechos nunca exercitados em processo real.

test('checarQualificacao: múltiplos autores — cada autor recebe suas 3 checagens', () => {
  const partes = [
    { polo: 'ativo', tipo: 'RECLAMANTE', nome: 'AUTOR UM', documento: '1', tipoDocumento: 'CPF',
      endereco: { nroCep: '68900-000' }, representantes: [{ tipo: 'ADVOGADO', numeroOab: 'AP1' }] },
    { polo: 'ativo', tipo: 'RECLAMANTE', nome: 'AUTOR DOIS', documento: '2', tipoDocumento: 'CPF',
      endereco: { nroCep: '68901-000' }, representantes: [{ tipo: 'ADVOGADO', numeroOab: 'AP2' }] },
    { polo: 'passivo', tipo: 'RECLAMADO', nome: 'RE X', documento: '9', tipoDocumento: 'CNPJ',
      endereco: { nroCep: '68902-000' }, representantes: [] }
  ]
  const itens = checarQualificacao(partes)
  assert.equal(itens.length, 8)   // 3 por autor (×2) + 2 pelo réu
  assert.ok(itens.some(i => /AUTOR UM: documento/.test(i.texto)))
  assert.ok(itens.some(i => /AUTOR DOIS: documento/.test(i.texto)))
  assert.ok(itens.some(i => /AUTOR DOIS: endereço com CEP/.test(i.texto)))
  assert.ok(itens.some(i => /AUTOR DOIS: representado por advogado/.test(i.texto)))
})

test('checarQualificacao: autor sem advogado → aviso de jus postulandi (⚠️, não erro)', () => {
  const partes = [
    { polo: 'ativo', nome: 'AUTOR SÓ', documento: '1', tipoDocumento: 'CPF', endereco: { nroCep: '1' }, representantes: [] },
    { polo: 'passivo', nome: 'RE', documento: '9', tipoDocumento: 'CNPJ', endereco: { nroCep: '2' }, representantes: [] }
  ]
  const adv = checarQualificacao(partes).find(i => /jus postulandi/.test(i.texto))
  assert.ok(adv)
  assert.equal(adv.marca, '⚠️')
})

test('checarQualificacao: partes vazias → único item de correção (fail-closed, não silêncio)', () => {
  const itens = checarQualificacao([])
  assert.equal(itens.length, 1)
  assert.match(itens[0].marca, /CORREÇÃO NECESSÁRIA/)
})

test('checarQualificacao: sem réu → item "Nenhuma parte no polo passivo"', () => {
  const partes = [{ polo: 'ativo', nome: 'A', documento: '1', tipoDocumento: 'CPF', endereco: { nroCep: '1' }, representantes: [{ tipo: 'ADVOGADO' }] }]
  assert.ok(checarQualificacao(partes).some(i => /Nenhuma parte no polo passivo/.test(i.texto)))
})

test('localizarPlanilha: nenhum anexo casa → { planilha: null, aviso: null }', () => {
  const r = localizarPlanilha([{ tipo: 'Procuração', titulo: 'procuração' }, { tipo: 'Documento Diverso', titulo: 'foto do crachá' }])
  assert.equal(r.planilha, null)
  assert.equal(r.aviso, null)
})

test('localizarPlanilha: lista vazia → { planilha: null, aviso: null }', () => {
  const r = localizarPlanilha([])
  assert.equal(r.planilha, null)
  assert.equal(r.aviso, null)
})

test('montarMarkdown: processo sem planilha → Seção 4 informa "não localizada" (não silencia)', () => {
  const d = dossieFixture()
  d.resumoMarkdown = null
  d.avisoPlanilha  = null
  assert.match(montarMarkdown(d), /não localizada ou não legível/)
})

test('montarMarkdown: ausência de planilha CONFIRMADA na triagem → mensagem limpa, sem "não legível"', () => {
  // 4ª camada (humano no loop): quando o usuário confirma que não há planilha, a Seção 4
  // afirma a ausência de forma limpa — não repete o alarme de "não localizada ou não legível".
  const d = dossieFixture()
  d.resumoMarkdown = null
  d.avisoPlanilha  = null
  d.ausenciaPlanilhaConfirmada = true
  const md = montarMarkdown(d)
  assert.match(md, /ausência confirmada manualmente/i)
  assert.doesNotMatch(md, /não localizada ou não legível/)
})

// ── montarTextoPagina: junção posicional dos text items do pdf.js ───────────

test('montarTextoPagina: vão horizontal pequeno cola a palavra fatiada pelo pdf.js', () => {
  const itens = [
    { str: 'fund', x: 0, y: 700, largura: 20 },
    { str: 'amentos', x: 20.3, y: 700, largura: 40 }
  ]
  assert.equal(montarTextoPagina(itens), 'fundamentos')
})

test('montarTextoPagina: vão horizontal maior insere espaço (fronteira real de palavra)', () => {
  const itens = [
    { str: 'pelos', x: 0, y: 700, largura: 25 },
    { str: 'fatos', x: 29, y: 700, largura: 25 }
  ]
  assert.equal(montarTextoPagina(itens), 'pelos fatos')
})

test('montarTextoPagina: vão negativo (sobreposição) também cola, sem espaço', () => {
  const itens = [
    { str: 'Reclamante', x: 0, y: 700, largura: 60 },
    { str: ':', x: 59.5, y: 700, largura: 5 }
  ]
  assert.equal(montarTextoPagina(itens), 'Reclamante:')
})

test('montarTextoPagina: Y diferente além da tolerância vira quebra de linha, não espaço', () => {
  const itens = [
    { str: 'linha um', x: 0, y: 700, largura: 40 },
    { str: 'linha dois', x: 0, y: 685, largura: 40 }
  ]
  assert.equal(montarTextoPagina(itens), 'linha um\nlinha dois')
})

test('montarTextoPagina: não duplica espaço quando o item já termina/começa com um', () => {
  const itens = [
    { str: 'pelos ', x: 0, y: 700, largura: 28 },
    { str: 'fatos', x: 32, y: 700, largura: 25 }
  ]
  assert.equal(montarTextoPagina(itens), 'pelos fatos')
})

test('montarTextoPagina: itens fora de ordem são reordenados por Y (desc) e X (asc)', () => {
  const itens = [
    { str: 'dois', x: 0, y: 685, largura: 30 },
    { str: 'um', x: 0, y: 700, largura: 20 }
  ]
  assert.equal(montarTextoPagina(itens), 'um\ndois')
})

test('montarTextoPagina: itens com str vazia são ignorados', () => {
  const itens = [
    { str: 'a', x: 0, y: 700, largura: 10 },
    { str: '', x: 15, y: 700, largura: 0 },
    { str: 'b', x: 30, y: 700, largura: 10 }
  ]
  assert.equal(montarTextoPagina(itens), 'a b')
})

test('montarTextoPagina: lista vazia devolve string vazia', () => {
  assert.equal(montarTextoPagina([]), '')
})
