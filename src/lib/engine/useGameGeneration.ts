/**
 * Ponte entre a interface e o motor de geração.
 *
 * A geração roda em um worker dedicado (fora da thread de interface), então a
 * tela continua rolando, animando e respondendo a toques mesmo em cenários
 * muito restritivos. Se o ambiente não tiver worker disponível, caímos para a
 * execução direta — mesmo resultado, apenas sem o ganho de responsividade.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { generateGames, type GenerationOutcome } from "./generator";
import type { AnalyzerContext } from "./analyzer";
import type { GenerationRequest } from "./types";
import type { GenerationWorkerRequest } from "./generation.worker";

type WorkerReply =
  | { requestId: number; ok: true; outcome: GenerationOutcome }
  | { requestId: number; ok: false; message: string };

export interface UseGameGeneration {
  generating: boolean;
  generate: (request: GenerationRequest, analyzer: AnalyzerContext) => Promise<GenerationOutcome | null>;
  cancel: () => void;
}

export function useGameGeneration(): UseGameGeneration {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [generating, setGenerating] = useState(false);

  const disposeWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => disposeWorker, [disposeWorker]);

  const cancel = useCallback(() => {
    // Encerrar o worker interrompe o cálculo imediatamente.
    requestIdRef.current += 1;
    disposeWorker();
    setGenerating(false);
  }, [disposeWorker]);

  const generate = useCallback(
    async (request: GenerationRequest, analyzer: AnalyzerContext) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setGenerating(true);

      if (typeof Worker === "undefined") {
        try {
          return generateGames(request, { analyzer });
        } finally {
          setGenerating(false);
        }
      }

      // Um worker por solicitação mantém o cancelamento simples e seguro.
      disposeWorker();
      const worker = new Worker(new URL("./generation.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      try {
        return await new Promise<GenerationOutcome | null>((resolve, reject) => {
          worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
            const reply = event.data;
            if (reply.requestId !== requestIdRef.current) {
              resolve(null);
              return;
            }
            if (reply.ok) resolve(reply.outcome);
            else reject(new Error(reply.message));
          });
          worker.addEventListener("error", () => {
            // Falha ao carregar o worker: executamos direto para não travar o fluxo.
            try {
              resolve(generateGames(request, { analyzer }));
            } catch (error) {
              reject(error instanceof Error ? error : new Error("Falha na geração."));
            }
          });
          const payload: GenerationWorkerRequest = { requestId, request, analyzer };
          worker.postMessage(payload);
        });
      } finally {
        if (requestIdRef.current === requestId) {
          disposeWorker();
          setGenerating(false);
        }
      }
    },
    [disposeWorker],
  );

  return { generating, generate, cancel };
}
