# Bolões — correção e compartilhamento público

- [x] Exibir PLANNED publicamente como Planejado; separar vinculados de apostas confirmadas.
- [x] Criar vínculo atômico em massa com validação integral de dono, modalidade, concurso e duplicidade.
- [x] Implementar seleção compacta em massa, seleção total, busca e contador dinâmico.
- [x] Criar links públicos independentes para Participantes, Jogos e Visão completa.
- [x] Restringir o payload público no banco conforme o escopo do token.
- [x] Atualizar gestão, mensagens e página pública para cada visão.
- [x] Cobrir 1/19/50/100 jogos, cenário real, segurança e responsividade.
- [x] Rodar testes, typecheck, build e sonda de integridade; documentar limitações.

## Ajuste final aprovado

- [x] Exibir PLANNED publicamente como Planejado nos escopos Jogos e Completo.
- [x] Separar jogos vinculados de apostas confirmadas nos resumos públicos.
- [x] Implementar alteração manual atômica de situação em massa.
- [x] Impedir situações exclusivas da conferência e validar ownership/transições.
- [x] Reproduzir o cenário real dos 19 jogos antes e depois da alteração.
- [x] Rodar testes, typecheck e validação responsiva.

## Correção funcional e UX de homologação

- [x] Cancelar o bolão antigo pelo fluxo oficial e preservar todo o histórico.
- [x] Unificar a classificação de vínculo dos jogos pela relação real em `pool_games`.
- [x] Impedir seleção de jogos já vinculados ou incompatíveis antes do envio.
- [x] Alinhar consultas, contadores e invalidações das telas privada e pública.
- [x] Reorganizar o compartilhamento com prévia e mensagens baseadas em dados reais.
- [x] Refinar os três tipos de página pública sem ampliar o payload.
- [x] Validar cenário real, seis resoluções, testes e tipos; acesso cruzado permanece protegido pelas regras existentes.
- [x] Entregar relatório final de 28 itens e aguardar homologação.

## Refinamento do compartilhamento e relatório PDF

- [x] Corrigir textos e unificar resumos de Participantes, Jogos e Completo.
- [x] Separar cancelamento, indisponibilidade e falha do compartilhamento nativo.
- [x] Gerar PDF administrativo completo somente sob demanda e sem armazenamento.
- [ ] Validar privacidade, cenário real, seis resoluções, PDF, testes, tipos e build.
- [ ] Entregar relatório final de 33 itens e aguardar homologação.
