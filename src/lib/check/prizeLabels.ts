/**
 * Linguagem da premiação por faixa — camada pura (sem banco nem interface).
 *
 * Regra inegociável: `null` e `0` significam coisas diferentes e nunca são
 * convertidos um no outro.
 * - `null` = a fonte oficial ainda não informou o valor;
 * - `0`    = a fonte oficial informou zero (normalmente faixa sem ganhadores).
 *
 * Só afirmamos "acumulou" quando a fonte oficial também informou
 * `winners = 0`. Sem essa informação, o texto fica descritivo.
 */
import { formatCurrency } from "@/lib/format";

export interface PrizeValueLabel {
  /** Valor a exibir (moeda ou aviso de valor pendente). */
  value: string;
  /** Explicação adicional; `null` quando não é necessária. */
  note: string | null;
  /** Verdadeiro quando o valor oficial ainda não foi divulgado. */
  pending: boolean;
}

export function prizeValueLabel(
  prizePerCombination: number | null | undefined,
  winners?: number | null,
): PrizeValueLabel {
  if (prizePerCombination == null) {
    return { value: "Valor oficial ainda não informado", note: null, pending: true };
  }
  if (prizePerCombination === 0) {
    if (winners === 0) {
      return {
        value: formatCurrency(0),
        note: "Faixa atingida — concurso acumulou nesta faixa (sem ganhadores). Valor oficial por ganhador: R$ 0,00.",
        pending: false,
      };
    }
    return {
      value: formatCurrency(0),
      note: "Faixa atingida — valor oficial informado: R$ 0,00.",
      pending: false,
    };
  }
  return { value: formatCurrency(prizePerCombination), note: null, pending: false };
}
