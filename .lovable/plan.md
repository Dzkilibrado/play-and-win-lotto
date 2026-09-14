# Correção estrutural de falsos estados vazios

## Diagnóstico confirmado

- A Home transforma `pools.data` indefinido em `[]`, mas hoje seu ramo visual só é seguro enquanto a consulta está realmente marcada como carregando.
- As consultas privadas principais usam chaves genéricas, como `pools/home-summary`, `pools/all`, `games`, `game-status-counts` e `check-summary`, sem a identidade do usuário.
- O cache global considera esses dados atuais por 60 segundos. Após uma troca ou perda de sessão, uma resposta vazia anterior pode ser reutilizada como sucesso para outra sessão, sem nova consulta imediata. Assim, o estado transitório/cacheado vira indevidamente “Nenhum bolão ativo”.
- O cache é limpo apenas pelo botão normal de sair. Encerramento remoto, expiração, troca de conta ou outro evento de autenticação não têm a mesma proteção.
- A rota protegida já valida a identidade antes de abrir a Home; porém componentes também resolvem a sessão separadamente, criando fontes de identidade concorrentes.
- O falso “Bolão não encontrado” anterior pertencia à mesma classe de falha — dados privados consultados/reutilizados fora de um ciclo autoritativo estável — embora o detalhe já tenha sido corrigido para buscar diretamente pelo ID e separar carregamento de ausência real.
- No banco, “Bolão Galera Gmill” existe, está `AWAITING_DRAW`, não está arquivado e possui 23 participantes ativos. A regra atual da Home considera ativo todo bolão cujo status não seja `FINISHED` nem `CANCELLED`; hoje ela não exclui arquivados, ao contrário das listagens operacionais.

## Implementação

1. **Uma identidade autenticada por tela**
   - Usar o usuário já validado pela rota protegida como fonte única da área autenticada.
   - Disponibilizar essa identidade em um contexto compartilhado, removendo resoluções independentes de sessão nas páginas protegidas afetadas.
   - Não iniciar consultas privadas antes de existir um `user.id` validado.

2. **Cache privado isolado por usuário**
   - Criar uma convenção central de chaves privadas com `user.id` para bolões, jogos, contadores, conferências, preferências e demais dados pessoais auditados.
   - Atualizar consultas e invalidações para a mesma convenção, mantendo chaves públicas separadas.
   - Limpar/cancelar dados privados em `SIGNED_OUT` e em troca de identidade, inclusive fora do botão normal de logout.
   - Após login confirmado, invalidar o escopo do usuário atual antes da navegação para a Home.

3. **Estados autoritativos e reutilizáveis**
   - Padronizar a decisão `pending → loading`, `error → erro com retry`, `success + dados → conteúdo`, `success + zero → vazio`.
   - A Home continuará carregando cada bloco independentemente; atalhos permanecem imediatos.
   - “Meus bolões” só exibirá “Nenhum bolão ativo” quando a consulta da sessão atual tiver terminado com sucesso e a lista autoritativa filtrada for zero.
   - Aplicar o mesmo padrão aos falsos vazios confirmados em jogos do bolão, pagamentos, rateio/resultado, métricas dependentes de participantes e jogos conferidos no concurso.

4. **Fonte e regra de bolões consistentes**
   - Centralizar a definição de bolão operacional usado na Home e no grupo “Em andamento”.
   - Considerar na Home apenas bolões não arquivados nos estados `FORMING`, `OPEN`, `CLOSED`, `AWAITING_DRAW` e `AWAITING_CHECK`.
   - A Home continuará consultando diretamente a lista autorizada no banco pelo cliente autenticado; não dependerá de lista parcial ou de outra tela.

5. **Retentativa e invalidação**
   - Configurar retry controlado apenas para falhas transitórias de leitura, sem atrasos artificiais nem recarga integral da página.
   - Preservar erro funcional com “Tentar novamente” após esgotar tentativas.
   - Consolidar invalidações de criação, edição, situação, arquivamento/restauração, exclusão, participantes, pagamentos e jogos vinculados para atualizar Home, hub, lista e detalhe do usuário correto.

## Validação

- Testes unitários do resolvedor de estado garantem que dados indefinidos nunca resultem em vazio.
- Testes de cache verificam isolamento A/B, limpeza em logout/troca de identidade e ausência de reutilização de zero entre contas.
- Testes de consistência garantem que a mesma coleção produza “Em andamento = 1” e Home com um bolão ativo.
- Testes de transição cobrem: sessão pendente, consulta pendente, sucesso com dados, sucesso zero, erro e primeira falha transitória seguida de sucesso.
- Teste não destrutivo confirma “Bolão Galera Gmill” como ativo e visível para a conta autorizada.
- Automação executa pelo menos 20 ciclos equivalentes de login → Home → logout, sem falso vazio nem dados cruzados.
- Navegação normal e refresh direto devem convergir aos mesmos dados.
- Rede lenta deve mostrar skeleton → conteúdo, nunca vazio → conteúdo.
- Validar a Home preservada em 320×568, 360×800 e 390×844, sem trazer Últimos resultados de volta e sem overflow horizontal.
- Executar suíte completa, typecheck e build; registrar limitações reais remanescentes no retorno de 30 itens.

## Fora de escopo

- Nenhuma mudança em regras financeiras, geração, pagamentos, participantes, rateio, comprovantes, PDF, conferência, sincronização ou RLS.
- Nenhuma alteração destrutiva no “Bolão Galera Gmill”.