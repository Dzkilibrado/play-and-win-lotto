import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { LotteryNumberGrid } from "@/components/lottery/LotteryNumberGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries, getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import { supabase } from "@/integrations/supabase/client";
import { analyzeGame } from "@/lib/engine/analyzer";
import { resolveRules } from "@/lib/engine/rules";
import { extractGameFromPhoto, type PhotoDocumentKind } from "@/lib/gameImport.functions";
import { statusForReceipt, type ContestSituation } from "@/lib/games/gameStatus";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { useSession } from "@/hooks/useAuth";
import { gameStatusLabel, type GameStatus } from "@/types/domain";

export const Route = createFileRoute("/_authenticated/games/importar")({
  head: () => ({
    meta: [
      { title: `Importar jogo por foto — ${appConfig.name}` },
      {
        name: "description",
        content: "Envie a foto do canhoto ou do comprovante e revise as dezenas antes de salvar.",
      },
      { property: "og:title", content: `Importar jogo por foto — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Envie a foto do canhoto ou do comprovante e revise as dezenas antes de salvar.",
      },
    ],
  }),
  component: ImportGamePage,
});

type Step = "capture" | "review";

const kindLabel: Record<PhotoDocumentKind, string> = {
  TICKET: "Canhoto (aposta não comprovada)",
  RECEIPT: "Comprovante de aposta paga",
  UNKNOWN: "Não identificado",
};

function ImportGamePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const extract = useServerFn(extractGameFromPhoto);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [kind, setKind] = useState<PhotoDocumentKind>("UNKNOWN");
  const [slug, setSlug] = useState<LotterySlug | "">("");
  const [contestText, setContestText] = useState("");
  const [dateText, setDateText] = useState("");
  const [numbers, setNumbers] = useState<number[]>([]);
  const [readingNotes, setReadingNotes] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<string[]>([]);

  const rules = useMemo(() => resolveRules(slug || null), [slug]);
  const config = getLotteryConfig(slug || null);
  const contestNumber = Number(contestText);
  const hasContest = Number.isInteger(contestNumber) && contestNumber > 0;

  const contestQuery = useQuery({
    queryKey: ["import-contest", slug, contestNumber],
    enabled: Boolean(slug) && hasContest,
    queryFn: () => lotteryDataService.resolveContest(slug as string, contestNumber),
  });
  const situation: ContestSituation = hasContest
    ? (contestQuery.data?.situation ?? "unknown")
    : "unknown";

  const nextContestQuery = useQuery({
    queryKey: ["import-next-contest", slug],
    enabled: Boolean(slug),
    queryFn: () => lotteryDataService.getNextContest(slug as string),
  });

  const byDateQuery = useQuery({
    queryKey: ["import-contest-by-date", slug, dateText],
    enabled: Boolean(slug) && /^\d{4}-\d{2}-\d{2}$/.test(dateText),
    queryFn: () => lotteryDataService.findContestsByDate(slug as string, dateText),
  });

  const lotteriesQuery = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
  });

  const issues = useMemo(() => {
    const list: string[] = [];
    if (!config || !rules) {
      list.push("Escolha a modalidade do jogo.");
      return list;
    }
    const outOfRange = numbers.filter(
      (value) => value < rules.universe.min || value > rules.universe.max,
    );
    if (outOfRange.length) {
      list.push(
        `Dezenas fora do intervalo da ${rules.name} (${rules.universe.min} a ${rules.universe.max}).`,
      );
    }
    if (numbers.length < rules.selectable.min || numbers.length > rules.selectable.max) {
      list.push(
        `A ${rules.name} aceita de ${rules.selectable.min} a ${rules.selectable.max} dezenas. Você marcou ${numbers.length}.`,
      );
    }
    // Canhoto e comprovante exigem o concurso confirmado por você antes de salvar.
    if (!hasContest) {
      list.push("Informe e confirme o concurso deste jogo.");
    }
    if (hasContest && kind === "TICKET" && situation === "drawn") {
      list.push("Este concurso já foi sorteado. Escolha um concurso futuro para o canhoto.");
    }
    return list;
  }, [config, rules, numbers, kind, hasContest, situation]);

  const suggestedStatus: GameStatus =
    kind === "RECEIPT" ? statusForReceipt(situation) : ("PLANNED" as GameStatus);


  const onPick = async (picked: File | null) => {
    setFileError(null);
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setFileError("Envie uma imagem (foto do canhoto ou do comprovante).");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      setFileError("A imagem precisa ter até 10 MB.");
      return;
    }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));

    setBusy(true);
    try {
      const base64 = await toBase64(picked);
      const result = await extract({ data: { imageBase64: base64, mimeType: picked.type } });
      setKind(result.documentKind);
      setSlug((result.lotterySlug as LotterySlug | null) ?? "");
      setContestText(result.contestNumber ? String(result.contestNumber) : "");
      setNumbers(result.numbers);
      setReadingNotes(result.notes);
      setUncertain(result.uncertainFields);
      setStep("review");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Não foi possível ler a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const toggleNumber = (value: number) => {
    setNumbers((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  };

  const save = async () => {
    if (!user || !rules || !config || issues.length) return;
    const lotteryRow = (lotteriesQuery.data ?? []).find((row) => row.slug === config.slug);
    if (!lotteryRow) {
      toast.error("Modalidade indisponível no momento.");
      return;
    }

    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${extension}`;
        const { error } = await supabase.storage
          .from("game-imports")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        imagePath = path;
      }

      const price = await lotteryDataService.getActivePrice(lotteryRow.id, numbers.length);
      const analysis = analyzeGame(numbers, rules, {});

      const id = await gameService.saveGame({
        userId: user.id,
        lotteryId: lotteryRow.id,
        numbers,
        analysis,
        contestNumber: hasContest ? contestNumber : null,
        drawId: contestQuery.data?.drawId ?? null,
        price: price
          ? {
              priceId: price.id,
              price: Number(price.price),
              combinationCount: Number(price.combination_count),
              source: price.source,
            }
          : null,
        source: kind === "RECEIPT" ? "PHOTO_RECEIPT" : "PHOTO_TICKET",
        status: suggestedStatus,
        imagePath,
        extraNotes:
          "origem=foto; revisado_pelo_usuario=sim" +
          (situation === "unknown" ? "; situacao_concurso=nao_validada" : ""),
      });

      toast.success(
        situation === "unknown"
          ? "Jogo salvo. Ainda não foi possível validar a situação deste concurso."
          : "Jogo importado e salvo.",
      );

      void navigate({ to: "/games/$id", params: { id } });
    } catch {
      toast.error("Não foi possível salvar o jogo importado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Importar jogo por foto"
        description="Fotografe o canhoto ou o comprovante. Você confere tudo antes de salvar."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/games">Voltar</Link>
          </Button>
        }
      />

      {step === "capture" ? (
        <section className="surface-card space-y-4 p-4">
          <h2 className="font-display text-sm font-semibold text-text-primary">Enviar imagem</h2>
          <p className="text-xs text-text-secondary">
            Use boa iluminação, mantenha o papel plano e enquadre todas as dezenas.
          </p>

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => void onPick(event.target.files?.[0] ?? null)}
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => void onPick(event.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-2">
            <Button className="h-11" disabled={busy} onClick={() => cameraInput.current?.click()}>
              <Camera className="size-4" aria-hidden />
              Tirar foto
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <ImageIcon className="size-4" aria-hidden />
              Escolher da galeria
            </Button>
          </div>

          {busy ? (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Lendo a imagem…
            </p>
          ) : null}

          {fileError ? <ErrorState title="Não deu certo" description={fileError} /> : null}

          <div className="rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary">
            <p className="mb-1 flex items-center gap-1 font-medium text-text-primary">
              <Info className="size-3.5" aria-hidden />
              Como a leitura funciona
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                A imagem é enviada ao nosso servidor e lida por um serviço de inteligência
                artificial multimodal contratado pelo aplicativo.
              </li>
              <li>
                O custo da leitura é do aplicativo; você não paga por foto e não precisa de chave
                própria.
              </li>
              <li>
                A leitura é uma estimativa: fotos tortas, com brilho, dobras ou marcações fracas
                podem gerar erros. Por isso a revisão é obrigatória.
              </li>
              <li>A foto fica guardada em área privada, visível apenas para você.</li>
            </ul>
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <>
          <section className="surface-card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Confira antes de salvar
              </h2>
              <StatusBadge
                label={kindLabel[kind]}
                tone={kind === "RECEIPT" ? "success" : kind === "TICKET" ? "info" : "warning"}
              />
            </div>

            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Foto enviada do jogo"
                className="max-h-64 w-full rounded-lg object-contain"
              />
            ) : null}

            {readingNotes ? <p className="text-xs text-text-secondary">{readingNotes}</p> : null}
            {uncertain.length ? (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                A leitura ficou em dúvida em alguns pontos. Revise com atenção.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="import-kind">Tipo de imagem</Label>
                <select
                  id="import-kind"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as PhotoDocumentKind)}
                >
                  <option value="TICKET">Canhoto</option>
                  <option value="RECEIPT">Comprovante</option>
                  <option value="UNKNOWN">Não identificado</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="import-lottery">Modalidade</Label>
                <select
                  id="import-lottery"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value as LotterySlug)}
                >
                  <option value="">Selecione</option>
                  {activeLotteries.map((lottery) => (
                    <option key={lottery.slug} value={lottery.slug}>
                      {lottery.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="import-contest">Concurso</Label>
                <input
                  id="import-contest"
                  inputMode="numeric"
                  placeholder="Opcional para canhoto"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                  value={contestText}
                  onChange={(event) => setContestText(event.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            {hasContest && situation === "unknown" ? (
              <p className="text-xs text-warning">
                Ainda não temos esse concurso no aplicativo. Confira o número informado.
              </p>
            ) : null}
          </section>

          <section className="surface-card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text-primary">Dezenas</h2>
              <span className="text-xs text-text-secondary">
                {numbers.length} marcadas
                {rules ? ` · permitido de ${rules.selectable.min} a ${rules.selectable.max}` : ""}
              </span>
            </div>
            {rules ? (
              <LotteryNumberGrid rules={rules} picked={numbers} onSelect={toggleNumber} />
            ) : (
              <p className="text-xs text-text-secondary">
                Escolha a modalidade para conferir as dezenas.
              </p>
            )}

            {issues.length ? (
              <ul className="list-disc space-y-1 rounded-md bg-danger-soft px-4 py-2 text-xs text-danger">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="surface-card space-y-2 p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">
              Situação ao salvar
            </h2>
            <StatusBadge label={gameStatusLabel[suggestedStatus]} tone="info" />
            <p className="text-xs text-text-secondary">
              {kind === "RECEIPT"
                ? situation === "drawn"
                  ? "O concurso já foi sorteado, então o jogo entra para conferência."
                  : "Comprovante de aposta paga: o jogo fica aguardando o sorteio."
                : "Canhoto não comprova aposta paga, então o jogo entra como planejado."}
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || issues.length > 0} onClick={() => void save()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Salvar jogo
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setStep("capture");
                setFile(null);
                setPreviewUrl(null);
                setNumbers([]);
              }}
            >
              Enviar outra foto
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
