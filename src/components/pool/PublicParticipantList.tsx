/**
 * Lista pública de participantes confirmados.
 *
 * Apresentação tabular responsiva: no desktop, três colunas
 * (Participante | Cotas | Pagamento); no celular, uma linha compacta
 * "Nome · 1 COTA · PAGO", sem tabela larga e sem rolagem horizontal.
 * Só recebe quem já pagou integralmente — a filtragem acontece no banco.
 */
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterParticipants,
  publicPreviewSize,
  quotaTextUpper,
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
        <div className="min-w-0">
          {/* Cabeçalho só no desktop: no celular as linhas já se explicam. */}
          <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 border-b border-border pb-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary sm:grid">
            <span>Participante</span>
            <span className="text-right">Cotas</span>
            <span className="text-right">Pagamento</span>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((participant, index) => (
              <li
                // A identidade da linha é a posição na lista devolvida pelo banco,
                // nunca o texto do nome: homônimos continuam sendo pessoas distintas.
                key={index}
                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-4"
              >
                <span className="min-w-0 max-w-full truncate text-sm font-medium text-text-primary">
                  {participant.name}
                </span>
                <span aria-hidden className="text-xs text-border sm:hidden">
                  ·
                </span>
                <span className="shrink-0 text-xs font-bold uppercase tabular-nums text-text-secondary sm:text-right">
                  {quotaTextUpper(participant.quotas)}
                </span>
                <span aria-hidden className="text-xs text-border sm:hidden">
                  ·
                </span>
                <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-success sm:text-right">
                  Pago
                </span>
              </li>
            ))}
          </ul>
        </div>
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
