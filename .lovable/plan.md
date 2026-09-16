# Correção estrutural do ciclo pós-sorteio dos bolões

## Diagnóstico confirmado
- Preservar integralmente o **Bolão Galera Gmill** durante a correção.
- Corrigir a lacuna entre o concurso oficial, os jogos já conferidos e a situação do bolão, sem edição manual isolada do registro real.
- Separar definitivamente os conceitos **ativo**, **existente**, **com resultado**, **finalizado** e **arquivado**.

## Implementação
1. **Ciclo pós-sorteio no banco**
   - Vincular o bolão ao concurso oficial a partir dos jogos associados quando o vínculo ainda estiver ausente.
   - Ao surgir o resultado, mover automaticamente `AWAITING_DRAW` para `AWAITING_CHECK`.
   - Quando todos os jogos aplicáveis estiverem conferidos, classificar o bolão como `CHECKED` ou `PRIZED` conforme o resultado real.
   - Não finalizar automaticamente: `FINISHED` continuará sendo encerramento operacional explícito.
   - Aplicar a mesma regra derivada aos registros históricos afetados, com histórico/auditoria e sem tocar em participantes, pagamentos, documentos ou jogos.

2. **Cobertura completa no HUB e nas listas**
   - Manter a Home restrita aos bolões operacionalmente ativos.
   - Fazer `Todos` incluir todo bolão acessível não arquivado, inclusive conferido, premiado, finalizado e cancelado.
   - Derivar `Com resultado` da existência de conferência oficial, não apenas do status textual do bolão.
   - Manter `Finalizados` para `FINISHED` e `CANCELLED`; manter arquivamento como dimensão independente.
   - Garantir que os cards do HUB abram sempre a lista filtrada.

3. **Contadores e atualização**
   - Criar uma leitura autenticada e autoritativa para os contadores do HUB, calculada no servidor sobre todos os bolões acessíveis.
   - Padronizar invalidações após mudanças de estado para Home, HUB, listas, detalhe, Resultado e Jogos.

4. **Consulta histórica e resultado**
   - Preservar as oito áreas do bolão em todos os estados.
   - Exibir em Resultado o concurso, data, dezenas oficiais, quantidade de jogos conferidos, premiados, não premiados e prêmio total sem fabricar valores.
   - Exibir nos jogos a situação e os acertos já gravados pela conferência automática.
   - Preservar PDF, comprovantes e links públicos nas regras atuais.

## Validação
- Testes de cobertura para todos os estados operacionais, inclusive resultado pendente, resultado disponível, finalizado, arquivado e cancelado.
- Teste controlado do ciclo completo sem usar o bolão real como massa destrutiva.
- Busca por “Bolão Galera Gmill” em `Todos` e navegação até Resultado.
- Validação em 320×568, 360×800 e 390×844, sem rolagem horizontal.
- Executar testes automatizados e validar tipagem e prévia compilada.
