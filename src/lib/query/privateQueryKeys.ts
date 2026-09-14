/** Chaves privadas preservam o prefixo do domínio e isolam cada identidade. */
export const privateQueryKeys = {
  pools: (userId: string) => ["pools", "private", userId] as const,
  poolsAll: (userId: string) => ["pools", "all", userId] as const,
  poolsHome: (userId: string) => ["pools", "home-summary", userId] as const,
  pool: (userId: string, poolId: string) => ["pool", poolId, userId] as const,
  poolParticipants: (userId: string, poolId: string) =>
    ["pool", poolId, "participants", userId] as const,
  games: (userId: string, filters?: unknown) => ["games", filters, userId] as const,
  game: (userId: string, gameId: string) => ["game", gameId, userId] as const,
  gameStatusCounts: (userId: string) => ["game-status-counts", userId] as const,
  checkSummary: (userId: string) => ["check-summary", userId] as const,
  gameChecks: (userId: string, identity: string) => ["game-checks", userId, identity] as const,
  contestChecks: (userId: string, contestId: string) => ["contest-checks", userId, contestId] as const,
};
