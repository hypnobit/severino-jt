# Tema escuro

Dois temas para o visualizador de PDF do PJe — um escuro e um claro com tom de papel envelhecido — para leituras longas com menos cansaço visual.

## O que faz

Aplica um filtro de cor (e, no tema escuro, um fundo escuro) sobre o visualizador de PDF do PJe; reaplica o tema escolhido às páginas conforme você rola o documento.

## Como usar

Abra o **popup da extensão**, escolha um dos temas e abra (ou volte para) um documento no visualizador de PDF do PJe. O tema é aplicado na hora e vale para as próximas páginas do documento.

Temas disponíveis:
- **Sépia Escuro** — inverte o PDF (fundo escuro, texto claro), com tinta sépia.
- **Papel Envelhecido** — claro, não inverte; só afasta o branco puro do papel com sépia parcial e brilho/contraste levemente reduzidos, para descanso da vista sem virar modo escuro.

## Como funciona

O visualizador de PDF não é texto na página — cada página é desenhada como imagem. Não dá, portanto, para "trocar a cor da fonte". O caminho é aplicar um **filtro de cor** por cima da página, de modo que o branco do papel vire escuro e o texto preto vire claro no tema escuro (inversão), ou apenas ganhe um tom quente no tema claro (sem inversão), preservando a legibilidade.

Duas decisões moldaram a forma atual:

- **Cada tema é uma estratégia intercambiável** — um par "fundo + filtro". Adicionar um novo preset é acrescentar uma linha, sem mexer na lógica.
- **Só CSS, sem ficar vigiando a página.** O filtro é escrito de um jeito que já alcança as páginas atuais e as que forem sendo desenhadas conforme você rola o documento — sem precisar de um observador ativo repetindo trabalho.

Se um preset é removido em um update (como aconteceu com os quatro temas descontinuados na v0.1.3), quem tinha aquela chave salva não fica com o tema silenciosamente desativado: `background.js` migra `pjt_tema` para um fallback válido (`helpers.migrarTema`) no `onInstalled` do próprio update.

### Método de estudo

O visualizador de PDF do PJe é o **pdf.js**, o mesmo componente de código aberto da Mozilla usado em muitos lugares. Inspecionei como ele monta a página e percebi que cada página vira um elemento de imagem previsível — e é sobre esse alvo que o filtro é aplicado. A extensão não altera o PDF nem o visualizador; só sobrepõe estilo.

## Adaptação a outros tribunais ou contextos

Esta é uma das ferramentas **mais portáveis**. Por usar o pdf.js (um componente padrão e amplamente adotado), há boa chance de outro tribunal exibir os PDFs do mesmo jeito. Ao portar, dois pontos a conferir:

- **O endereço do visualizador** — a extensão só age na página do visualizador de PDF; é preciso apontar para o caminho equivalente no seu PJe.
- **A estrutura da página do PDF** — confirmar que as páginas são desenhadas como imagem (o padrão do pdf.js). Se for a mesma base, o filtro funciona sem mudança.

Fora do PJe, a mesma técnica serve para qualquer visualizador baseado em pdf.js.

## Limitações

- É um **filtro de cor**, não um redesenho: cores e imagens dentro do PDF também são invertidas, o que pode deixar figuras com aparência estranha. Para leitura de texto, é o esperado.
- Atua **apenas no visualizador de PDF**, não no restante da interface do PJe. O motivo é que já existem ferramentas disponíveis que deixam a interface do PJe no modo escuro, como o Dark Reader. Porém, o Dark Reader não alcança o leitor de PDF do PJe, portanto esse é apenas um extensor do que o Dark Reader já faz.
