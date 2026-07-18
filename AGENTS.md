# AGENTS.md — Severino JT

Extensão Firefox para o **PJe da Justiça do Trabalho**, feita para o dia a dia de Vara do Trabalho. Configurada por padrão para o TRT da 8ª Região (`pje.trt8.jus.br`) — onde foi desenvolvida e testada — e adaptável a outros regionais (README, "Usando em outro TRT").

> `BACKLOG.md` e `REGISTRO.md` (histórico de bugs, decisões e achados da API) vivem em `../` — fora deste repositório, só para uso local.

---

## Regras de trabalho (aplicam-se a toda sessão)

**Nunca abrir `lib/vendor/pdf.js` nem `lib/vendor/pdf.worker.js`.** São 1,5 MB de bundle minificado de terceiros (pdf.js da Mozilla). Ler, buscar ou editar esses arquivos queima o contexto sem retorno. Eles são dependência congelada.

---

## Método de trabalho — XP

- **TDD — Red-Green-Refactor.** Toda funcionalidade nova nasce de um teste que falha. Nenhuma feature sem teste. Código legado ainda sem teste recebe **teste de caracterização** antes de ser refatorado (trava o comportamento atual, depois mexe).
- **Small releases.** Todo commit passa no gate (`node --test`). Nunca commitar quebrado "pra consertar no próximo".
- **Refactoring contínuo.** O gerente decide o que extrair e como a interface deveria ser; melhora-se aos poucos, sempre com a rede de testes verde.
- **Integração contínua.** O hook `pre-push` roda a suíte inteira e aborta o push se algo ficar vermelho (ver *Testes e CI*).

---

## Restrições utilizadas na construção do projeto

- **Nunca depender de +PJe (maisPJe) ou AVJT.** São outras extensões instaladas no mesmo navegador. `window.PROCESSO` pode ser lido como tentativa oportunista, jamais como dependência obrigatória — sempre com fallback via API interna do PJe.
- **Manifest V2.** Não migrar para V3 sem decisão explícita.
- **Firefox-first.** Compatibilidade com Chrome é secundária.
- **Sempre `browser.*`, nunca `chrome.*`.**
- **Sem frameworks, sem bundler, sem npm.** JS puro e APIs WebExtensions nativas.
- **A fronteira entre módulos é inviolável** (ver abaixo).
- **Versionamento (`manifest.json`):** **alpha = `0.0.x`**, **beta = `0.x.0`**. **Cada commit bumpa a versão** (um commit = uma versão da extensão) — em alpha, incrementa o patch (`0.0.1` → `0.0.2` → …); a entrada em beta vai para `0.1.0`. O `manifest.json` é a fonte única da versão (nunca hardcodar em UI — ler de `browser.runtime.getManifest().version`).


---

## Arquitetura: três camadas, dependência só para baixo

```
lib/          fundação      — utilitários puros, sem lógica de negócio
core/         infraestrutura — um único componente compartilhado
modules/      negócio       — isolados entre si, auto-inicializáveis
```

**Camada 1 — `lib/`**
Funções puras e facades sobre APIs do browser. Genérica, estável. Todo o projeto pode depender dela; esse acoplamento é aceito conscientemente.

**Camada 2 — `core/context.js`**
Um único `MutationObserver` monitorando mudança de URL na SPA Angular do PJe, e cache do `{ id, numero }` do processo atual. Despacha `CustomEvent('pjetools:contexto')` em `document`. Existe para que cada módulo não instale seu próprio observer nem repita a mesma chamada à API.

**Camada 3 — `modules/`**
Fronteira rígida:
- **Nenhum módulo importa, chama ou conhece outro módulo.**
- Cada módulo consome apenas `lib/` e `core/context.js`.
- Cada módulo se auto-inicializa; não há orquestrador.

**Corolário prático:** se duas coisas precisam da mesma lógica, essa lógica sobe para `lib/` — não vira um módulo que o outro chama. Foi assim que a extração das tabelas do PJe-Calc virou `lib/resumo-calculo.js`, consumida por `pages/extrator.html` e `pages/triagem.html`. O mesmo corolário, aplicado sob TDD, produziu `lib/csv.js`: o escaping de CSV compartilhado por `modules/ecarta-lote.js` e `lib/resumo-calculo.js`.

### Páginas de extensão não são módulos

`pages/*.html` roda em origem `moz-extension://`, carrega scripts via `<script src>` e **pode fazer `fetch` autenticado** ao PJe (cookies vão junto, porque o domínio do PJe está em `permissions`). Confirmado em execução.

É por isso que a Triagem é uma página e não um content script: o `idProcesso` já está na URL da aba, o popup lê `tab.url`, e nenhum bundle de 1,5 MB precisa ser injetado em toda página do PJe.

---

## Mapa de arquivos

```
manifest.json
background/background.js   webRequest em localhost:8800 (PJeOffice) → detecta assinaturas
core/context.js            observer de URL + processo atual
lib/helpers.js             aguardar, dataHoje, timestampAgora, escapar, criarLog
lib/csv.js                 escaparCelula + linha — CSV com blindagem de fórmula (CWE-1236)
lib/consentimento.js       portão de aceite (fail-closed) — consumido por TODO ponto de entrada
lib/api.js                 facade da API REST do PJe + detecção de sessão expirada
lib/resumo-calculo.js      extração das tabelas do PJe-Calc (funções puras)
lib/markdown.js            renderizador de markdown → HTML (escape-first, puro) p/ a prévia da triagem
lib/vendor/pdf.js          NÃO ABRIR — bundle pdf.js
lib/vendor/pdf.worker.js   NÃO ABRIR — worker pdf.js
modules/historico.js       histórico de consultas e assinaturas
modules/dark-theme.js      tema escuro no viewer.html do PJe
modules/ecarta-lote.js     consulta em lote no E-Carta (+ botão flutuante na página do E-Carta)
modules/atalho-triagem.js  botão flutuante quando o processo está na tarefa "Triagem Inicial"
pages/base.css             sistema de design (tokens, reset, body, topo, cartão, main, botões) — compartilhado por triagem/extrator
pages/relatorio.html/.css/.js relatório do histórico do dia (tema próprio, não usa base.css)
pages/extrator.html/.css/.js  extrator standalone de Resumo do Cálculo (drag-and-drop)
pages/triagem.html/.css/.js   dossiê de triagem inicial a partir do idProcesso
pages/consentimento.html/.css/.js  termo de aceite no 1º uso (Concordo / Não concordo→uninstallSelf)
popup/popup.html/.js/.css  menu da extensão
docs/prompt-triagem.md     protocolo de triagem de 5 passos (especificação do domínio)
docs/adaptar-outro-trt.md  como configurar a extensão para outro TRT
docs/permissoes.md         justificativa de cada permissão do manifest.json
docs/ferramentas/          documentação de cada ferramenta, por página
CONTRIBUTING.md            como reportar divergência de TRT e enviar PR
test/*.test.js             testes node:test das funções puras de lib/
scripts/git-hooks/pre-push gate de CI local — roda node --test antes de todo push
```

**Não existe `modules/triagem.js` nem `modules/extrator.js`.** Não criar. As duas funcionalidades vivem em `pages/` e são abertas pelo popup via `browser.tabs.create()`. **`modules/atalho-triagem.js` não viola isso:** é só o ponto de entrada dentro do PJe (botão flutuante que aparece na tarefa "Triagem Inicial", detecção pelo `<span class="texto-tarefa-processo">` do cabeçalho — a URL não muda por tarefa) e pede a abertura ao background via `triagem:abrir_pagina`. Zero regra de negócio.

### Ordem de carregamento

O array `js` de cada `content_scripts` define a ordem: `lib/` antes de `core/`, `core/` antes de `modules/`. Adicionar arquivo novo em `lib/` exige inseri-lo no lugar certo do array, se algum content script o consumir.

**Dependência intra-`lib/`:** `resumo-calculo.js` consome `lib/csv.js`, então `csv.js` carrega antes — no manifest **e** no `<script src>` de `extrator.html`/`triagem.html`. Ordem errada → `PjeTools.csv` indefinido, e `gerarCsv` estoura em runtime.

---

## Consentimento — portão de aceite (fail-closed)

A extensão só opera **após o usuário aceitar** um termo no primeiro uso (acessa dados processuais de terceiros via sessão autenticada). Regra pura em `lib/consentimento.js` (fail-closed: só `aceito === true` **e** `versaoTermo === TERMO_VERSAO`), carregada **antes de `core/`** em todo ponto de entrada — content scripts, background, páginas, popup. `background.js` abre `pages/consentimento.html` no `onInstalled`; recusar dispara `browser.management.uninstallSelf()` (não exige a permissão `management` no Firefox). Mudou o texto do termo → **bumpar `TERMO_VERSAO`**, invalida aceites antigos e força reconsentimento. Storage: `pjt_consentimento = { aceito, versaoTermo, data }`. Travado por `test/consentimento.test.js`.

---

## Testes e CI

`node:test` + `node:assert` — zero dependências, zero `node_modules`. O Node é só ferramental de dev; nunca embarca no `.xpi`. Rodar a suíte na raiz do repo: `node --test` (testes em `test/*.test.js`).

Todo arquivo testável tem um rodapé de export dual (`if (typeof module !== 'undefined' && module.exports) module.exports = ...`) — zero mudança de comportamento no browser, importável no Node.

Gate local: hook `scripts/git-hooks/pre-push` (ativar uma vez por clone com `git config core.hooksPath scripts/git-hooks`) roda `node --test` e bloqueia o push se algo ficar vermelho — garante que nenhum commit quebrado chega ao remoto.

