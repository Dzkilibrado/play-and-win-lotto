# Fechamento automático do menu mobile

## Objetivo
Corrigir o menu hambúrguer compartilhado para fechar imediatamente após a escolha de qualquer destino, inclusive a página atual, sem atrasar a navegação.

## Implementação
- Controlar a abertura do painel no cabeçalho compartilhado.
- Fechar o painel no clique de destinos finais e também quando o endereço da aplicação mudar.
- Preservar fechamento por toque externo, botão explícito e tecla Escape fornecidos pelo painel acessível.
- Manter itens expansores abertos quando apenas revelarem submenu; fechar somente ao escolher o destino final.
- Garantir estado acessível do acionador, foco e áreas de toque existentes.

## Validação
- Cobrir por teste o fechamento por seleção, inclusive ao escolher a página atual, e por mudança de rota.
- Verificar navegação e painel fechado em 320×568, 360×800, 390×844 e 768×1024.
- Verificar toque externo, Escape, destinos principais e demais opções disponíveis.
- Rodar testes de regressão, verificação de tipos e compilação.

## Limites
- Nenhuma regra de negócio, autenticação, permissão ou tela de destino será alterada.
