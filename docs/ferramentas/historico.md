# Histórico do dia

Um relatório do dia com os processos que você consultou e os documentos que assinou (via PJeOffice) — tudo o que passou pelas suas mãos, com contextos e horários.

## O que faz

Observa a navegação no PJe e registra cada processo consultado; observa o PJeOffice e registra cada documento assinado; ao final, monta o relatório do dia.

## Como usar

Nada a acionar — funciona sozinho enquanto você navega no PJe:

- **Consultas** são registradas quando você abre um processo.
- **Assinaturas** são registradas quando você assina um documento pelo PJeOffice.

Para ver o relatório do dia, abra o **popup da extensão** e clique em **Relatório do dia**.

## Como funciona

O PJe é uma aplicação de página única (SPA): a URL muda sem recarregar a página. A extensão observa essa troca de URL para saber qual processo está aberto e registrar a consulta.

As **assinaturas** são a parte interessante. O PJe assina documentos por meio do **PJeOffice**, um programa que roda na sua própria máquina e responde em `localhost`. Inspecionando esse tráfego local, dá para perceber o momento exato em que uma assinatura acontece — é esse sinal que a extensão escuta para registrar o evento, sem precisar de nenhuma cooperação do servidor do PJe.

Duas decisões guiaram a forma atual:

- **Registrar só o essencial** (número do processo, contexto e horário) — o suficiente para reconstituir o dia, sem virar um banco de dados.
- **Não filtrar assinatura por usuário.** Numa máquina pessoal, toda assinatura feita pelo PJeOffice local é do próprio dono; adicionar identificação de usuário seria complexidade sem ganho.

### Método de estudo

Como não encontrei API pública para isso, o caminho foi **inspecionar** o sistema em funcionamento (as ferramentas de desenvolvedor do navegador) e observar como ele se comporta: como a URL muda a cada processo aberto e como o PJeOffice conversa com o navegador durante uma assinatura. A extensão apenas se acopla a esses sinais que já existem.

## Adaptação a outros tribunais ou contextos

Esta ferramenta tem duas metades com portabilidade bem diferente:

- **Detecção de assinatura (PJeOffice)** — tende a ser a mais portável. O PJeOffice é o assinador oficial adotado nacionalmente e se comporta de forma parecida entre regionais (roda localmente e é acionado do mesmo jeito). Em outro tribunal que use PJeOffice, essa parte tem boa chance de funcionar com pouca ou nenhuma mudança.
- **Detecção de consulta (URL do processo)** — é a mais sensível à **versão do PJe**. O padrão de URL que identifica "um processo está aberto" pode mudar de um regional para outro. Ao portar, esse é o primeiro ponto a conferir: veja qual é o padrão de URL do seu PJe ao abrir um processo e ajuste a leitura de contexto para casá-lo.

Fora do PJe (outro sistema processual), a ideia geral continua válida — observar a navegação e o momento da assinatura —, mas os dois sinais acima precisariam ser remapeados para os do sistema de destino.

## Limitações

- O registro cobre o **dia corrente** e não é um arquivo permanente — serve para conferência do dia, não como comprovante.
- A detecção de assinatura depende de o PJeOffice estar em uso na máquina. Sem ele (por exemplo, assinatura por outro meio), a assinatura não é registrada.
