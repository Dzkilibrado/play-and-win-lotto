/**
 * Lista pública de participantes confirmados.
 * Uma linha por pessoa: nome em destaque, cotas secundárias e o selo "Pago".
 * Só recebe quem já pagou integralmente — a filtragem acontece no banco.
 */
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterParticipants,
  publicPreviewSize,
  quotaText,
  type PublicParticipant,
} from "@/lib/pools/publicPool";

export function PublicParticipantList({
  participants,
}: {
  participants: PublicParticipant[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => filterParticipants(participants, query), [participants, query]);
  const searchable = participants.length > publicPreviewSize.participants;
  const visible = expanded || query ? filtered : filtered.slice(0, publicPreviewSize.participants);
  const hidden = filtered.length - visible.length;

  if (participants.length === 0) {
    return (
      <div className="rounded-lg bg-surface-secondary px-3 py-4 text-sm">
        <p className="font-medium text-text-primary">Nenhum participante confirmado até o momento.</p>
        <p className="mt-0.5 text-text-secondary">
          Os participantes aparecerão aqui após a confirmação do pagamento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {searchable ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar participante"
            aria-label="Buscar participante"
            className="h-11 pl-9"
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="px-1 py-3 text-sm text-text-secondary">
          Nenhum participante encontrado com esse nome.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((participant) => (
            <li
              key={`${participant.name}-${participant.quotas}`}
              // Conjunto compacto: nome · cotas · Pago, alinhados ao início da linha.
              className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2"
            >
              <span className="min-w-0 max-w-full truncate text-sm font-medium text-text-primary">
                {participant.name}
              </span>
              <span aria-hidden className="text-xs text-border">
                ·
              </span>
              <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                {quotaText(participant.quotas)}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                <Check className="size-3 shrink-0" aria-hidden />
                Pago
              </span>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <Button
          variant="outline"
          className="h-11 w-full"
          onClick={() => setExpanded(true)}
        >
          Ver todos os {filtered.length} participantes
        </Button>
      ) : null}
    </div>
  );
}
