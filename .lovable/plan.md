# Correção e melhoria de Bolões

## Diagnóstico confirmado

- O bolão real possui 23 participantes e 19 registros persistidos em `pool_games`.
- Os 19 jogos pertencem ao organizador, apontam para o bolão e modalidade corretos e têm concurso 3780; o bolão ainda está sem concurso definido.
- Todos os 19 jogos estão em `PLANNED` (Planejado). Essa situação significa jogo salvo sem comprovação de aposta e permanece fora da publicação.
- A gestão privada já lê os 19 vínculos. A consulta pública usa uma única lista filtrada para contador e itens, portanto ambos mostram zero publicável de forma consistente.
- A causa real é a ausência da distinção entre “vinculado” e “liberado para acompanhamento”, somada a uma mensagem pública que induz a entender que não há vínculos.

## Implementação

### 1. Contadores e comunicação

- Manter `PLANNED` fora da lista pública.
- Exibir na gestão “Jogos vinculados” com todos os vínculos e indicar quantos ainda não aparecem no link público.
- Fazer o retorno público incluir dois agregados seguros: total vinculado e total publicável, sem expor o conteúdo de jogos planejados.
- Quando houver vínculos mas nenhum jogo publicável, explicar que os jogos aguardam confirmação da aposta; não mostrar apenas “0 jogos”.
- Manter contador e lista pública derivados da mesma regra de situações publicáveis.

### 2. Vínculo em massa

- Substituir o vínculo unitário por seleção múltipla compacta, com busca, seleção individual, “Selecionar todos os elegíveis”, contador e botão com singular/plural automático.
- Mostrar número, dezenas e situação de cada jogo, com quebra natural em telas estreitas.
- Criar uma única função transacional `pool_attach_games(pool_id, game_ids[])`.
- Validar no banco, antes de inserir qualquer vínculo: organizador, lista não vazia/sem repetições, propriedade de todos os jogos, modalidade, concurso, situação do bolão e ausência de vínculo prévio ou com outro bolão.
- Falhar a operação inteira se qualquer item for inválido; registrar um único evento de lote sem IDs no retorno público.

### 3. Três links públicos protegidos

- Criar uma tabela de links públicos com um vínculo ativo por bolão e escopo: `PARTICIPANTS`, `GAMES` e `FULL`.
- Gerar tokens aleatórios independentes no banco; migrar o link antigo ativo, quando existir, para `FULL` para preservar endereços já compartilhados.
- Criar, regenerar e revogar cada tipo em uma única transação e sem afetar os demais.
- Manter a URL apenas como `/b/{token}`. O tipo não será parâmetro de URL nem dado escolhido pelo navegador.
- Resolver o escopo exclusivamente pelo token armazenado no banco. Alterar a URL não amplia acesso: token desconhecido/revogado retorna página indisponível; token válido recebe somente seu payload autorizado.

### 4. Payload mínimo por tipo

- **Participantes:** identificação básica, cotas públicas e participantes ativos com pagamento integral; nome, cotas e situação pública “Pago”. Sem jogos ou resultado.
- **Jogos:** identificação básica, agregados de jogos, jogos publicáveis e resultado oficial permitido. Sem participantes ou dados financeiros individuais.
- **Completo:** união apenas dos campos públicos dos dois tipos, mais o resumo público do bolão.
- Permanecem excluídos telefone, e-mail, observações, comprovantes, IDs internos, ajustes, pagamentos individuais, documentos, filtros, pesos, snapshots e hashes.

### 5. Compartilhamento e página pública

- Atualizar o diálogo para escolher o conteúdo antes de compartilhar e mostrar o estado dos três links.
- Permitir criar, copiar, compartilhar, regenerar e desativar cada tipo separadamente, preservando compartilhamento nativo, WhatsApp e cópia.
- Usar mensagens específicas para Participantes, Jogos e Visão completa.
- Renderizar somente as seções presentes no payload recebido.
- Manter listas compactas e progressivas, deixando explícito o total; adicionar busca de jogos por número quando o volume justificar.

## Validação

- Testes de regra pública, payload por escopo, URL adulterada, token revogado e regeneração independente.
- Testes do lote: sucesso atômico, duplicidade, incompatibilidade, propriedade e usuário A × usuário B.
- Testes das listas com 1, 19, 50 e 100 jogos.
- Reproduzir o bolão real: 23 participantes, cota de R$ 60 e 19 jogos vinculados; validar a situação Planejado sem publicá-los indevidamente.
- Validar as três visões e o cenário com jogos já publicáveis.
- Conferir visualmente 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, sem rolagem horizontal.
- Rodar toda a suíte, verificação de tipos, build e sonda de integridade de pagamentos/cotas.
- Não alterar pagamentos, rateio, cotas, conferência, geração, pesos, estatísticas ou outras áreas homologadas.
