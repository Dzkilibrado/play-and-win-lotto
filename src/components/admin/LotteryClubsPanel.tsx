import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSecondaryOptions } from "@/hooks/useSecondaryOptions";
import { saveLotteryClubs } from "@/lib/admin/lotteries.functions";
import { parseClubLines } from "@/lib/secondaryKeys";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

/** Clubes do Time do Coração (Timemania): a lista muda a cada biênio por portaria. */
export function LotteryClubsPanel() {
  const queryClient = useQueryClient();
  const lotteries = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
  });
  const lotteryId = lotteries.data?.find((row) => row.slug === "timemania")?.id;
  const current = useSecondaryOptions("timemania", lotteryId);
  const save = useServerFn(saveLotteryClubs);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseClubLines(text), [text]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await save({ data: { slug: "timemania", text } });
      await queryClient.invalidateQueries({ queryKey: ["secondary-options"] });
      setText("");
      toast.success(`Timemania: ${result.count} clubes ativos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os clubes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface-card space-y-3 p-4">
      <div>
        <h2 className="font-display text-sm font-semibold text-text-primary">
          Clubes da Timemania
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {current.options.length > 0
            ? `${current.options.length} clubes ativos.`
            : "Nenhum clube cadastrado — sem eles ninguém consegue criar jogos da Timemania."}{" "}
          A lista oficial muda a cada dois anos; cole a lista nova para substituí-la. Clubes que
          saírem deixam de ser escolhidos, e os jogos antigos continuam consultáveis.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="clubs-text">Um clube por linha, no formato Nome/UF</Label>
        <textarea
          id="clubs-text"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"Flamengo/RJ\nCorinthians/SP\nSão Paulo/SP"}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-text-primary"
        />
        {text.trim() ? (
          <p className="text-xs text-text-secondary">
            {parsed.clubs.length} clubes reconhecidos
            {parsed.invalid.length > 0
              ? ` · ${parsed.invalid.length} linha(s) sem UF: ${parsed.invalid.slice(0, 3).join("; ")}`
              : ""}
          </p>
        ) : null}
      </div>
      <Button
        size="sm"
        className="h-11"
        disabled={saving || parsed.clubs.length === 0 || parsed.invalid.length > 0}
        onClick={() => void submit()}
      >
        {saving ? "Salvando…" : "Substituir lista de clubes"}
      </Button>
    </section>
  );
}
