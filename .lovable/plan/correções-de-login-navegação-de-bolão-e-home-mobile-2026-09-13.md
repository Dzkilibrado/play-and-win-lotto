# Correções de login, navegação de bolão e Home mobile

## Objetivo
Corrigir os três fluxos solicitados sem alterar arquivamento, exclusão, rateio, comprovantes, PDFs, geração, estatísticas, sincronização, pagamentos ou regras de acesso.

## Login e logout
- Distinguir sessão válida de credenciais apenas preenchidas pelo navegador: sessão válida redireciona para a Home; sem sessão, somente o envio explícito do formulário autentica.
- Preservar autofill padrão de e-mail e senha, sem efeitos ou observadores que chamem a autenticação ao preencher campos.
- Tornar o envio explícito rastreável pela interação do usuário e impedir submissões automáticas não intencionais.
- No logout, cancelar consultas, limpar dados autenticados em memória, encerrar a sessão e substituir o histórico pela tela de Login.
- Cobrir sessão válida, logout, autofill sem clique, login manual, senha incorreta, refresh autenticado e sessão expirada.

## Detalhe do bolão
- Fazer o detalhe buscar o bolão diretamente pelo identificador da rota, sem depender da lista ou de um valor temporário do cache.
- Separar os estados de autenticação, carregamento, erro e ausência real; “Bolão não encontrado” só aparece após uma resposta concluída e realmente vazia.
- Alinhar as chaves e invalidações do detalhe e da lista após alterações em bolão, participantes, pagamentos, jogos, comprovantes, situação e compartilhamento.
- Validar Home → Bolões → detalhe, voltar e reabrir, atalho da Home, link interno direto e refresh no detalhe, incluindo o Bolão Galera Gmill.

## Home compacta
- Manter a grade 2×2 de Criar jogo, Importar por foto, Meus jogos e Meus bolões como primeira ação no mobile.
- Priorizar alertas importantes, bolões, próximos sorteios e depois os demais blocos habilitados.
- Tornar cabeçalho, atalhos, indicadores, resumo de bolões e próximos sorteios mais compactos, preservando legibilidade e áreas de toque.
- Manter Próximos sorteios com modalidade, concurso, data e prêmio estimado em linhas compactas.
- Alterar o padrão de Últimos resultados para desligado, sem remover a opção da personalização nem o acesso por Concursos e Resultados.
- Preservar preferências já salvas pelo usuário; a mudança de padrão valerá para quem ainda usa o padrão ou o restaurar.
- No desktop, manter grid e largura confortável sem apenas ampliar o desenho mobile.

## Validação
- Testes automatizados para login explícito, logout, sessão, estados do detalhe, busca direta, preferências padrão e renderização da Home.
- Verificação em 320×568, 360×800 e 390×844, além de desktop, com zero rolagem horizontal.
- Homologação dos fluxos no domínio publicado quando a nova versão estiver disponível, sem apagar credenciais salvas pelo navegador.
- Executar suíte completa, verificação de tipos e compilação; registrar qualquer limitação real no retorno obrigatório de 29 itens.
