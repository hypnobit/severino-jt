# Por que cada permissão é pedida

A extensão pede o mínimo necessário para cada ferramenta funcionar. Nenhuma permissão é decorativa — cada uma existe porque uma ferramenta específica depende dela.

| Permissão | Para quê |
|---|---|
| `*://pje.trt8.jus.br/*` | Injetar os content scripts nas páginas do PJe (Histórico, Tema escuro, E-Carta em lote, atalho da Triagem) e fazer `fetch` autenticado à API interna do PJe a partir das páginas próprias da extensão (Triagem) — a sessão do usuário (cookies) só é enviada porque o domínio consta aqui. |
| `storage` | Persistir localmente (`browser.storage.local`) o registro do dia (Histórico), a preferência de tema escuro e o aceite do termo de consentimento. Nada disso sai do navegador. |
| `webRequest` | O background script observa o tráfego do **PJeOffice** (o assinador local) para detectar o momento de uma assinatura — é o único jeito de saber que algo foi assinado, já que o PJeOffice não avisa por outro canal. |
| `*://localhost/*` e `*://127.0.0.1/*` | Escopo necessário para o `webRequest` acima: o PJeOffice roda localmente e responde em `localhost:8800`. A extensão só observa esse tráfego (nunca modifica), e nunca decodifica o token de sessão que passa por ali. |
| `tabs` | O popup lê a URL da aba ativa para saber se você está numa página de processo ou na tela do E-Carta (e habilitar/desabilitar botões de acordo), e abre as páginas próprias da extensão (Triagem, Extrator, Relatório) em nova aba. |

Não há permissão de rede ampla (`<all_urls>`) nem acesso a outros domínios além do PJe configurado e do `localhost`. Ver a diretriz de privacidade no [README](../README.md).
