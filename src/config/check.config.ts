/**
 * Configuração central da conferência automática.
 * Nenhum número mágico de conferência vive fora deste arquivo.
 */
export const checkConfig = {
  /**
   * Versão do cálculo de conferência.
   * v1 = acertos por interseção + decomposição combinatória C(a,f) * C(n-a, b-f)
   *      sobre as faixas oficiais registradas em `draw_prizes`.
   * Sempre que a fórmula mudar, incrementar aqui: resultados antigos não são
   * reinterpretados silenciosamente, ficam marcados com a versão em que
   * foram calculados.
   */
  calculationVersion: 1,
  /** Jogos conferidos por lote (mantém cada execução curta e retomável). */
  batchSize: 200,
  /** Concursos recentes considerados ao procurar jogos ainda não conferidos. */
  recentDrawsToScan: 12,
  /** Tempo máximo de uma execução de fila, em milissegundos. */
  maxBatchDurationMs: 20_000,
  /**
   * Tempo sem atividade após o qual uma fila `running` é considerada
   * abandonada (queda/timeout) e pode ser reassumida por outra execução.
   */
  jobStaleAfter: "00:10:00",
} as const;

export const checkDisclaimer =
  "A conferência compara suas dezenas com o resultado oficial já registrado no aplicativo. Os valores exibidos são os divulgados pela fonte oficial e podem ser atualizados. O pagamento do prêmio depende sempre da conferência do bilhete original.";
