/**
 * Parâmetros do motor de geração.
 * Limites e sugestões ficam aqui — nunca hardcoded em componentes.
 */
export const generationConfig = {
  /** Limite de segurança de jogos por solicitação. */
  maxGamesPerRequest: 200,
  /** Sugestões rápidas de quantidade na interface. */
  quickGameCounts: [1, 5, 10, 20, 50],
  /**
   * Acima deste tamanho de espaço amostral, sorteamos índices distintos;
   * abaixo, enumeramos o espaço inteiro e embaralhamos.
   */
  exhaustiveEnumerationLimit: 50_000,
} as const;
