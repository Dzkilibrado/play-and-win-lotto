import { useSecondaryOptions } from "@/hooks/useSecondaryOptions";
import { secondaryLabel } from "@/lib/secondaryKeys";

/** "Mês da Sorte: Março" / "Time do Coração: Flamengo (RJ)" do jogo; nada nas demais. */
export function GameSecondaryLine({
  slug,
  lotteryId,
  selection,
}: {
  slug: string | undefined;
  lotteryId: string | undefined;
  selection: string[] | null | undefined;
}) {
  const secondary = useSecondaryOptions(slug, lotteryId);
  if (!secondary.supported) return null;
  const values = selection ?? [];
  return (
    <p className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-text-primary">
      {secondary.label}:{" "}
      <span className="font-medium">
        {values.length > 0
          ? values.map((value) => secondaryLabel(secondary.options, value) ?? value).join(", ")
          : "não informado"}
      </span>
    </p>
  );
}
