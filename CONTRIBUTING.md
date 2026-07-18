# Contribuindo

Severino JT nasceu como uso pessoal, para o dia a dia de uma Vara do Trabalho — e virou público na esperança de ser útil a outros servidores. Contribuições são bem-vindas, com algumas expectativas.

## Reportando divergências de outro TRT ou versão do PJe

O projeto foi desenvolvido e testado só no TRT8 (`pje.trt8.jus.br`). Se você adaptou a extensão para outro regional (veja [docs/adaptar-outro-trt.md](docs/adaptar-outro-trt.md)) e algo não bateu — um campo com nome diferente, um seletor que não casa, um comportamento distinto —, abra uma **issue** com o que observou. Isso é o retorno mais valioso que o projeto pode receber, mesmo sem vir acompanhado de código.

## Enviando uma alteração

- **Sem build, sem bundler, sem npm.** JS puro e APIs nativas do WebExtensions. Se a sua alteração introduz uma dependência ou um passo de build, é provável que não seja aceita — veja a disciplina de simplicidade em [AGENTS.md](AGENTS.md).
- **Teste antes de propor.** A suíte roda com `node --test` na raiz do projeto (zero dependências). Funcionalidade pura nova (em `lib/` ou regras de `pages/*.js`) deve vir com teste; o hook `scripts/git-hooks/pre-push` bloqueia push com suíte quebrada.
- **`browser.*`, nunca `chrome.*`.** O projeto é Firefox-first; compatibilidade com Chrome é secundária.
- Descreva **o que muda e por quê** na descrição do PR — o histórico de decisões do projeto vive em texto, não só em código.

Para entender a arquitetura (as três camadas `lib/`/`core/`/`modules/`, a fronteira entre módulos, convenções de código), leia [AGENTS.md](AGENTS.md) antes de mexer em algo estrutural.

## Licenciamento

O projeto é [MIT](LICENSE). Ao abrir um PR, você concorda que sua contribuição seja licenciada sob os mesmos termos.
