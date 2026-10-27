/**
 * "Meu Destino": modo de criação de jogos por numerologia e astrologia.
 * Passos: dados → conferência → animação → resultado (ou aviso de leitura repetida).
 * Entretenimento: não altera a chance de acerto (aviso sempre exibido).
 */
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DestinoProgress } from "@/components/destino/DestinoProgress";
import { DestinoResult } from "@/components/destino/DestinoResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lotteryConfigs, type LotterySlug } from "@/config/lotteries";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useLotteryAvailability } from "@/hooks/useLotteryAvailability";
import { useNextDraws } from "@/hooks/useNextDraws";
import { useSecondaryOptions } from "@/hooks/useSecondaryOptions";
import { analyzeGame } from "@/lib/engine/analyzer";
import { resolveRules } from "@/lib/engine/rules";
import { formatCurrency } from "@/lib/format";
import {
  loadMunicipalities,
  searchMunicipalities,
  type Municipality,
} from "@/lib/mystic/birthTime";
import { generateMysticGames, type MysticGame } from "@/lib/mystic/generator";
import { immutableNotice, mysticDisclaimer, revealPhrase } from "@/lib/mystic/messages";
import { maxMysticGames, mergeWithStored, planGames } from "@/lib/mystic/plan";
import {
  destinySeed,
  intentionLabel,
  intentions,
  readingFingerprint,
  traditionLabel,
  traditions,
  type Intention,
  type MysticInput,
  type Tradition,
} from "@/lib/mystic/profile";
import { findReading, saveReading } from "@/lib/mystic/readings";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

type Step = "form" | "confirm" | "reading" | "repeat" | "result";
type Kind = "individual" | "bolao";

function formatBirth(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  const year = date.getUTCFullYear();
  return !Number.isNaN(date.getTime()) && year >= 1900 && date.getTime() <= Date.now();
}

export function MeuDestinoFlow() {
  const { user } = useSession();
  const profile = useProfile(user);
  const navigate = useNavigate();
  const availability = useLotteryAvailability();
  const nextDraws = useNextDraws();

  const [step, setStep] = useState<Step>("form");
  const [slug, setSlug] = useState<LotterySlug | "">("");
  const [kind, setKind] = useState<Kind>("individual");
  const [people, setPeople] = useState("2");
  const [budget, setBudget] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [place, setPlace] = useState<Municipality | null>(null);
  const [intention, setIntention] = useState<Intention>("SORTE");
  const [tradition, setTradition] = useState<Tradition>("COMBINADA");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [games, setGames] = useState<MysticGame[]>([]);
  const [stored, setStored] = useState<MysticGame[] | null>(null);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Nome e nascimento vêm do perfil, se existirem (o usuário pode ajustar).
  useEffect(() => {
    if (!profile.data) return;
    setFullName((current) => current || profile.data?.display_name || "");
    setBirthDate((current) => current || profile.data?.birth_date || "");
  }, [profile.data]);

  useEffect(() => {
    if (cityQuery.length >= 2 && municipalities.length === 0) {
      void loadMunicipalities().then(setMunicipalities);
    }
  }, [cityQuery, municipalities.length]);

  const lottery = slug ? lotteryConfigs[slug] : null;
  const lotteriesQuery = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
  });
  const lotteryRow = lotteriesQuery.data?.find((row) => row.slug === slug) ?? null;
  const secondary = useSecondaryOptions(slug || undefined, lotteryRow?.id);
  const priceKey = secondary.kind === "trevo" ? secondary.minSelect : 0;
  const priceQuery = useQuery({
    queryKey: ["price", lotteryRow?.id, lottery?.selectable.min, priceKey],
    enabled: Boolean(lotteryRow?.id && lottery),
    queryFn: () =>
      lotteryDataService.getActivePrice(lotteryRow!.id, lottery!.selectable.min, priceKey),
  });
  const unitPrice = priceQuery.data?.price ?? null;
  const budgetValue = Number(budget.replace(",", "."));
  const plan = planGames(budgetValue, unitPrice);
  const nextView = slug ? nextDraws.viewOf(slug) : null;
  const contestNumber = nextView?.kind === "ready" ? nextView.contestNumber : null;

  const peopleValue = Number(people);
  const cityMatches = useMemo(
    () => (place ? [] : searchMunicipalities(municipalities, cityQuery)),
    [municipalities, cityQuery, place],
  );

  const issues: string[] = [];
  if (!lottery) issues.push("Escolha a loteria.");
  if (lottery && unitPrice == null && !priceQuery.isLoading)
    issues.push("Preço oficial indisponível para esta loteria.");
  if (lottery && unitPrice != null && plan.games < 1) {
    issues.push(`O orçamento precisa ser de pelo menos ${formatCurrency(unitPrice)}.`);
  }
  if (
    kind === "bolao" &&
    !(Number.isInteger(peopleValue) && peopleValue >= 2 && peopleValue <= 500)
  ) {
    issues.push("Informe de 2 a 500 pessoas no bolão.");
  }
  if (fullName.trim().length < 3) issues.push("Informe o nome completo.");
  if (!isValidBirthDate(birthDate)) issues.push("Informe uma data de nascimento válida.");

  const input: MysticInput | null =
    lottery && issues.length === 0
      ? {
          fullName,
          birthDate,
          birthTime: place && birthTime ? birthTime : null,
          birthPlace: place
            ? { latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone }
            : null,
          intention,
          tradition,
          groupSize: kind === "bolao" ? peopleValue : null,
        }
      : null;

  const buildGames = (previous: MysticGame[] | null): MysticGame[] => {
    if (!lottery || !input) return [];
    const sizes = Array.from({ length: plan.games }, () => lottery.selectable.min);
    const generated = generateMysticGames(lottery, input, {
      sizes,
      clubOptions: secondary.kind === "time" ? secondary.options.map((option) => option.value) : [],
      currentYear: new Date().getFullYear(),
    });
    return mergeWithStored(generated, previous);
  };

  const confirm = async () => {
    if (!lottery || !input || !user?.id) return;
    try {
      const fingerprint = readingFingerprint(input, lottery.slug, user.id);
      const existing = await findReading(user.id, fingerprint);
      setSaved(null);
      if (existing) {
        setStored(existing.games);
        setGames(buildGames(existing.games));
        setStep("repeat");
      } else {
        setStored(null);
        setStep("reading");
      }
    } catch {
      toast.error("Não foi possível iniciar a leitura. Tente novamente.");
    }
  };

  const finishReading = async () => {
    if (!lottery || !input || !user?.id) return;
    const result = buildGames(null);
    setGames(result);
    setStep("result");
    try {
      await saveReading({
        userId: user.id,
        fingerprint: readingFingerprint(input, lottery.slug, user.id),
        lotterySlug: lottery.slug,
        games: result,
      });
    } catch {
      // A leitura já foi exibida; só não ficará registrada para o aviso de repetição.
    }
  };

  const phrase =
    lottery && input ? revealPhrase(input.intention, destinySeed(input, lottery.slug)) : "";

  const saveAll = async (): Promise<string[] | null> => {
    if (saved) return saved;
    if (!user?.id || !lotteryRow || !lottery) return null;
    if (availability.availabilityOf(lottery.slug) !== "ENABLED") {
      toast.error("Esta modalidade está indisponível no momento.");
      return null;
    }
    const rules = resolveRules(lottery.slug);
    if (!rules) return null;
    setSaving(true);
    try {
      const ids: string[] = [];
      for (const game of games) {
        ids.push(
          await gameService.saveGame({
            userId: user.id,
            lotteryId: lotteryRow.id,
            numbers: game.numbers,
            analysis: analyzeGame(game.numbers, rules),
            secondarySelection: game.secondary,
            contestNumber,
            drawId: null,
            price:
              priceQuery.data && unitPrice != null
                ? {
                    priceId: priceQuery.data.id,
                    price: unitPrice,
                    combinationCount: priceQuery.data.combination_count,
                    source: priceQuery.data.source,
                  }
                : null,
            constraints: null,
            strategy: null,
            extraNotes: "Criado em Meu Destino",
          }),
        );
      }
      setSaved(ids);
      toast.success(ids.length === 1 ? "Jogo salvo." : `${ids.length} jogos salvos.`);
      return ids;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createPool = async () => {
    if (!lotteryRow) return;
    const ids = await saveAll();
    if (!ids) return;
    await navigate({
      to: "/pools/new",
      search: { lotteryId: lotteryRow.id, gameIds: ids.join(",") },
    });
  };

  // ---------- telas ----------

  if (step === "reading") {
    return <DestinoProgress onDone={() => void finishReading()} />;
  }

  if (step === "result" && lottery) {
    return (
      <div className="space-y-4">
        <DestinoResult
          lottery={lottery}
          lotteryId={lotteryRow?.id}
          games={games}
          phrase={phrase}
          unitPrice={unitPrice}
          contestNumber={contestNumber}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-12"
            variant={kind === "bolao" ? "outline" : "default"}
            disabled={saving || Boolean(saved)}
            onClick={() => void saveAll()}
          >
            {saved ? "Jogos salvos" : saving ? "Salvando…" : "Salvar jogos"}
          </Button>
          {kind === "bolao" ? (
            <Button className="h-12" disabled={saving} onClick={() => void createPool()}>
              Criar bolão com esses jogos
            </Button>
          ) : null}
          <Button className="h-12" variant="ghost" onClick={() => setStep("form")}>
            Nova leitura
          </Button>
        </div>
      </div>
    );
  }

  if (step === "repeat" && lottery) {
    const first = stored ?? games;
    return (
      <section className="surface-card space-y-4 p-5" aria-labelledby="destino-repetido">
        <h2 id="destino-repetido" className="font-display text-lg font-semibold text-text-primary">
          Esta análise já foi feita
        </h2>
        <p className="text-sm text-text-secondary">{immutableNotice}</p>
        <div className="space-y-2 rounded-xl bg-lottery-soft p-3" data-lottery={lottery.colorKey}>
          {first.slice(0, 5).map((game, index) => (
            <p key={index} className="font-display text-sm font-semibold text-text-primary">
              Jogo {index + 1}: {game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}
            </p>
          ))}
          {first.length > 5 ? (
            <p className="text-xs text-text-secondary">e mais {first.length - 5} jogo(s)</p>
          ) : null}
        </div>
        <p className="text-sm text-text-primary">Quer mudar algum dado antes de seguir?</p>
        <div className="flex flex-wrap gap-2">
          <Button className="h-12" variant="outline" onClick={() => setStep("form")}>
            Alterar algum dado
          </Button>
          <Button className="h-12" onClick={() => setStep("result")}>
            Ver meus números
          </Button>
        </div>
        <p className="text-xs text-text-secondary">{mysticDisclaimer}</p>
      </section>
    );
  }

  if (step === "confirm" && lottery && input) {
    const rows: [string, string][] = [
      ["Loteria", lottery.name],
      ["Jogos", `${plan.games} (${formatCurrency(plan.total)})`],
      ["Tipo", kind === "bolao" ? `Bolão de ${peopleValue} pessoas` : "Individual"],
      ["Nome", fullName.trim()],
      ["Nascimento", formatBirth(birthDate)],
      ["Hora", place && birthTime ? birthTime : "Não informada"],
      ["Cidade", place ? `${place.name}/${place.uf}` : "Não informada"],
      ["Intenção", intentionLabel[intention]],
      ["Leitura", traditionLabel[tradition]],
    ];
    return (
      <section className="surface-card space-y-4 p-5" aria-labelledby="destino-conferencia">
        <h2
          id="destino-conferencia"
          className="font-display text-lg font-semibold text-text-primary"
        >
          Confira seus dados
        </h2>
        <dl className="divide-y divide-border text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 py-2">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="text-right font-medium text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-text-primary">
          Os números do destino não mudam para os mesmos dados. Está tudo certo?
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="h-12" variant="outline" onClick={() => setStep("form")}>
            Ajustar
          </Button>
          <Button className="h-12" onClick={() => void confirm()}>
            Está tudo certo
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (issues.length === 0) setStep("confirm");
      }}
    >
      <p className="rounded-xl bg-lottery-soft p-3 text-sm text-text-primary">
        Descubra os números do seu destino, mapeados pela numerologia e pelos astros a partir dos
        seus dados.
      </p>

      <fieldset className="surface-card space-y-4 p-4">
        <legend className="px-1 font-display text-sm font-semibold text-text-primary">
          Seu jogo
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="destino-loteria">Loteria</Label>
          <Select value={slug} onValueChange={(value) => setSlug(value as LotterySlug)}>
            <SelectTrigger id="destino-loteria" className="h-12">
              <SelectValue placeholder="Escolha a loteria" />
            </SelectTrigger>
            <SelectContent>
              {availability.enabledLotteries.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destino-orcamento">Quanto você quer investir (R$)</Label>
          <Input
            id="destino-orcamento"
            inputMode="decimal"
            className="h-12"
            placeholder="Ex.: 30,00"
            value={budget}
            onChange={(event) => setBudget(event.target.value.replace(/[^\d.,]/g, ""))}
          />
          {lottery && unitPrice != null ? (
            <p className="text-xs text-text-secondary">
              {plan.games > 0
                ? `${plan.games} jogo(s) de ${lottery.selectable.min} dezenas · sobra ${formatCurrency(plan.change)}`
                : `Cada jogo custa ${formatCurrency(unitPrice)}.`}
              {plan.games >= maxMysticGames
                ? ` Máximo de ${maxMysticGames} jogos por leitura.`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="flex gap-2" role="group" aria-label="Tipo de jogo">
            {(["individual", "bolao"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                className="h-12 flex-1"
                variant={kind === value ? "default" : "outline"}
                onClick={() => setKind(value)}
              >
                {value === "individual" ? "Individual" : "Bolão"}
              </Button>
            ))}
          </div>
        </div>
        {kind === "bolao" ? (
          <div className="space-y-1.5">
            <Label htmlFor="destino-pessoas">Quantas pessoas no bolão</Label>
            <Input
              id="destino-pessoas"
              inputMode="numeric"
              className="h-12"
              value={people}
              onChange={(event) => setPeople(event.target.value.replace(/\D/g, ""))}
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="surface-card space-y-4 p-4">
        <legend className="px-1 font-display text-sm font-semibold text-text-primary">
          Seus dados
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="destino-nome">Nome completo (como no registro)</Label>
          <Input
            id="destino-nome"
            className="h-12"
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="destino-nascimento">Data de nascimento</Label>
            <Input
              id="destino-nascimento"
              type="date"
              className="h-12"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destino-hora">Hora de nascimento (opcional)</Label>
            <Input
              id="destino-hora"
              type="time"
              className="h-12"
              value={birthTime}
              onChange={(event) => setBirthTime(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destino-cidade">Cidade de nascimento (opcional)</Label>
          <Input
            id="destino-cidade"
            className="h-12"
            autoComplete="off"
            placeholder="Digite e escolha na lista"
            value={place ? `${place.name}/${place.uf}` : cityQuery}
            onChange={(event) => {
              setPlace(null);
              setCityQuery(event.target.value);
            }}
          />
          {cityMatches.length > 0 ? (
            <ul className="surface-card divide-y divide-border overflow-hidden" role="listbox">
              {cityMatches.map((item) => (
                <li key={`${item.name}-${item.uf}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="min-h-11 w-full px-3 text-left text-sm hover:bg-surface-secondary"
                    onClick={() => {
                      setPlace(item);
                      setCityQuery("");
                    }}
                  >
                    {item.name}/{item.uf}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-text-secondary">
            Com hora e cidade, a leitura inclui o ascendente. Sem eles, segue sem ele.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="destino-intencao">O que você busca</Label>
            <Select value={intention} onValueChange={(value) => setIntention(value as Intention)}>
              <SelectTrigger id="destino-intencao" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intentions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {intentionLabel[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destino-leitura">Tipo de leitura</Label>
            <Select value={tradition} onValueChange={(value) => setTradition(value as Tradition)}>
              <SelectTrigger id="destino-leitura" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {traditions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {traditionLabel[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      {issues.length > 0 && (slug || fullName || birthDate) ? (
        <ul className="rounded-xl bg-warning-soft p-3 text-sm text-warning" role="status">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <Button type="submit" className="h-12 w-full sm:w-auto" disabled={issues.length > 0}>
        Revisar meus dados
      </Button>
      <p className="text-xs text-text-secondary">{mysticDisclaimer}</p>
    </form>
  );
}
