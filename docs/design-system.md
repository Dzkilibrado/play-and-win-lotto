# Regras do Design System

## Sem rolagem horizontal (regra global)

Nenhuma tela, componente, diálogo, drawer, tabela, lista, formulário ou página
pública pode exigir rolagem horizontal para leitura ou navegação nos viewports
suportados (320×568, 360×800, 390×844, 768×1024, 1280×720, 1440×900).

Critério objetivo: `document.documentElement.scrollWidth <= clientWidth` no
documento e `scrollWidth <= clientWidth` no container visual de cada modal.

Como cumprir:

- todo container flex/grid que contém texto recebe `min-w-0`;
- ícones e selos fixos recebem `shrink-0`;
- grids de uma coluna usam `grid-cols-[minmax(0,1fr)]` (evita piso de
  `min-content`);
- textos longos usam `truncate`, `break-words` ou `[overflow-wrap:anywhere]`;
- diálogos usam a largura base `w-[calc(100vw-1.5rem)] max-w-*`; nunca largura
  fixa maior que o viewport;
- blocos `pre`/`code` usam `whitespace-pre-wrap` + quebra por caractere e
  `overflow-x-hidden`;
- tabelas no celular viram linhas compactas/cards, nunca `overflow-x-auto`
  com layout de desktop;
- chips de filtro sempre com `flex-wrap`.

Rolagem **vertical** continua normal e necessária.

Exceções: nenhuma hoje. Qualquer exceção futura (por exemplo um carrossel cujo
propósito é a navegação horizontal) deve ser documentada aqui com justificativa.

### Teste de regressão

`python3 scripts/overflow-audit.py` percorre as rotas principais nos seis
viewports, mede `scrollWidth` vs `clientWidth` e imprime os elementos que
excedem o viewport. Deve terminar com `BAD 0`.
