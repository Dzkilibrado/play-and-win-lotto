/**
 * Textos do "Meu Destino": frases místicas (sem explicar a análise) e o aviso
 * de responsabilidade, que sempre acompanha o resultado.
 */
import { createRng } from "./hash";
import type { Intention } from "./profile";

export const mysticDisclaimer =
  "Entretenimento. Loteria é jogo de azar e nenhum método, inclusive este, garante prêmio. Jogue com responsabilidade. Proibido para menores de 18 anos.";

export const loadingPhrases = [
  "Observando o céu do seu nascimento…",
  "Ouvindo o que os números dizem sobre você…",
  "Alinhando os astros ao seu caminho…",
  "Consultando o universo…",
  "Traduzindo o seu destino em números…",
] as const;

const revealPhrases: Record<Intention, readonly string[]> = {
  SORTE: [
    "O universo escolheu estes números para você.",
    "Os astros alinharam estes números ao seu caminho.",
    "Seu destino sussurrou estes números.",
  ],
  AMOR: [
    "Guiados pelo coração do cosmos, estes são os seus números.",
    "O universo, tocado pelo amor, reservou estes números a você.",
    "Os astros do afeto indicam estes números.",
  ],
  DINHEIRO: [
    "A energia da abundância desenhou estes números para você.",
    "Os astros da prosperidade apontam estes números.",
    "O universo, em favor da fartura, reservou estes números.",
  ],
  SAUDE: [
    "Em equilíbrio com os astros, estes são os seus números.",
    "O universo, em harmonia, indica estes números.",
    "A energia do bem-estar revelou estes números.",
  ],
  TRABALHO: [
    "O caminho da conquista revelou estes números.",
    "Os astros da realização apontam estes números.",
    "O universo, em favor do seu esforço, reservou estes números.",
  ],
};

/** Frase estável para a mesma leitura (mesma semente = mesma frase). */
export function revealPhrase(intention: Intention, seed: string): string {
  const list = revealPhrases[intention];
  return list[Math.floor(createRng(`frase|${seed}`)() * list.length)]!;
}

export const immutableNotice =
  "Os números do seu destino não mudam. Eles já foram mapeados pelos astros para estes dados.";
