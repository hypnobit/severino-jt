# Extrator de cálculo

O conteúdo do Resumo do Cálculo do PJe-Calc, tabela por tabela, exportado em **CSV** ou **Markdown**.

## O que faz

Lê um PDF do Resumo do Cálculo do PJe-Calc; localiza as tabelas do resumo; estrutura o conteúdo em linhas e colunas; exporta em CSV (por tabela) ou Markdown (o cálculo completo).

## Como usar

1. Abra a página do **Extrator** pelo popup da extensão.
2. **Arraste e solte** um (ou vários) PDF do Resumo do Cálculo na área indicada — ou clique para escolher o arquivo.
3. Clique em **Processar**.
4. Para cada PDF, aparece uma prévia das tabelas encontradas. Baixe o **CSV** de cada tabela ou o **Markdown** completo do cálculo.

## Como funciona

A ferramenta é uma **página própria da extensão**, separada do PJe: você entrega um arquivo a ela, e ela faz todo o trabalho ali mesmo, sem depender do servidor. Ela lê o PDF, localiza as tabelas do Resumo do Cálculo e as reorganiza em linhas e colunas prontas para exportar.

Decisões que moldaram a forma atual:

- **Ser uma página que recebe um arquivo**, e não algo embutido nas telas do PJe — porque o insumo é um PDF que você fornece, não uma tela específica do sistema.
- **Trazer o leitor de PDF junto** (a biblioteca pdf.js, embarcada na extensão), em vez de buscar algo externo — a leitura acontece localmente, no seu navegador.
- **Prévia enxuta, exportação completa** — a tela mostra as primeiras linhas de cada tabela para conferência rápida; o arquivo baixado contém tudo.

### Método de estudo

Aqui **estudei o layout do PDF** do Resumo do Cálculo do PJe-Calc — como suas tabelas são organizadas — para mapear esse conteúdo em linhas estruturadas. Não há consulta a servidor nem inspeção de tela do PJe: o estudo é do **documento**.

## Adaptação a outros tribunais ou contextos

Esta é a ferramenta **menos dependente do tribunal**: ela não fala com o servidor do seu PJe nem com nenhum domínio específico — só lê um arquivo que você fornece. Não há endereço nem sessão para adaptar.

O que ela pressupõe é o **formato do relatório do PJe-Calc**. Como o PJe-Calc é uma ferramenta de abrangência nacional, o Resumo do Cálculo tende a ter o mesmo formato entre regionais — o que favorece a portabilidade. Se a sua versão do PJe-Calc gerar o Resumo com um layout diferente, o único ponto a ajustar é a **leitura das tabelas**, para casar com esse layout. Fora isso, a ferramenta funciona igual em qualquer contexto.

## Limitações

- Espera o **PDF de texto** do Resumo do Cálculo do PJe-Calc. Um PDF que seja apenas imagem digitalizada (sem texto embutido) não pode ser lido dessa forma.
- A leitura das tabelas é afinada para o layout observado do relatório; formatos muito diferentes podem trazer tabelas vazias ou marcadas para conferência.
