# Confiabilidade de acesso e automação dos resultados

## Objetivo
Consolidar as correções já aplicadas em login, navegação de bolões e Home, e tornar a sincronização e a conferência contínuas no servidor, sem depender de navegador ou administrador.

## O que já existe e será reaproveitado
- Fonte oficial CAIXA, normalização e validação por modalidade.
- Persistência atômica de concurso, dezenas e faixas, com trava por modalidade/concurso e gravação idempotente.
- Trabalhos retomáveis de importação e conferência, com trava e recuperação de execução interrompida.
- Rota protegida `/api/public/sync/run`, segredo interno e botões administrativos que usam o mesmo pipeline.
- Fila automática que encontra jogos pendentes após a importação e atualiza jogos e bolões relacionados.
- Correções já concluídas: sessão válida redireciona antes do Login; autofill não autentica; logout limpa consultas e sessão; detalhe busca pelo identificador e separa carregamento de ausência; Home compacta e Últimos resultados desligado por padrão.

## Automação server-side
- Criar um estado único por modalidade ativa com: automação ativa, último concurso conhecido, próximo concurso esperado, horário previsto em `America/Sao_Paulo`, último início/sucesso/erro, tentativas consecutivas e próxima verificação.
- Usar um único agendamento gerenciado pelo Lovable Cloud para chamar a rota protegida, sem sessão de usuário ou aba aberta.
- Rodar a cada 15 minutos: 96 verificações leves por dia. A rota só consulta a fonte quando uma modalidade estiver vencida ou em retentativa; isso limita chamadas externas, mas mantém o banco ativo com mais frequência e pode aumentar o consumo do Cloud. O atraso máximo normal será de aproximadamente 15 minutos.
- Antes do horário previsto, apenas atualizar o estado local e aguardar. Depois do horário, consultar o concurso esperado; quando ainda não publicado ou houver falha transitória, programar backoff persistente de 15, 30, 60 e até 120 minutos.
- Após sucesso, encerrar as tentativas de N, persistir N+1 e seu prêmio/data, enfileirar e executar a conferência, e registrar a próxima ação.
- Na retomada após indisponibilidade, comparar o último concurso local com o oficial e completar somente a lacuna recente, com limite por execução; nunca reimportar todo o histórico automaticamente.

## Segurança, consistência e falhas
- Preservar o segredo da rota somente no servidor e manter o endpoint inacessível sem autenticação própria.
- Reutilizar a mesma função de execução para chamadas automáticas e para “Sincronizar agora”.
- Manter a trava transacional existente e acrescentar reserva atômica por modalidade para duas execuções simultâneas não consultarem/persistirem o mesmo concurso.
- Exigir número, modalidade, data, quantidade de dezenas, universo, unicidade e faixas oficiais válidas antes de persistir.
- Não alterar dados válidos em falha de rede, indisponibilidade, resultado ainda ausente ou resposta inválida.
- Classificar resultado ainda não publicado como espera, falha transitória como retentativa e dado inválido como atenção administrativa.
- Registrar início, fim, concurso, resultado, tentativas e próxima ação sem guardar segredo ou conteúdo técnico para usuários comuns.

## Atualização do aplicativo
- A Home, Concursos, Resultados e Loterias continuarão lendo o banco local; nenhuma tela consultará a fonte oficial.
- Atualizações no banco alimentarão N+1 imediatamente nas próximas leituras. Nas telas abertas, adicionar atualização leve dos dados funcionais e invalidações após ações manuais; não depender de F5.
- Conferência atualizará jogos e bolões pelo pipeline existente, incluindo situação e premiação quando publicada.
- Estatísticas continuarão derivadas dos concursos persistidos, sem recálculo massivo no navegador.

## Painel administrativo
- Evoluir o painel atual por modalidade para mostrar: Automação ativa, estado em linguagem simples, último concurso, próximo concurso, próximo sorteio, última verificação, último sucesso, próxima tentativa e falhas consecutivas.
- Estados: Atualizado, Aguardando sorteio, Aguardando publicação oficial, Sincronizando e Requer atenção.
- Manter “Sincronizar agora”, atualizações recentes, importação histórica, reprocessamento e conferência como fallback/diagnóstico.
- Mostrar as 20 execuções recentes e alertas persistentes, sem nomes internos, mensagens SQL, resposta HTTP ou stack trace.
- Não oferecer desligamento acidental; automação nasce ativa e usuário comum não vê o painel.

## Testes e homologação
- Cobrir resultado ainda indisponível, resultado disponível, backoff, falha de rede, dado inválido, próximo concurso e recuperação após atraso.
- Cobrir duas execuções simultâneas, reexecução idempotente, trava abandonada e persistência atômica.
- Cobrir disparo automático da conferência e reflexo nos jogos/bolões.
- Cobrir proteção da rota e equivalência entre execução manual e automática.
- Revalidar login, logout, autofill sem clique, navegação/reabertura/refresh do Bolão Galera Gmill e Home compacta.
- Validar 320×568, 360×800, 390×844 e desktop, nos temas disponíveis, sem rolagem horizontal.
- Executar testes completos, verificação de tipos e compilação.
- Após disponibilizar a versão, validar o domínio publicado e confirmar o histórico real do agendamento sem navegador aberto.

## Fora do escopo
Não alterar arquivamento/exclusão de bolões, nova loteria, Gerador, Pesos, rateio, PDFs ou comprovantes.
