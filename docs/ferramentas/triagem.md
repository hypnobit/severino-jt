# Triagem inicial

Um **dossiê do processo** — partes, rito, documentação obrigatória, cálculo e texto da petição inicial — organizado para **conferência humana** na triagem, com uma **versão mascarada** para quem optar por apoio de IA.

## O que faz

Consulta os metadados do processo via API; tenta identificar a planilha de cálculos no formato PJe-Calc e, se a encontrar, extrai o resumo do cálculo; lista os anexos da petição inicial; extrai o texto completo da petição inicial.

## Como usar

1. Quando o processo estiver na tarefa **Triagem Inicial**, aparece um botão flutuante **📋 Dossiê de triagem** (canto inferior esquerdo). Também dá para abrir pelo popup.
2. A extensão reúne os dados do processo e apresenta o dossiê em uma página própria.
3. Alterne entre os modos **Completo** (uso interno) e **Mascarado** (para IA), veja a prévia, e use **Copiar texto** ou **Baixar .md**.

O dossiê alimenta um **protocolo de triagem em 5 passos** (qualificação, requerimentos especiais, pedidos × cálculo, rito e documentação obrigatória).

## Como funciona

A Triagem é uma **página própria da extensão** que, a partir do processo aberto, lê os mesmos dados que o PJe já lhe mostra (partes, documentos, anexos, cálculo) usando a sua sessão autenticada, e os organiza segundo o roteiro da triagem. Onde consegue, ela cruza informações — por exemplo, casa o número do cálculo impresso no PDF com o anexo correspondente.

Alguns princípios moldaram a forma atual:

- **Afirmar existência, nunca conformidade.** O dossiê diz "há procuração anexada", jamais "a procuração está correta". Tudo que não é 100% determinístico sai rotulado como *provável* e **pede confirmação humana**. Falsa confiança é pior que checagem nenhuma.
- **O humano fecha o laço.** Em pontos sensíveis — como identificar a planilha de cálculo quando ela foi anexada com nome genérico, ou aparar o texto da inicial no modo mascarado — a ferramenta sugere e o usuário confirma.
- **Mascarar removendo região densa em dados pessoais**, não campo a campo. No modo Mascarado, a qualificação das partes (CPF, endereço) é omitida e nomes viram iniciais — é mais seguro remover o bloco do que tentar caçar cada dado.

### Método de estudo

**Inspecionei como o PJe monta a visão de um processo** — de onde vêm as partes, os documentos, os anexos — para ler esses mesmos dados de forma programática, com a sua sessão já autenticada, e remontá-los no formato do dossiê. A extensão não acessa nada que você já não possa ver; ela apenas junta e organiza o que está espalhado por várias telas.

## Adaptação a outros tribunais ou contextos

Esta é a ferramenta **mais sensível ao tribunal** — e a que exige mais cuidado ao portar. São dois planos:

- **Leitura dos dados do processo.** Depende da versão do PJe: o formato exato dos dados (como as partes e os anexos vêm estruturados) foi observado no TRT8 e pode diferir em outro regional. Cada suposição precisa ser **reconferida no seu PJe**, não apenas apontada para outro endereço. É um trabalho de campo, não uma troca de configuração.
- **Regras de domínio.** Faixas de rito, tratamento de ente público no polo passivo e a lista de documentos obrigatórios são regras de **direito e processo do trabalho**. Elas devem ser revistas para o seu contexto — inclusive valores que mudam com o tempo (como o teto do rito sumaríssimo, atrelado ao salário mínimo).

Em resumo: as demais ferramentas se adaptam mexendo em poucos pontos; a Triagem se adapta **revalidando cada premissa** — de dados e de direito — no ambiente de destino.

## Limitações

- **Afirma existência, não conformidade.** Um documento listado como presente prova que foi anexado, jamais que seu conteúdo está adequado.
- Checagens não determinísticas saem como **prováveis** e pedem confirmação — por desenho.
- O **mascaramento não tem garantia de estar completo**: o próprio arquivo avisa o que pode ter sobrevivido. **Revise antes de enviar a qualquer IA** (ver o aviso de uso de IA no README).
- Ainda está restrito aos ritos mais comuns da Justiça do Trabalho. As configurações ainda não se adequam a ritos mais específicos, como PAP, Ação Civil Pública e Consignação em Pagamento, por exemplo. É algo a ser implementado.
