import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseClubLines(text), [text]);
  const total = current.options.length;

  const submit = async () => {
    setSaving(true);
    try {
      const result = await save({ data: { slug: "timemania", text } });
      await queryClient.invalidateQueries({ queryKey: ["secondary-options"] });
      setText("");
      setOpen(false);
      toast.success(`Timemania: ${result.count} clubes ativos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar os clubes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="clubs-title">
      <h2 id="clubs-title" className="font-display text-base font-semibold text-text-primary">
        Clubes da Timemania
      </h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="surface-card tappable flex min-h-16 w-full items-center gap-3 p-4 text-left hover:border-primary"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text-primary">
            {total > 0 ? `${total} clubes ativos` : "Nenhum clube cadastrado"}
          </span>
          <span className="block text-xs text-text-secondary">
            {total > 0
              ? "Toque para atualizar a lista oficial."
              : "Sem clubes, ninguém cria jogos da Timemania."}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-text-secondary" aria-hidden />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90vh] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Atualizar clubes</DrawerTitle>
            <DrawerDescription>
              A lista oficial muda a cada dois anos. Cole a lista nova para substituir a atual;
              clubes que saírem deixam de ser escolhidos e os jogos antigos continuam consultáveis.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-6">
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
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="h-12 flex-1"
                disabled={saving || parsed.clubs.length === 0 || parsed.invalid.length > 0}
                onClick={() => void submit()}
              >
                {saving ? "Salvando…" : "Substituir lista"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
