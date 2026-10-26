# Etapa 4 — Recuperação e redefinição de senha

## Escopo
Concluir apenas a recuperação por e-mail e o disparo desse mesmo fluxo por ADMIN. Preservar Perfil → Alterar senha, bloqueio/desbloqueio, papéis, dados pessoais e todos os módulos funcionais. Não iniciar a Etapa 5.

## Diagnóstico confirmado
- Login já tem a entrada visível “Esqueci minha senha”, com páginas `/forgot-password` e `/reset-password`.
- O envio atual usa o domínio aberto no navegador e ignora os erros do provedor, inclusive limite de envio.
- A página de nova senha mistura parâmetros de URL com sessão comum, pode perder o evento de recuperação e trata qualquer falha como link expirado.
- Após a alteração, a sessão permanece aberta; o login pode redirecionar imediatamente para a Home em vez de pedir a nova senha.
- O domínio oficial está permitido nos retornos de autenticação, mas o Site URL padrão ainda aponta ao endereço publicado da Lovable.
- Não há domínio personalizado de envio configurado. Manter os e-mails padrão, sem redesenhar templates.
- Na auditoria atual, as três contas possuem provider e-mail; não há Google-only nem híbrida real para homologação.
- A interface atual exige 8–72 caracteres. O serviço público de configurações não informa a política hospedada completa; não assumir que esses valores comprovam a regra do Auth.

## Fluxo público
1. Preservar Login → Esqueci minha senha → informar e-mail → Enviar instruções.
2. Usar a recuperação oficial do Auth com destino fixo `https://www.gestordasorte.com.br/reset-password`, sem aceitar endereço fornecido pelo cliente.
3. Retornar a mesma mensagem neutra para e-mail existente, inexistente e conta exclusivamente Google, sem revelar cadastro ou método de acesso.
4. Respeitar os limites nativos, impedir envio simultâneo e apresentar feedback amigável de reenvio; não criar infraestrutura paralela de recuperação.
5. Tratar indisponibilidade de envio sem anunciar sucesso confirmado quando o serviço falhar.

## Nova senha
- Manter `/reset-password` pública; exigir uma recuperação efetivamente validada pelo Auth, não apenas `?type=recovery` junto a uma sessão comum.
- Remover a corrida entre processamento do link e leitura do endereço. Consumir o callback oficial sem armazenar ou registrar tokens próprios.
- Exibir Nova senha, Confirmar nova senha e os critérios reais de senha. Confirmar a política hospedada antes de fixar os critérios; não acrescentar complexidade arbitrária.
- Diferenciar confirmação divergente, senha fraca, senha repetida, limite de tentativas e link inválido/expirado/usado.
- Para links sem validade, mostrar “Este link de redefinição não é mais válido.” e “Solicitar novo link”.
- Após sucesso, mostrar “Senha alterada com sucesso.” e “Ir para o Login”, limpar os campos e encerrar a sessão de recuperação.
- Solicitar revogação global das sessões pelo mecanismo suportado. Documentar que a revogação de refresh tokens não implica invalidação instantânea de todos os access tokens já emitidos.
- Não alterar o bloqueio da conta. Se o Auth impedir recuperação de uma conta bloqueada, informar essa limitação sem criar um desbloqueio temporário.

## Administração → Usuários
- Adicionar a ação textual “Enviar redefinição de senha” para contas elegíveis, com confirmação do Design System e mensagem de sucesso prevista.
- Manter e-mail mascarado e dados mínimos. Não oferecer recuperação local para Google-only; aceitar conta híbrida apenas quando houver método local real.
- O navegador envia somente a identificação do alvo. O servidor valida sessão ativa, papel ADMIN e elegibilidade antes de consultar o e-mail necessário ao envio.
- Disparar o mesmo envio oficial de recuperação, sem gerar senha, devolver link secreto ou utilizar uma API que apenas gera um link sem enviá-lo.
- Reutilizar os limites do Auth para os envios administrativos, sem bypass por credencial privilegiada.
- Reutilizar a auditoria existente para `PASSWORD_RESET_REQUESTED_BY_ADMIN`, somente com ator, alvo, ação e timestamp. Não anunciar envio se falhar; distinguir registro da solicitação de comprovação de entrega.
- Preservar as ações da Etapa 3 e organizar as duas ações sem alargar a tabela ou criar navegação exclusivamente por ícone.

## E-mail e configuração hospedada
- Manter o remetente e template padrão do Lovable Cloud nesta etapa. Não configurar SMTP, serviço externo ou novo projeto de templates.
- Confirmar o remetente efetivo, limites e política de senha por evidência da configuração hospedada; valores indisponíveis serão explicitamente informados como não verificados.
- O envio sempre solicita o domínio oficial. A alteração do Site URL padrão, se necessária para cobrir retornos sem destino explícito, é feita em Cloud → Users → Auth Settings → Advanced; não habilitar OAuth/MCP como atalho.
- Verificar o link realmente recebido sem expor seu conteúdo secreto. A entrega e o teste no domínio oficial dependem de acesso à mensagem de uma conta de teste e da publicação das páginas atualizadas.

## Detalhes técnicos
- Usar funções TanStack existentes e o middleware de sessão ativa para a operação administrativa; validar ADMIN por `user_roles`/`has_role` antes de carregar o cliente privilegiado para identificar o alvo.
- Usar um cliente de envio de recuperação sem sessão e com chave publicável para manter o fluxo padrão e os limites do Auth; retornar somente resultado seguro.
- Não usar `auth.admin.generateLink` como envio: essa API gera dados secretos para envio próprio e não substitui `resetPasswordForEmail`.
- Centralizar apenas os utilitários compartilháveis de confirmação, elegibilidade, destino e mensagens, sem reescrever Perfil → Alterar senha.
- Não criar tokens, tabelas de recuperação ou senhas temporárias. Reaproveitar `audit_logs`; acrescentar estrutura somente se uma necessidade concreta de segurança for demonstrada.
- Completar os metadados das páginas alteradas e conferir os metadados das demais páginas de conteúdo.

## Validação e entrega
- Testes concretos de e-mail existente/inexistente, destino fixo, confirmação divergente, link válido/expirado/inválido/usado, sucesso e login com nova senha.
- Testar ADMIN autorizado e USER negado; Google-only/híbrida; conta bloqueada sem alteração de status; auditoria sem credenciais; limites de envio.
- Não trocar a senha de contas reais nem alterar Bolão Galera Gmill. Usar conta controlada para testes que mudam senha e comunicar qualquer dependência de homologação.
- Verificar Login, recuperação, nova senha, sucesso e confirmação ADMIN em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, nos temas Claro, Escuro e Automático, sem overflow.
- Executar os testes relevantes e a suíte completa; verificar os resultados automáticos de compilação e erros da prévia.
- Entregar o retorno obrigatório de 39 itens, distinguindo testes reais, testes automatizados e limitações não verificadas. Aguardar homologação antes de qualquer próxima etapa.