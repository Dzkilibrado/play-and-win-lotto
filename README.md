# Lottery Hub Central

Quero iniciar o desenvolvimento de uma nova aplicação.

IMPORTANTE:

Neste primeiro momento, NÃO desenvolva todas as funcionalidades do sistema.

O objetivo desta etapa é criar uma fundação sólida, arquitetura inicial, Design System, navegação, estrutura responsiva e banco preparado para evolução.

Não invente regras de negócio além das especificadas.

Quando uma funcionalidade ainda não estiver implementada, prepare a estrutura visual/arquitetural sem simular que ela funciona.

NOME DO PROJETO

O nome definitivo ainda não foi escolhido.

Utilizar temporariamente:

"Gestor de Loterias"

Não espalhar esse nome de forma hardcoded pelo código.

Criar uma configuração central da aplicação para permitir troca futura do nome, logo e identidade sem refatoração ampla.

==================================================

1. OBJETIVO DO PRODUTO

==================================================

Criar uma aplicação web responsiva, mobile-first e preparada para PWA, destinada a:

- geração e análise de jogos de loteria;

- armazenamento dos jogos do usuário;

- consulta de concursos e resultados;

- estatísticas históricas;

- conferência automática de jogos;

- gerenciamento completo de bolões;

- participantes e cotas;

- controle de pagamentos;

- acompanhamento de sorteios;

- notificações;

- histórico e auditoria.

Nesta primeira versão serão suportadas:

1. Mega-Sena

2. Lotofácil

3. Quina

A arquitetura NÃO pode ser construída exclusivamente para essas três modalidades.

Ela deve permitir adicionar futuramente novas loterias sem duplicar módulos ou reconstruir o sistema.

==================================================

2. PRINCÍPIO ARQUITETURAL

==================================================

Não criar estruturas independentes como:

mega_games

quina_games

lotofacil_games

ou páginas totalmente duplicadas para cada modalidade.

Utilizar arquitetura parametrizada por lottery_id e regras/configurações de cada modalidade.

Separar conceitualmente:

- modalidade;

- regras;

- preços;

- concursos;

- resultados;

- jogos;

- análise dos jogos;

- usuários;

- bolões;

- participantes;

- pagamentos;

- documentos;

- notificações;

- auditoria.

Não colocar regras críticas somente no frontend.

==================================================

3. STACK

==================================================

Utilizar:

- React

- TypeScript

- Tailwind

- Supabase/PostgreSQL

- Supabase Auth

Preparar estrutura para:

- PWA;

- Edge Functions;

- tarefas agendadas;

- sincronização externa;

- notificações futuras.

Utilizar componentes reutilizáveis e código fortemente tipado.

Evitar componentes monolíticos.

==================================================

4. DESIGN SYSTEM

==================================================

Criar desde o início um Design System próprio.

A aplicação deverá possuir:

- tema claro;

- tema escuro;

- opção automática conforme dispositivo;

- excelente contraste;

- acessibilidade;

- tipografia legível;

- interface confortável para uso prolongado;

- touch targets adequados para smartphone.

Não utilizar cores extremamente saturadas em grandes áreas.

Criar tokens para:

- background;

- surface;

- surface-secondary;

- text-primary;

- text-secondary;

- border;

- success;

- warning;

- danger;

- info;

- lottery-primary.

Cada modalidade terá uma identidade visual própria:

Mega-Sena:

verde.

Lotofácil:

roxo/magenta.

Quina:

azul/índigo.

Essas cores devem identificar a modalidade sem prejudicar a leitura.

Não copiar a identidade visual oficial da CAIXA.

Criar componentes reutilizáveis, por exemplo:

AppHeader

PageHeader

BottomNavigation

Sidebar

LotteryCard

ContestCard

GameCard

PoolCard

StatCard

MetricCard

NumberBall

LotteryTicket

FilterBar

FilterDrawer

ActiveFilterChip

EmptyState

LoadingState

ErrorState

StatusBadge

SearchInput

ThemeSelector

Os nomes podem ser ajustados conforme o padrão técnico adotado.

==================================================

5. RESPONSIVIDADE

==================================================

Mobile-first.

No smartphone utilizar navegação inferior:

Início

Gerar

Meus Jogos

Bolões

Mais

Em "Mais":

Resultados

Concursos

Estatísticas

Notificações

Perfil

Configurações

No desktop utilizar sidebar ou navegação equivalente.

Não simplesmente comprimir o layout desktop no celular.

Tabelas extensas precisam possuir apresentação adequada para mobile, utilizando cards ou layout adaptativo quando necessário.

==================================================

6. PRINCÍPIO GLOBAL DE UX

==================================================

O usuário nunca deve ficar perdido dentro do sistema.

Toda tela com potencial para muitos registros deve possuir, conforme aplicável:

- busca;

- filtros;

- ordenação;

- indicadores;

- quantidade de resultados;

- paginação ou carregamento progressivo;

- acesso rápido ao detalhe.

Não depender apenas de rolagem para localizar informações.

Padrão:

BUSCA RÁPIDA

+

FILTROS PRINCIPAIS

+

MAIS FILTROS

+

ORDENAÇÃO

+

LIMPAR FILTROS

No mobile, filtros avançados podem utilizar bottom sheet/drawer.

Filtros ativos devem aparecer como chips removíveis.

Exemplo:

[Mega-Sena ×]

[Concurso 3054 ×]

[Premiados ×]

[Limpar tudo]

==================================================

7. INDICADORES CLICÁVEIS

==================================================

Sempre que fizer sentido, indicadores devem funcionar também como atalhos/filtros.

Exemplo:

"4 pagamentos pendentes"

Ao tocar, abrir ou filtrar os quatro pagamentos.

Fluxo conceitual:

Dashboard

→ indicador

→ registros filtrados

→ detalhe

O objetivo é permitir chegar às informações importantes em poucos cliques.

==================================================

8. PERSISTÊNCIA DOS FILTROS

==================================================

Ao entrar em um registro e voltar para a listagem, preservar:

- filtros;

- pesquisa;

- ordenação;

- posição/contexto quando viável.

Na aplicação web, preparar filtros relevantes para utilização através de query parameters.

Exemplo conceitual:

/games?lottery=mega-sena&contest=3054&status=prize

==================================================

9. ESTADOS VAZIOS

==================================================

Nunca apresentar apenas uma tela vazia.

Exemplo:

"Nenhum jogo premiado encontrado com estes filtros."

Ações:

Limpar filtros

Ver todos os jogos

Outro exemplo:

"Não existem participantes com pagamentos pendentes."

Mostrar feedback positivo.

==================================================

10. DASHBOARD PRINCIPAL

==================================================

Criar a estrutura inicial do Dashboard.

No topo, apresentar os próximos concursos das três modalidades:

Mega-Sena

Lotofácil

Quina

Cada card deve estar preparado para receber:

- modalidade;

- próximo concurso;

- data;

- estimativa de prêmio;

- status.

Ações:

Gerar jogo

Resultado

Meus jogos

Não utilizar números oficiais fictícios como se fossem dados reais.

Enquanto não existir integração oficial, utilizar estado claramente identificado como demonstração/loading/sem dados.

==================================================

11. DASHBOARD PESSOAL

==================================================

Preparar cards:

Jogos aguardando sorteio

Jogos conferidos

Jogos premiados

Bolões ativos

Pagamentos pendentes

Os cards devem futuramente funcionar como atalhos para listagens filtradas.

==================================================

12. RESULTADOS RECENTES

==================================================

Criar seção:

"Resultados recentes"

Permitir visualmente alternar:

Mega-Sena

Lotofácil

Quina

Estrutura do card:

modalidade

concurso

data

dezenas

situação

prêmio principal

ver detalhes

Não inventar resultados oficiais nesta fase.

==================================================

13. ESTATÍSTICAS

==================================================

Preparar seção inicial de estatísticas.

Categorias futuras:

Mais sorteadas

Menos sorteadas

Mais atrasadas

Pares/Ímpares

Primos

Fibonacci

Soma

Sequências

Repetidas

Distribuição por linha

Distribuição por coluna

Filtros futuros:

Todo histórico

Últimos 10

Últimos 20

Últimos 50

Últimos 100

Último ano

Personalizado

Exibir aviso conceitual de que estatísticas históricas não garantem ou aumentam a probabilidade de determinado número ser sorteado.

==================================================

14. REGRAS INICIAIS DAS LOTERIAS

==================================================

Estruturar as modalidades de forma parametrizada.

MEGA-SENA

Universo: 1 a 60

Quantidade selecionável: 6 a 20

Faixas:

4 = Quadra

5 = Quina

6 = Sena

LOTOFÁCIL

Universo: 1 a 25

Quantidade selecionável: 15 a 20

Faixas:

11

12

13

14

15 acertos

QUINA

Universo: 1 a 80

Quantidade selecionável: 5 a 15

Faixas:

2 = Duque

3 = Terno

4 = Quadra

5 = Quina

IMPORTANTE:

As regras devem ficar centralizadas/configuráveis.

Não repetir esses limites manualmente em múltiplos componentes.

==================================================

15. PREÇOS

==================================================

Preparar o sistema para tabela de preços versionada.

O preço NÃO deve ficar hardcoded dentro dos componentes.

Estrutura conceitual:

lottery_prices

id

lottery_id

numbers_selected

combination_count

price

valid_from

valid_until

source

is_active

Isso deve permitir alterações futuras de preço mantendo histórico.

A interface do gerador futuramente deverá mostrar imediatamente:

Quantidade de dezenas

Valor por jogo

Quantidade de jogos

Valor total estimado

==================================================

16. CONCURSOS

==================================================

Criar estrutura para histórico completo de concursos.

Tabela conceitual:

lottery_draws

id

lottery_id

contest_number

draw_date

draw_location

is_accumulated

main_prize

estimated_next_prize

next_contest_number

next_draw_date

revenue

source

source_updated_at

imported_at

verified_at

Criar estrutura para dezenas e faixas de premiação.

Exemplo:

draw_numbers

id

draw_id

number

position

draw_prizes

id

draw_id

tier

hits

winners

prize_per_winner

==================================================

17. HISTÓRICO DE CONCURSOS

==================================================

Preparar tela "Concursos".

Filtros:

Loteria

Número do concurso

Data inicial

Data final

Acumulado/Com ganhador

Ordenação

Permitir:

Mais recente

Mais antigo

Maior prêmio

Mostrar quantidade de resultados encontrados.

==================================================

18. JOGOS DO USUÁRIO

==================================================

Preparar modelo conceitual para:

generated_games

game_numbers

game_analysis

Cada jogo deverá futuramente estar relacionado a:

usuário

loteria

concurso

bolão opcional

quantidade de dezenas

status

data de criação

Status conceituais:

Planejado

Apostado

Comprovado

Aguardando sorteio

Conferido

Premiado

Não premiado

Não implementar toda a lógica de geração nesta etapa.

==================================================

19. MEUS JOGOS

==================================================

Preparar tela de listagem com:

busca

filtros

cards/listagem

estado vazio

Filtros planejados:

Loteria

Concurso

Período

Status

Jogo individual/Bolão

Bolão

Quantidade de dezenas

Quantidade de acertos

Premiação

==================================================

20. BOLÕES

==================================================

Preparar arquitetura para módulo completo de bolões.

Entidade principal:

pools

Campos conceituais:

id

owner_id

lottery_id

contest_id

name

draw_date

quota_value

total_quotas

payment_deadline

status

notes

created_at

updated_at

Status:

Em formação

Aberto

Fechado

Aguardando sorteio

Conferido

Premiado

Encerrado

Criar estrutura conceitual também para:

pool_participants

pool_payments

pool_games

pool_documents

==================================================

21. TELA DE BOLÕES

==================================================

Preparar listagem com:

Busca

Loteria

Status

Concurso

Período

Financeiro

Premiação

Ordenação

Cards indicadores:

Bolões ativos

Próximos do sorteio

Pagamentos pendentes

Premiados

Indicadores clicáveis.

==================================================

22. DETALHE DO BOLÃO

==================================================

Preparar layout com abas:

Visão Geral

Participantes

Jogos

Financeiro

Resultado

Documentos

Histórico

Visão geral preparada para mostrar:

nome

modalidade

concurso

data do sorteio

contagem regressiva

cotas

participantes

valor previsto

recebido

pendente

quantidade de jogos

==================================================

23. PARTICIPANTES

==================================================

Preparar estrutura para:

nome

telefone

quantidade de cotas

valor

situação

data do pagamento

observação

Status financeiro:

Pendente

Parcial

Pago

Vencido

Busca por nome/telefone.

Filtros rápidos:

Todos

Pagos

Parciais

Pendentes

Vencidos

==================================================

24. CONTAGEM REGRESSIVA

==================================================

Preparar arquitetura para alertas relacionados ao sorteio:

15 dias

10 dias

7 dias

3 dias

1 dia

Hoje

Esses alertas futuramente serão configuráveis pelo usuário.

Não implementar notificações push completas nesta etapa.

==================================================

25. WHATSAPP

==================================================

Preparar o produto para compartilhamento futuro de bolão via WhatsApp.

Não integrar APIs pagas.

O compartilhamento deve futuramente utilizar recursos padrão de share/deep link, com mensagem preparada pelo sistema e confirmação/envio realizado pelo próprio usuário.

==================================================

26. COMPROVANTES

==================================================

Preparar estrutura para documentos:

comprovante de pagamento da cota

comprovante da aposta

Aceitar futuramente:

imagem

PDF

Não confundir jogo gerado no aplicativo com aposta oficialmente registrada.

==================================================

27. AUDITORIA

==================================================

Preparar tabela:

audit_logs

Para futuramente registrar eventos relevantes:

criação de bolão

alteração de participante

alteração de cotas

pagamento

jogo incluído

jogo removido

comprovante anexado

bolão fechado

resultado processado

premiação

==================================================

28. PERFIS E SEGURANÇA

==================================================

Preparar autenticação.

Perfis iniciais:

USER

ADMIN

Aplicar Row Level Security nas tabelas privadas.

Um usuário comum não pode consultar:

jogos privados de outro usuário

bolões privados sem autorização

pagamentos de terceiros sem vínculo

documentos privados

Não confiar apenas em proteção de rota no frontend.

==================================================

29. DADOS OFICIAIS

==================================================

Não implementar scraping improvisado nesta etapa.

Preparar camada de serviço:

lotteryDataService

A arquitetura futura será:

Fonte oficial

→ serviço de sincronização

→ validação

→ PostgreSQL

→ aplicação

O frontend deve consultar prioritariamente nosso banco e não depender diretamente de serviço externo.

==================================================

30. CONFIGURAÇÃO CENTRAL

==================================================

Criar configuração central para:

nome da aplicação

modalidades ativas

identidade das modalidades

feature flags futuras

Exemplo conceitual:

appConfig

lotteryConfig

Evitar valores espalhados pelo código.

==================================================

31. FEATURE FLAGS

==================================================

Preparar sistema simples de feature flags para permitir módulos:

active

beta

maintenance

disabled

Isso será útil durante a evolução e homologação.

==================================================

32. ROTAS INICIAIS

==================================================

Preparar rotas semelhantes a:

/

 /login

 /dashboard

 /generate

 /games

 /games/:id

 /pools

 /pools/new

 /pools/:id

 /results

 /contests

 /contests/:id

 /statistics

 /notifications

 /profile

 /settings

 /admin

Adaptar se houver padrão melhor, preservando a organização conceitual.

==================================================

33. O QUE IMPLEMENTAR NESTA ETAPA

==================================================

IMPLEMENTAR:

1. fundação do projeto;

2. Design System;

3. tema claro/escuro/automático;

4. responsividade;

5. navegação mobile e desktop;

6. autenticação base;

7. estrutura inicial do banco;

8. tipos/interfaces centrais;

9. configuração parametrizada das 3 loterias;

10. estrutura das principais rotas;

11. Dashboard inicial;

12. componentes reutilizáveis;

13. estrutura de filtros;

14. estados loading/error/empty;

15. segurança/RLS inicial quando aplicável;

16. feature flags básicas.

NÃO IMPLEMENTAR AINDA:

- algoritmo avançado de geração;

- filtros matemáticos completos;

- pesos inteligentes;

- importação histórica completa;

- integração definitiva com CAIXA;

- conferência automática;

- notificações push;

- rateio de prêmio;

- automações;

- estatísticas avançadas.

==================================================

34. QUALIDADE

==================================================

Antes de concluir:

- validar TypeScript;

- eliminar erros de build;

- verificar console;

- verificar rotas;

- testar tema claro;

- testar tema escuro;

- testar desktop;

- testar smartphone;

- verificar RLS;

- evitar dados mockados apresentados como oficiais;

- evitar código duplicado;

- evitar regras críticas hardcoded em componentes.

==================================================

35. RETORNO ESPERADO

==================================================

Ao finalizar esta etapa, me informe:

1. o que foi criado;

2. estrutura de páginas;

3. componentes principais;

4. tabelas criadas;

5. políticas RLS criadas;

6. estrutura de configuração das loterias;

7. dados seed utilizados;

8. o que ficou propositalmente pendente;

9. eventuais decisões técnicas tomadas;

10. problemas ou limitações encontradas.

Não avance automaticamente para o motor de geração de jogos.

Aguarde minha validação desta fundação antes da próxima fase.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1bd63223-2652-464d-8b0e-7248ff414695).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
