/**
 * Lista pública de participantes confirmados.
 *
 * Apresentação tabular responsiva com três colunas reais em qualquer largura.
 * Só recebe quem já pagou integralmente — a filtragem acontece no banco.
 */
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
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
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar participante"
          ariaLabel="Buscar participante"
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="px-1 py-3 text-sm text-text-secondary">
          Nenhum participante encontrado com esse nome.
        </p>
      ) : (
        <div className="min-w-0 rounded-md border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.75rem] items-center gap-x-2 border-b border-border bg-surface-secondary px-2 py-2 text-[0.6875rem] font-semibold uppercase text-text-secondary sm:hidden">
            <span>Participante</span>
            <span>Cotas</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border sm:hidden" aria-label="Participantes confirmados">
            {visible.map((participant) => (
              <li
                // Identidade pública estável vinda do banco — nunca o texto do
                // nome (homônimos são pessoas distintas) nem a posição visível
                // (que muda com busca e filtro), nem o identificador interno.
                key={participant.ordinal}
                className="grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_3.5rem_4.75rem] items-center gap-x-2 px-2 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium text-text-primary" title={participant.name}>
                  {participant.name}
                </span>
                <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary">
                  {quotaText(participant.quotas)}
                </span>
                <StatusBadge label="✓ Pago" tone="success" className="justify-self-start whitespace-nowrap px-2" />
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed text-sm sm:table">
            <caption className="sr-only">Participantes confirmados</caption>
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-28" />
            </colgroup>
            <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2">Participante</th>
                <th scope="col" className="px-3 py-2">Cotas</th>
                <th scope="col" className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((participant) => (
                <tr key={participant.ordinal}>
                  <td className="min-w-0 px-3 py-2.5"><span className="block truncate font-medium text-text-primary" title={participant.name}>{participant.name}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-text-secondary">{quotaText(participant.quotas)}</td>
                  <td className="px-3 py-2.5"><StatusBadge label="✓ Pago" tone="success" className="whitespace-nowrap" /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
