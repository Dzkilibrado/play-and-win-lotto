/**
 * Worker de geração.
 *
 * O motor é CPU-bound e tem orçamento de alguns segundos; rodando aqui ele
 * nunca ocupa a thread de interface. As regras matemáticas são exatamente as
 * mesmas: este arquivo apenas transporta a requisição e devolve o resultado.
 *
 * A fonte de aleatoriedade continua sendo `crypto.getRandomValues`, disponível
 * também no escopo do worker (default de `generateGames`).
 */
import { generateGames } from "./generator";
import type { AnalyzerContext } from "./analyzer";
import type { GenerationRequest } from "./types";

export interface GenerationWorkerRequest {
  requestId: number;
  request: GenerationRequest;
  analyzer: AnalyzerContext;
}

self.addEventListener("message", (event: MessageEvent<GenerationWorkerRequest>) => {
  const { requestId, request, analyzer } = event.data;
  try {
    const outcome = generateGames(request, { analyzer });
    (self as unknown as Worker).postMessage({ requestId, ok: true as const, outcome });
  } catch (error) {
    (self as unknown as Worker).postMessage({
      requestId,
      ok: false as const,
      message: error instanceof Error ? error.message : "Falha inesperada na geração.",
    });
  }
});
