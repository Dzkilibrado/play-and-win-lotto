import { NumberBall } from "@/components/lottery/NumberBall";
import { StatusBadge } from "@/components/common/StatusBadge";
import { checkDisclaimer } from "@/config/check.config";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { CheckResultRow } from "@/lib/services/checkService";

/**
 * Resultado da conferência de um jogo, em linguagem simples.
 * Só exibe o que o servidor gravou — nada é recalculado aqui.
 */
export function CheckResultPanel({
  result,
  gameNumbers,
  drawNumbers,
}: {
  result: CheckResultRow;
  gameNumbers: number[];
  drawNumbers?: number[];
}) {
  const matched = new Set(result.matched_numbers ?? []);
  const breakdown = [...(result.game_prize_breakdown ?? [])].sort(
    (a, b) => b.hits_required - a.hits_required,
  );
  const detailed = breakdown.length > 1 || (breakdown[0]?.winning_combinations ?? 1) > 1;

  return (
    <section className="surface-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-text-primary">
          Resultado da conferência
        </h2>
        <StatusBadge
          label={result.is_prized ? "Premiado" : "Não premiado"}
          tone={result.is_prized ? "success" : "neutral"}
        />
      </div>

      <p className="text-sm text-text-primary">
        <span className="font-display text-2xl font-semibold">{result.hits}</span>{" "}
        {result.hits === 1 ? "dezena acertada" : "dezenas acertadas"} no concurso{" "}
        {result.contest_number}.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium text-text-secondary">Suas dezenas</p>
        <div className="flex flex-wrap gap-1.5">
          {[...gameNumbers].sort((a, b) => a - b).map((number) => (
            <NumberBall
              key={number}
              value={number}
              size="sm"
              variant={matched.has(number) ? "hit" : "muted"}
            />
          ))}
        </div>
        <p className="text-xs text-text-secondary">
          Em verde, as dezenas que saíram no sorteio.
        </p>
      </div>

      {drawNumbers && drawNumbers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Dezenas sorteadas</p>
          <div className="flex flex-wrap gap-1.5">
            {[...drawNumbers].sort((a, b) => a - b).map((number) => (
              <NumberBall key={number} value={number} size="sm" variant="lottery" />
            ))}
          </div>
        </div>
      ) : null}

      {result.is_prized ? (
        <div className="space-y-2 rounded-lg bg-success-soft p-3">
          <p className="text-sm font-medium text-success">
            Faixa alcançada: {result.prize_label ?? `${result.prize_tier_hits} acertos`}
          </p>
          <p className="font-display text-xl font-semibold text-text-primary">
            {result.amount_pending && result.total_prize == null
              ? "Valor ainda não informado"
              : formatCurrency(result.total_prize)}
          </p>
          {result.amount_pending ? (
            <p className="text-xs text-text-secondary">
              Alguma faixa ainda não tem valor divulgado pela fonte oficial. O total é atualizado
              quando o valor for publicado.
            </p>
          ) : null}
          {zeroNotes.map((note) => (
            <p key={note} className="text-xs text-text-secondary">
              {note}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          Este jogo não atingiu nenhuma faixa de premiação neste concurso.
        </p>
      )}

      {detailed && result.is_prized ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">Como o valor foi calculado</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Faixa</th>
                  <th className="px-2 py-2 text-right font-medium">Apostas</th>
                  <th className="px-2 py-2 text-right font-medium">Valor cada</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-2 py-2 text-text-primary">{entry.tier}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-primary">
                      {formatNumber(entry.winning_combinations)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                      {entry.prize_per_combination == null
                        ? "—"
                        : formatCurrency(entry.prize_per_combination)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-primary">
                      {entry.total_for_tier == null ? "—" : formatCurrency(entry.total_for_tier)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-secondary">
            Uma aposta com mais dezenas equivale a várias apostas simples: cada faixa mostra
            quantas dessas apostas foram premiadas.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-text-secondary">
        Conferido em {formatDate(result.checked_at.slice(0, 10))}. {checkDisclaimer}
      </p>
    </section>
  );
}
