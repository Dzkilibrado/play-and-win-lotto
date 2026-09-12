# Identidade, landing e acesso do Gestor da Sorte

## Objetivo

Aplicar a identidade definitiva **Gestor da Sorte** e criar uma primeira experiência pública e de acesso madura, segura e multiplataforma, sem alterar regras homologadas das áreas operacionais.

## Identidade e Design System

- Atualizar a configuração central para nome visível **Gestor da Sorte**, slogan principal, texto complementar e domínio `gestordasorte.com.br`; manter `GestordaSorte` apenas como identificador técnico quando necessário.
- Manter a dupla tipográfica atual — **Space Grotesk** em títulos/wordmark e **DM Sans** em textos e controles — com carregamento eficiente e fallback do sistema.
- Refinar os tokens semânticos em claro e escuro para uma identidade própria, sóbria e tecnológica, sem símbolos ou linguagem de cassino, apostas ou oficialidade da CAIXA.
- Criar um wordmark tipográfico reutilizável e preparado para futura substituição por logotipo, sem produzir uma marca gráfica definitiva nesta etapa.
- Atualizar textos e identidade visível no cabeçalho, sidebar, PWA, metadados e Home autenticada, preservando estrutura, widgets e preferências existentes.

## Landing pública

- Reconstruir `/` com cabeçalho, apresentação direta da marca, slogan, texto complementar e CTAs funcionais para cadastro e login.
- Criar uma composição responsiva: uma coluna objetiva no celular e layout editorial com grids e bom uso de espaço no desktop, sem reproduzir uma tela mobile ampliada.
- Apresentar seis capacidades: Meus Jogos, Bolões, Geração de Jogos, Concursos e Resultados, Estatísticas e Conferência, usando linguagem estritamente organizacional.
- Adicionar seções específicas para transparência dos bolões, geração responsável e posicionamento institucional.
- Exibir próximos sorteios reais de Mega-Sena, Lotofácil e Quina a partir da base já sincronizada, com consulta pública enxuta aos últimos registros necessários; mostrar concurso, data e prêmio quando disponíveis, sem consulta do navegador à fonte externa e sem dados fictícios.
- Informar “Mais modalidades em breve” sem apresentar modalidades futuras como disponíveis.
- Inserir disclaimer discreto e legível sobre não comercialização de apostas, ausência de vínculo oficial, independência dos sorteios e ausência de garantia de premiação.
- Criar rodapé com marca, domínio, links jurídicos e disclaimer resumido.

## Login, cadastro e sessão

- Separar as experiências em rotas públicas próprias para login e cadastro, mantendo o login por e-mail/senha e o fluxo Google já existente.
- Redesenhar o login com contexto institucional no desktop e formulário prioritário no celular; incluir acesso claro à recuperação e ao cadastro.
- No cadastro, solicitar nome completo, nascimento, telefone brasileiro, e-mail, senha, confirmação e aceite dos documentos jurídicos.
- Aplicar validação compartilhada com limites e mensagens em português: e-mail válido, senha conforme política do provedor, senhas iguais, telefone brasileiro válido e idade mínima de 18 anos.
- Formatar o telefone durante a digitação e persistir somente a forma normalizada internacional (`+55...`).
- Corrigir o pós-cadastro para respeitar confirmação de e-mail: quando não houver sessão, mostrar orientação para verificar o e-mail em vez de abrir a área autenticada.
- Preservar o Google como autenticação única para contas Google; dados ausentes serão solicitados na conclusão do perfil, sem criar senha local.
- Exigir que contas existentes completem nome, nascimento, telefone e aceite vigente no próximo acesso antes de chegar à Home.
- Manter logout com limpeza de consultas e histórico protegido; validar sessão e renovação nos fluxos disponíveis.

## Proteção de maioridade e aceite

- Ampliar incrementalmente `profiles` com nascimento e telefone normalizado, preservando os dados atuais.
- Criar documentos jurídicos versionados e registros de aceite separados, com usuário, versão e horário do servidor; não duplicar o conteúdo aceito em cada registro.
- Atualizar o gatilho de criação de perfil para validar no banco nascimento, maioridade, telefone normalizado e versões aceitas em cadastro por e-mail.
- Criar uma operação autenticada e validada no servidor para completar/editar o perfil e registrar aceite, garantindo que a proteção não dependa apenas do navegador.
- Manter RLS restritiva, grants mínimos e nenhuma senha ou chave privilegiada no cliente.

## Recuperação de acesso

- Criar a página “Esqueci minha senha” com envio pelo provedor de autenticação e mensagem neutra contra enumeração de contas.
- Criar a rota pública `/reset-password` para validar o fluxo de recuperação e permitir nova senha com confirmação.
- Tratar link válido, expirado, inválido ou já utilizado com mensagens claras, sem criar tokens próprios e sem usar dados pessoais como prova de identidade.
- Não implementar perguntas secretas, recuperação por dados pessoais ou OTP fictício; registrar apenas a evolução futura de recuperação por telefone verificado e OTP.

## Perfil

- Substituir o aviso de edição futura por gerenciamento de nome, nascimento, telefone e avatar já existente, com validação no servidor e apresentação formatada do telefone.
- Manter e-mail sob as regras do provedor de autenticação e não incluir alteração sensível insegura nesta etapa.

## Termos e privacidade

- Criar páginas públicas completas para **Termos de Uso** e **Política de Privacidade**, com metadados próprios, navegação e links na landing, login e cadastro.
- Redigir versões iniciais claras e fiéis ao funcionamento atual: organização e acompanhamento, ausência de venda/garantia, dados coletados e suas finalidades, autenticação, comprovantes, bolões, compartilhamento público, terceiros necessários, segurança, menores, direitos, retenção/exclusão e contato do responsável.
- Identificar claramente ambas como **“Versão preliminar — sujeita à revisão jurídica.”** e nunca como conteúdo juridicamente revisado.
- Estruturar atualização futura de versão para exigir novo aceite quando marcado como obrigatório.

## SEO, Open Graph e PWA

- Configurar em cada rota pública título, descrição, Open Graph, Twitter card, `og:url` e canonical autorreferente para `https://gestordasorte.com.br`.
- Criar uma imagem social própria 1200×630, leve e sem identidade oficial das loterias, usada na landing e somente onde fizer sentido.
- Corrigir o idioma do documento para `pt-BR` e remover metadados genéricos.
- Adicionar manifesto com nome **Gestor da Sorte**, nome curto adequado, cores dos temas e referências de ícone provisório; preservar o comportamento atual sem publicar nem alterar DNS.

## Validação

- Adicionar testes para identidade e textos críticos, formatação/normalização de telefone, cálculo de maioridade, validação de cadastro, aceite/versionamento, recuperação sem enumeração e consulta enxuta de próximos sorteios.
- Testar cadastro por e-mail, login correto/incorreto, Google, logout, recuperação, nova senha, token inválido/expirado, conta inexistente, sessão expirada e conclusão obrigatória de perfil, registrando qualquer limitação real de automação.
- Verificar tema claro e escuro, legibilidade, navegação e ausência estrutural de rolagem horizontal em `320×568`, `360×800`, `390×844`, `768×1024`, `1280×720` e `1440×900` para Landing, Login, Cadastro, Recuperação, Home, menus, sorteios, cards e rodapé.
- Rodar testes completos, checagem de tipos, build, auditoria de overflow e revisão de segurança; confirmar que nenhuma regra de geração, jogos, bolões, pagamentos, comprovantes, PDFs, conferência, concursos, estatísticas, sincronização, RLS ou Storage sofreu regressão.

## Limites desta etapa

- Não publicar, configurar DNS ou conectar o domínio.
- Não criar logotipo definitivo.
- Não implementar OTP, perguntas secretas ou recuperação por dados pessoais.
- Não iniciar funcionalidades fora de identidade, landing, acesso, perfil inicial, documentos jurídicos preliminares e experiência multiplataforma.
