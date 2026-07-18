# Severino JT

> Extensão de Firefox (Manifest V2) para o **PJe da Justiça do Trabalho** (TRT).

> 🧪 **Beta (v0.1.0).** As cinco ferramentas estão completas, cobertas por testes e passaram por uma auditoria de segurança de dados inicial. **Nada aqui é perfeito nem definitivo:** o programa está em período de testes, foi exercitado **em um único regional (TRT8), por poucos usuários, ao longo de poucas semanas** — não é software provado em campo entre tribunais. A revisão de segurança é **permanente**, não um selo obtido de uma vez. Trate tudo com cautela: use por sua conta e risco, **confira o resultado antes de confiar nele**, e abra uma issue com o que encontrar de errado. Abrir para teste mais amplo é justamente o propósito deste beta.
>
> Pontos que ainda não rodaram em processo real (só travados por teste): iniciais em HTML (todas as observadas são PDF), alguns tipos de anexo e a busca frouxa da planilha de cálculo. A parte menos rodada é o **mascaramento de PII da triagem para IA** — é *best-effort* e exige revisão humana (ver abaixo).

Projeto pessoal onde reúno alguns scripts que criei para aprimorar minha rotina de secretário de audiência, encapsulados nessa extensão.

Surgiu da necessidade de automatizar tarefas repetitivas do dia a dia de Vara do Trabalho que não são cobertas pelo **+PJe** nem pelo **AVJT**.

Vem configurado para o TRT da 8ª Região (`pje.trt8.jus.br`), onde foi desenvolvido e testado.

## Ferramentas

### Histórico do dia
Registra os processos consultados e os documentos assinados (via PJeOffice) ao longo do dia, e gera um relatório do que passou pelas suas mãos.

Para mais detalhes técnicos: [docs/ferramentas/historico.md](docs/ferramentas/historico.md)

### Tema escuro
Aplica um tema escuro ao visualizador de PDF do PJe, para leituras longas com menos cansaço visual.

Para mais detalhes técnicos: [docs/ferramentas/tema-escuro.md](docs/ferramentas/tema-escuro.md)

### E-Carta em lote
Consulta vários processos de uma vez no E-Carta e exporta o resultado em CSV, evitando a consulta um a um.

Para mais detalhes técnicos: [docs/ferramentas/ecarta-lote.md](docs/ferramentas/ecarta-lote.md)

### Extrator de cálculo
Lê o *Resumo do Cálculo* do PJe-Calc a partir de um PDF (arraste e solte) e exporta o conteúdo em CSV ou Markdown.

Para mais detalhes técnicos: [docs/ferramentas/extrator.md](docs/ferramentas/extrator.md)

### Triagem inicial
Monta um dossiê do processo (partes, rito, documentação obrigatória, cálculo e texto da inicial) para conferência humana na triagem — inclusive uma versão mascarada, para quem optar por apoio de IA.

Para mais detalhes técnicos: [docs/ferramentas/triagem.md](docs/ferramentas/triagem.md)

## ⚠️ Uso de Inteligência Artificial

O dossiê da **Triagem** pode conter **dados pessoais sensíveis** — CPF, endereço e às vezes dados de saúde das partes. A extensão **não** envia nada para nenhuma IA: qualquer envio é **ato manual seu**.

Antes de colar um dossiê em qualquer IA externa, observe a **Resolução CNJ nº 615/2025**, a **LGPD (Lei nº 13.709/2018)** e eventual **diretriz do seu Tribunal**. Para análise por IA, prefira o botão **"Preparar mascarado (p/ IA)"** da Triagem e **revise o arquivo antes de enviar** — o mascaramento é feito da melhor forma possível, mas não há garantia de que esteja completo.

## Usando em outro TRT

Para utilizar em outro TRT ou contexto similar: [docs/adaptar-outro-trt.md](docs/adaptar-outro-trt.md)

## Instalação

Não há build nem dependências. Para testar durante o desenvolvimento, no Firefox: `about:debugging` → *Este Firefox* → *Carregar extensão temporária* → apontar para `manifest.json`. Instalada assim, a extensão some ao reiniciar o Firefox (ainda não é assinada — a distribuição por instalação permanente está em preparação).

## Permissões

A extensão pede o mínimo necessário — nenhuma permissão é decorativa. Justificativa de cada uma: [docs/permissoes.md](docs/permissoes.md).

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE). O bundle `lib/vendor/pdf.js` é da Mozilla e mantém a sua própria licença (Apache-2.0).
