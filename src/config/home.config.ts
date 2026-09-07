/**
 * Personalização da tela inicial.
 *
 * Os blocos são declarados aqui uma única vez: a tela inicial e a tela de
 * configurações leem desta mesma lista, e novos blocos entram sem alterar
 * banco nem componentes existentes.
 */

export type HomeBlockKey =
  | "indicators"
  | "pools"
  | "next_draws"
  | "recent_results"
  | "awaiting_check"
  | "prized";

export interface HomeBlockDefinition {
  key: HomeBlockKey;
  label: string;
  description: string;
  /** Depende das modalidades acompanhadas. */
  lotteryScoped: boolean;
  defaultEnabled: boolean;
}

export const homeBlockDefinitions: HomeBlockDefinition[] = [
  {
    key: "indicators",
    label: "Indicadores dos jogos",
    description: "Total salvos, aguardando sorteio, a conferir e premiados.",
    lotteryScoped: false,
    defaultEnabled: true,
  },
  {
    key: "pools",
    label: "Meus bolões",
    description: "Resumo dos bolões ativos, próximo sorteio e pagamentos pendentes.",
    lotteryScoped: false,
    defaultEnabled: true,
  },
  {
    key: "next_draws",
    label: "Próximos sorteios",
    description: "Concurso e data das modalidades que você acompanha.",
    lotteryScoped: true,
    defaultEnabled: true,
  },
  {
    key: "recent_results",
    label: "Últimos resultados",
    description: "Resultados recentes das modalidades acompanhadas.",
    lotteryScoped: true,
    defaultEnabled: true,
  },
  {
    key: "awaiting_check",
    label: "Aguardando conferência",
    description: "Detalhe dos jogos que ainda serão conferidos.",
    lotteryScoped: false,
    defaultEnabled: false,
  },
  {
    key: "prized",
    label: "Premiados",
    description: "Destaque dos jogos com premiação já confirmada.",
    lotteryScoped: false,
    defaultEnabled: false,
  },
];

export interface HomeBlockPreference {
  key: HomeBlockKey;
  enabled: boolean;
}

export const defaultHomeBlocks: HomeBlockPreference[] = homeBlockDefinitions.map((block) => ({
  key: block.key,
  enabled: block.defaultEnabled,
}));

export function getHomeBlockDefinition(key: HomeBlockKey) {
  return homeBlockDefinitions.find((block) => block.key === key)!;
}

/**
 * Converte o que está salvo para uma lista válida: ignora blocos
 * desconhecidos e acrescenta ao final os blocos criados depois.
 */
export function normalizeHomeBlocks(raw: unknown): HomeBlockPreference[] {
  if (!Array.isArray(raw)) return defaultHomeBlocks.map((block) => ({ ...block }));

  const known = new Set(homeBlockDefinitions.map((block) => block.key));
  const seen = new Set<HomeBlockKey>();
  const result: HomeBlockPreference[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: unknown }).key;
    if (typeof key !== "string" || !known.has(key as HomeBlockKey)) continue;
    if (seen.has(key as HomeBlockKey)) continue;
    seen.add(key as HomeBlockKey);
    result.push({
      key: key as HomeBlockKey,
      enabled: Boolean((entry as { enabled?: unknown }).enabled),
    });
  }

  for (const block of defaultHomeBlocks) {
    if (!seen.has(block.key)) result.push({ ...block });
  }

  return result;
}

export function moveBlock(
  blocks: HomeBlockPreference[],
  key: HomeBlockKey,
  direction: -1 | 1,
): HomeBlockPreference[] {
  const index = blocks.findIndex((block) => block.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

export const homePreferencesNotice =
  "Estas preferências mudam apenas o que aparece na tela inicial. Todas as modalidades continuam disponíveis em Criar jogo, Concursos, Resultados e Estatísticas.";

export const noFollowedLotteriesNotice =
  "Você não está acompanhando nenhuma loteria na tela inicial. Os blocos de próximos sorteios e resultados não serão exibidos.";
