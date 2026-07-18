# Usando em outro TRT ou contexto similar

A extensão vem configurada para o TRT da 8ª Região (`pje.trt8.jus.br`), onde foi desenvolvida e testada. Este documento reúne o que é preciso saber para adaptá-la a outro regional — ou a um contexto semelhante — e, principalmente, **o que esperar** ao fazê-lo.

Presume-se que quem for adaptar tem qualificação técnica para editar os arquivos do projeto.

## Princípio: privilégio mínimo

Resolvi que a extensão pede permissão **apenas para o domínio do PJe do TRT8**. Tal decisão se baseia pura e simplesmente no fato de apenas ter sido testada nesse domínio. Portanto, não vi sentido em deixar um sistema mais amplo de permissão. Porém, nada impede que, ao implementar em outro contexto, o usuário, por questões de praticidade, utilize um `<all_urls>`, por exemplo.

Consequência dessa decisão é que **não há suporte automático a todos os regionais**: cada domínio precisa ser declarado.

## Os pontos a alterar

Para apontar a extensão para o seu PJe, altere o domínio em **dois arquivos**:

1. **`manifest.json`** — as ocorrências de `pje.trt8.jus.br` (nas permissões e nas regras de `content_scripts`).
2. **`lib/api.js`** — a constante `BASE`.

O restante do código é **agnóstico de host**: ou casa por caminho de URL (a página do processo, a tela do E-Carta) ou deriva o endereço do próprio contexto em que está rodando.

## Versões do PJe

Os testes e implementações foram realizados na versão atual do PJe adotada pelo TRT8, 2.19.2 — CARAÚBA. Caso implemente em outro regional, ou contexto semelhante, deve-se observar o comportamento caso seja utilizado em outra versão do PJe. Os comportamentos usados aqui foram observados no TRT8 e podem variar.

A portabilidade não é igual entre as ferramentas. Da mais simples de portar para a mais delicada:

| Ferramenta | Esforço de adaptação | Por quê |
|---|---|---|
| **Extrator de cálculo** | Mínimo | Só lê um arquivo que você fornece; não fala com o servidor. |
| **Tema escuro** | Baixo | Usa o pdf.js, componente padrão; basta conferir o endereço do visualizador. |
| **Histórico do dia** | Baixo a médio | A parte do PJeOffice é bem portável; a detecção de consulta depende do padrão de URL. |
| **E-Carta em lote** | Médio | Depende dos detalhes da tela de consulta do E-Carta (campos, identificadores). |
| **Triagem inicial** | Alto | Depende do formato dos dados do processo e de regras gerais do Direito do Trabalho, além de entendimentos específicos adotados por cada magistrado. |

Cada doc em [`docs/ferramentas/`](ferramentas/) traz uma seção **"Adaptação a outros tribunais ou contextos"** com o que conferir naquela ferramenta específica.

## O método, quando algo não casar

O jeito de descobrir por que uma ferramenta não funciona no seu PJe é o mesmo que originou a extensão: **inspecionar o sistema em funcionamento** (as ferramentas de desenvolvedor do navegador) e observar como ele se comporta — que endereço tem a tela, o que o formulário envia ao servidor, como a página muda ao abrir um processo. A extensão sempre se acopla a sinais que **já existem**; adaptá-la é remapear esses sinais para os do seu ambiente.

Se descobrir divergências no seu regional, considere **relatar numa issue** — ajuda quem vier depois.
