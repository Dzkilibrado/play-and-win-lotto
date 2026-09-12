# Alterar minha senha no Perfil

## Objetivo
Adicionar ao Perfil uma área separada de **Segurança da conta**, permitindo que usuários USER e ADMIN alterem somente a própria senha com validação pelo provedor de autenticação, sem armazenar credenciais na aplicação.

## Implementação
- Reorganizar o Perfil em duas áreas visuais: **Dados pessoais** e **Segurança da conta**.
- Detectar os métodos realmente vinculados à identidade autenticada, sem inferir pelo e-mail.
- Para contas com identidade local de e-mail/senha, exibir **Alterar senha** e abrir um diálogo acessível com senha atual, nova senha e confirmação.
- Revalidar a senha atual diretamente no serviço de autenticação; somente depois atualizar a própria credencial pelo mesmo serviço.
- Aplicar a política já adotada (8 a 72 caracteres), igualdade da confirmação, campos obrigatórios e mensagens amigáveis, sem enviar formulário inválido.
- Adicionar controles acessíveis de mostrar/ocultar em todos os campos, mantendo-os ocultos por padrão.
- Para conta exclusivamente Google, mostrar o método Google e não solicitar nem criar senha local. Para conta com Google e identidade local, manter a alteração de senha disponível.
- Manter a sessão ativa quando o provedor permitir e fechar o diálogo após sucesso.
- Registrar somente o evento `password_changed`, associado ao próprio usuário e ao horário do banco, sem metadados de credenciais. A gravação será protegida no banco e não permitirá registrar eventos para terceiros.
- Preservar o rate limiting do provedor; impedir múltiplos envios simultâneos sem criar bloqueio próprio.

## Segurança
- Nenhuma senha será gravada em perfil, tabelas, auditoria, armazenamento do navegador ou analytics.
- A aplicação não comparará senhas, não usará acesso privilegiado no navegador e não permitirá alteração de senha de terceiros.
- Mensagens técnicas do serviço de autenticação não serão exibidas ao usuário.
- Login, recuperação por e-mail, Google, cadastro, roles, RLS e dados pessoais permanecerão inalterados.

## Validação
- Testes unitários para política, confirmação, identificação de provedores e tradução segura de erros.
- Testes reais com USER e ADMIN de e-mail/senha: senha correta/incorreta, senha inválida, confirmação divergente, sucesso, login com nova senha e rejeição da antiga.
- Teste real de conta exclusivamente Google, se houver sessão/conta de teste disponível; caso contrário, validar a lógica automatizada e registrar a limitação.
- Verificação visual e funcional em 320×568, 360×800 e 390×844, nos temas claro, escuro e automático, incluindo teclado/rolagem e ausência de rolagem horizontal.
- Executar suíte completa, verificação de tipos e build, reportando totais e limitações.
