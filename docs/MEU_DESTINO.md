# Meu Destino — regras e fontes

Modo de criação de jogos "Meu Destino" (numerologia + astrologia). **Entretenimento**: nenhuma
tradição define números de loteria; o peso dado aos números ligados à leitura é uma convenção do
sistema e não altera a chance de acerto. O texto de responsabilidade (`mysticDisclaimer`) sempre
acompanha o resultado.

## Princípios
- Pesquisa feita **uma vez**, em desenvolvimento; as regras ficam embutidas e testadas. Nada é
  buscado na web a cada geração (custo zero, resultado repetível).
- Determinístico: mesmos dados + mesma loteria = mesmos números. Aumentar o orçamento só acrescenta
  jogos. Jogo maior contém o menor do mesmo índice.
- LGPD: só o identificador da leitura (hash preso ao usuário) e os números são guardados; nome, data
  e local de nascimento não são gravados.

## Numerologia pitagórica
- Tabela: 1 AJS · 2 BKT · 3 CLU · 4 DMV · 5 ENW · 6 FOX · 7 GPY · 8 HQZ · 9 IR (conferida na fonte).
- Acentos ignorados; 11, 22 e 33 não são reduzidos. Vogais A E I O U; Y é consoante.
- Expressão (nome completo), Alma (vogais), Personalidade (consoantes), Caminho de vida
  (dia + mês + ano, cada um reduzido), Dia de nascimento, Ano pessoal (dia + mês + ano corrente),
  Vibração do grupo (nº de pessoas do bolão).

## Astrologia (tropical)
- Signo solar, signo e fase da Lua e ascendente por cálculo astronômico local
  (`astronomy-engine`, MIT). Ascendente: ASC = atan2(cos θ, −(sen θ·cos ε + tan φ·sen ε)), com θ o
  tempo sideral local e ε a obliquidade; validado contra o nascer do Sol.
- Hora local convertida para UTC pelo banco de fusos (inclui horário de verão histórico).
- Sem hora ou cidade, a leitura segue sem ascendente.
- Municípios: base do IBGE (latitude, longitude e fuso) embutida em `src/data/municipios.json`.

## Fontes consultadas
- Tabela pitagórica: https://sabertecnologias.com.br/conteudo/tabela-numerologia-letras-guia-completo-e-pratico
- Astronomy Engine: https://unpkg.com/astronomy-engine@2.1.19/README.md
- Municípios: https://github.com/kelvins/municipios-brasileiros (dados do IBGE)
