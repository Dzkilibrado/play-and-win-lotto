# Sincronização adaptativa e levantamento de custo

## Objetivo
Reduzir chamadas desnecessárias à fonte oficial sem perder atualização automática, recuperação após falhas ou conferência de jogos, mantendo os botões administrativos apenas como contingência.

## Diagnóstico confirmado
- O agendamento real é um único `pg_cron` no Lovable Cloud, ativo a cada 15 minutos.
- O job executa uma função PostgreSQL, que usa `pg_net` para chamar `POST /api/public/sync/run` no aplicativo TanStack publicado.
- A rota valida um segredo próprio, consulta o estado persistido das três modalidades, chama a API pública da CAIXA somente quando o estado vence e processa a conferência no servidor.
- Não há Edge Function neste fluxo.
- A configuração fixa representa 96 despertares/dia e cerca de 2.880 em 30 dias. Cada despertar faz uma chamada HTTP interna; chamadas à CAIXA variam de zero a três modalidades, com até três tentativas por requisição e chamadas extras apenas para recuperar concursos atrasados.
- O banco está saudável: 59,1 MB, 60% de memória, 7/60 conexões e nenhum reinício. O job foi criado recentemente, portanto ainda não há 30 dias de histórico real; a primeira execução registrada do `pg_cron` levou cerca de 20 ms para enfileirar a chamada HTTP.

## Estratégia adaptativa
- Manter um único scheduler genérico e barato como mecanismo de recuperação, sem criar um job por modalidade.
- Persistir, por modalidade, o próximo instante de ação e o motivo: saúde, pré-sorteio, publicação, retentativa ou verificação de segurança.
- Antes de qualquer chamada à CAIXA, ler somente o estado local e retornar imediatamente quando nenhuma modalidade estiver vencida.
- Usar a data do próximo concurso fornecida pela CAIXA como fonte principal. O horário oficial persistido prevalecerá quando estiver disponível; a regra central de 21h e domingo às 11h ficará apenas como fallback documentado.
- Período normal: quatro verificações de saúde por dia, distribuídas em horários configuráveis no fuso `America/Sao_Paulo`.
- Pré-sorteio: uma verificação configurável 45 minutos antes para confirmar calendário, concurso e prêmio.
- Pós-sorteio: tentativas rápidas configuráveis a cada 10 minutos durante 60 minutos; depois backoff de 30, 60 e 120 minutos.
- Resultado ainda não publicado será espera funcional, não erro técnico.
- Após sucesso: persistir atomicamente, encerrar tentativas do concurso, atualizar próximo ciclo e executar a conferência pendente.
- Agendar uma verificação de segurança posterior, de baixa frequência, para detectar retificação do mesmo concurso.
- Se houver diferença oficial no mesmo concurso, registrar resumo anterior e novo, não sobrescrever silenciosamente, persistir pela transação existente e enfileirar reconferência.
- Após horas ou dias sem execução, recuperar uma lacuna limitada por ciclo e continuar nos ciclos seguintes até ficar atualizado.

## Banco e segurança
- Evoluir o estado persistente com tipo da próxima ação, última verificação de saúde, última verificação de consistência e referência do concurso a revisar.
- Ajustar as funções de reserva/conclusão para preservar lock, idempotência e concorrência segura.
- Manter a configuração privada do scheduler inacessível a usuários comuns.
- Registrar histórico funcional e alertas administrativos sem expor segredo, resposta HTTP, SQL ou stack trace.

## Aplicativo e painel administrativo
- Manter a rota server e o pipeline CAIXA existentes; o navegador continuará sem consultar ou gravar resultado oficial.
- Preservar “Sincronizar agora”, atualização de recentes, importação histórica e reprocessamento.
- Exibir por modalidade: automação ativa, último concurso/sucesso, próximo concurso/sorteio/verificação, estado e alerta.
- Traduzir o histórico para resultados simples: atualizado, aguardando sorteio, aguardando publicação, sincronizando ou atenção.
- Usuários comuns verão apenas informações funcionais de sorteio e resultado.

## Medição e custo
- Contabilizar separadamente: despertares do scheduler, chamadas internas à rota, consultas externas à CAIXA, gravações e lotes de conferência.
- Comparar o cenário anterior de 2.880 despertares/mês com o novo desenho.
- Estimar consultas externas por modalidade usando o calendário real persistido, as quatro verificações diárias, a janela pré-sorteio, publicação típica e verificação posterior.
- Informar fórmulas e intervalos de custo; valores monetários exatos dependerão do consumo de Cloud do plano Pro. Indicar as métricas do painel: uso de Cloud/compute do banco, tempo de execução server-side, requisições/egress e créditos do período.

## Testes e validação
- Testar dia sem sorteio, pré-sorteio, pós-sorteio, publicação atrasada, sucesso e interrupção imediata.
- Testar saúde, calendário alterado, domingo às 11h, horário excepcional vindo da fonte e fallback de fuso.
- Testar retificação com auditoria e reconferência, sem sobrescrita silenciosa.
- Testar concorrência, idempotência, recuperação após uma semana sem usuários e lacunas acima do limite por ciclo.
- Testar proteção da rota, execução sem sessão, painel e histórico.
- Rodar suíte completa, tipagem e build; conferir o job e o histórico reais no banco.

## Fora do escopo
Não alterar arquivamento/exclusão de bolões, Gerador, Pesos, PDFs, comprovantes, rateio ou UX não relacionada.
