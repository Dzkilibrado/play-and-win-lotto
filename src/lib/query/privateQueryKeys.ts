/** Chaves privadas preservam o prefixo do domínio e isolam cada identidade. */
export const privateQueryKeys = {
  pools: (userId: string) => ["pools", userId] as const,
  poolsAll: (userId: string) => ["pools", userId, "all"] as const,
  poolsHome: (userId: string) => ["pools", userId, "home-summary"] as const,
  pool: (userId: string, poolId: string) => ["pool", userId, poolId] as const,
  poolParticipants: (userId: string, poolId: string) =>
    ["pool", userId, poolId, "participants"] as const,
  games: (userId: string, filters?: unknown) => ["games", userId, filters] as const,
  game: (userId: string, gameId: string) => ["game", userId, gameId] as const,
  gameStatusCounts: (userId: string) => ["game-status-counts", userId] as const,
  checkSummary: (userId: string) => ["check-summary", userId] as const,
  gameChecks: (userId: string, identity: string) => ["game-checks", userId, identity] as const,
  contestChecks: (userId: string, contestId: string) => ["contest-checks", userId, contestId] as const,
};
