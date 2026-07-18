# E-Carta em lote

Uma tabela (exportável em CSV) com os objetos, status de entrega, destinatário e datas de vários processos consultados de uma vez no E-Carta — no lugar de consultar processo por processo.

## O que faz

Recebe uma lista de números de processo; consulta cada um na tela do E-Carta em segundo plano; percorre a paginação automaticamente; reúne os objetos encontrados num relatório; exporta a tabela em CSV.

## Como usar

1. Abra a tela de **consulta de processos** do E-Carta.
2. Clique no botão flutuante **📮 E-Carta em lote** (canto inferior direito) — ou acione pelo popup da extensão.
3. Cole os números dos processos, **um por linha**, e clique em **Consultar**.
4. A consulta roda em segundo plano (a tela não muda) e, ao final, abre um relatório com todos os objetos encontrados.
5. Clique em **Extrair Tabela (.csv)** para baixar.

Dá para **cancelar** a consulta no meio — o relatório então mostra só o que já foi consultado até ali.

## Como funciona

O E-Carta é um sistema à parte do PJe, com telas próprias de consulta. Manualmente, você digita um processo, pesquisa, lê o resultado, e repete. A extensão faz exatamente essa mesma pesquisa que a tela faz — só que **em segundo plano e em série**, para uma lista inteira, sem recarregar a página. A paginação (quando um processo tem muitos objetos) é percorrida automaticamente.

Decisões que moldaram a forma atual:

- **Não navegar nem recarregar** — rodar a consulta por baixo, para que a tela do usuário não fique piscando a cada processo.
- **Ir com calma** — consultar em pequenos grupos, com pequenas pausas entre as requisições, para não sobrecarregar o servidor com uma rajada.
- **Cancelamento cooperativo** — um lote grande pode ser interrompido a qualquer momento, sem perder o que já foi coletado.
- **Todo dado que volta do servidor é tratado como texto** ao montar o relatório e o CSV (nada é interpretado como HTML), o que evita surpresas com conteúdo inesperado.

### Método de estudo

Como não encontrei uma API pronta para consulta em lote, **inspecionei** o que a tela de consulta do E-Carta envia ao servidor quando pesquiso — e reproduzi essa mesma requisição, reaproveitando a sua sessão já autenticada. A extensão não faz nada que a página não faça: repete a mesma chamada, só que muitas vezes e de forma organizada.

## Adaptação a outros tribunais ou contextos

O E-Carta é um sistema de integração com os Correios usado nacionalmente, mas a forma de conversar com ele depende de **detalhes da tela específica** (a tecnologia de formulário que ele usa, os identificadores dos campos e da tabela de resultados, o token de estado da página). Esses detalhes podem variar entre versões e instalações.

Ao portar, o caminho é o mesmo do estudo original: **inspecionar a sua tela de consulta do E-Carta**, ver quais parâmetros ela envia ao pesquisar e ajustar os identificadores e o formato da requisição para casá-los. A técnica geral — repetir, em série, a pesquisa que a própria página faz — vale onde o E-Carta for a mesma plataforma; o que muda são os nomes dos "botões e campos" que ela usa por baixo.

## Limitações

- Exige estar **logado no E-Carta**. Se a sessão expirar durante o lote, a consulta acusa e para.
- Depende da estrutura da tela de consulta; mudanças grandes nessa tela podem exigir ajuste.
- Há **limites conservadores** (quantidade de páginas e de campos por grupo) para não abusar do servidor — listas muito grandes são processadas em vários grupos.
