/**
 * Extração de jogos a partir de foto.
 *
 * Pipeline: aquisição (cliente) -> processamento/extração (aqui, no servidor)
 * -> validação pelas regras do sistema (cliente + engine) -> revisão do
 * usuário -> persistência.
 *
 * A interpretação da imagem usa o Lovable AI Gateway (modelo multimodal).
 * A chave nunca sai do servidor.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PhotoDocumentKind = "TICKET" | "RECEIPT" | "UNKNOWN";

export interface PhotoExtraction {
  documentKind: PhotoDocumentKind;
  /** slug da modalidade quando reconhecida: mega-sena | lotofacil | quina */
  lotterySlug: string | null;
  contestNumber: number | null;
  numbers: number[];
  betAmount: number | null;
  betDate: string | null;
  /** Campos que a leitura não conseguiu confirmar — usados só para orientar a revisão. */
  uncertainFields: string[];
  notes: string | null;
}

interface RawExtraction {
  document_kind?: unknown;
  lottery?: unknown;
  contest_number?: unknown;
  numbers?: unknown;
  bet_amount?: unknown;
  bet_date?: unknown;
  uncertain_fields?: unknown;
  notes?: unknown;
}

const PROMPT = `Você analisa fotos de loterias brasileiras (Mega-Sena, Lotofácil e Quina).

Classifique a imagem em:
- "TICKET": volante/canhoto de papel com dezenas marcadas à mão (quadradinhos pintados), sem comprovação de pagamento.
- "RECEIPT": comprovante/recibo impresso de aposta já registrada e paga (contém número do concurso, data, valor, código da aposta).
- "UNKNOWN": não é possível determinar.

Extraia, sem inventar nada:
- lottery: "mega-sena", "lotofacil", "quina" ou null.
- contest_number: número do concurso impresso (inteiro) ou null. Em volantes/canhotos normalmente não existe: use null. NUNCA deduza, calcule ou presuma o próximo concurso — só informe o número que estiver legível na imagem.
- numbers: lista das dezenas marcadas/jogadas, como inteiros, sem repetição, em ordem crescente. Se não conseguir ler todas com segurança, retorne apenas as que tem certeza.
- bet_amount: valor da aposta em reais (número) ou null.
- bet_date: data no formato AAAA-MM-DD ou null.
- uncertain_fields: lista com nomes de campos que você não conseguiu confirmar, entre "lottery", "contest_number", "numbers", "bet_amount", "bet_date".
- notes: observação curta em português sobre a leitura, ou null.

Responda SOMENTE com JSON válido no formato:
{"document_kind":"...","lottery":...,"contest_number":...,"numbers":[...],"bet_amount":...,"bet_date":...,"uncertain_fields":[...],"notes":...}`;

function parseNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const list = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0 && item <= 99);
  return [...new Set(list)].sort((a, b) => a - b);
}

function parseKind(value: unknown): PhotoDocumentKind {
  const text = String(value ?? "").toUpperCase();
  if (text === "TICKET" || text === "RECEIPT") return text;
  return "UNKNOWN";
}

function parseSlug(value: unknown): string | null {
  const text = String(value ?? "")
    .toLowerCase()
    .trim();
  if (text === "mega-sena" || text === "megasena" || text === "mega sena") return "mega-sena";
  if (text === "lotofacil" || text === "lotofácil") return "lotofacil";
  if (text === "quina") return "quina";
  return null;
}

export const extractGameFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imageBase64: string; mimeType: string }) => {
    if (!data?.imageBase64 || typeof data.imageBase64 !== "string") {
      throw new Error("Imagem ausente.");
    }
    if (data.imageBase64.length > 14_000_000) {
      throw new Error("Imagem muito grande. Envie uma foto de até 10 MB.");
    }
    return { imageBase64: data.imageBase64, mimeType: data.mimeType || "image/jpeg" };
  })
  .handler(async ({ data }): Promise<PhotoExtraction> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Serviço de leitura de imagem indisponível.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) {
      throw new Error("Muitas leituras seguidas. Tente novamente em instantes.");
    }
    if (response.status === 402) {
      throw new Error("Créditos de leitura de imagem esgotados.");
    }
    if (!response.ok) {
      throw new Error("Não foi possível ler a imagem agora.");
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Não foi possível interpretar a imagem.");

    let raw: RawExtraction;
    try {
      raw = JSON.parse(match[0]) as RawExtraction;
    } catch {
      throw new Error("Não foi possível interpretar a imagem.");
    }

    const contest = Number(raw.contest_number);
    const amount = Number(raw.bet_amount);
    const dateText = typeof raw.bet_date === "string" ? raw.bet_date : null;

    return {
      documentKind: parseKind(raw.document_kind),
      lotterySlug: parseSlug(raw.lottery),
      contestNumber: Number.isInteger(contest) && contest > 0 ? contest : null,
      numbers: parseNumbers(raw.numbers),
      betAmount: Number.isFinite(amount) && amount > 0 ? amount : null,
      betDate: dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : null,
      uncertainFields: Array.isArray(raw.uncertain_fields)
        ? raw.uncertain_fields.map((item) => String(item))
        : [],
      notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null,
    };
  });
