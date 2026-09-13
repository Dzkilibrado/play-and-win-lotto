import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { buildPoolReportDefinition, createPoolReportPdf, poolReportFileName, type PoolReportData } from "./poolReportPdf";
import type { PoolParticipantRow, PoolRow } from "@/lib/services/poolService";

const pool = {
  name: "Bolão Galera Gmill",
  contest_number: 3780,
  contest_number_planned: null,
  draw_date: "2026-09-15",
  draw_date_planned: null,
  quota_value: 60,
  total_quotas: 23,
  status: "AWAITING_DRAW",
  lotteries: { name: "Lotofácil", slug: "lotofacil", short_name: "Lotofácil", color_key: "lotofacil" },
  pool_share_links: [{ scope: "FULL", token: "relatorio-publico", revoked_at: null }],
} as unknown as PoolRow;

const participants = Array.from({ length: 23 }, (_, index) => ({
  id: String(index), pool_id: "pool", user_id: null, name: `Participante ${index + 1}`,
  phone: index === 0 ? "11999999999" : null, quotas: 1, amount_due: 60, amount_adjustment: 0,
  adjustment_reason: null, total_paid: 60, payment_status: "PAID", status: "ACTIVE",
  eligible_for_prize_share: true, ineligible_reason: null, paid_at: "2026-09-12", notes: "privado", created_at: "2026-09-12",
})) as PoolParticipantRow[];

const data: PoolReportData = {
  pool,
  participants,
  games: Array.from({ length: 19 }, (_, index) => ({
    gameId: `game-${index}`, sequence: index + 1, status: "BET", contestNumber: 3780,
    cost: index === 18 ? 29 : 75, numbers: Array.from({ length: 15 }, (_, number) => number + 1),
  })),
  checks: new Map(),
  officialPrizeTotal: 0,
  generatedAt: new Date("2026-09-12T19:52:00Z"),
};

describe("relatório PDF do bolão", () => {
  it("anexa todas as páginas de um comprovante PDF", async () => {
    const attachment = await PDFDocument.create();
    attachment.addPage();
    attachment.addPage();
    const attachmentBytes = await attachment.save();
    const baseBlob = await createPoolReportPdf(data);
    const base = await PDFDocument.load(await baseBlob.arrayBuffer());
    const bytes = new Uint8Array(attachmentBytes.byteLength);
    bytes.set(attachmentBytes);
    const mergedBlob = await createPoolReportPdf({ ...data, documents: [{ title: "Comprovante", mimeType: "application/pdf", bytes: bytes.buffer }] });
    const merged = await PDFDocument.load(await mergedBlob.arrayBuffer());
    expect(merged.getPageCount()).toBe(base.getPageCount() + 3);
  });

  it("não mascara um comprovante corrompido com uma página substituta", async () => {
    await expect(createPoolReportPdf({ ...data, documents: [{ title: "Arquivo incompatível", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]).buffer }] })).rejects.toThrow();
  });

  it("não inclui comprovantes quando a opção está desmarcada", async () => {
    const attachment = await PDFDocument.create();
    attachment.addPage();
    const bytes = await attachment.save();
    const baseBlob = await createPoolReportPdf({ ...data, sections: { participants: true, games: true, documents: false } });
    const documentBytes = new Uint8Array(bytes.byteLength);
    documentBytes.set(bytes);
    const outputBlob = await createPoolReportPdf({ ...data, sections: { participants: true, games: true, documents: false }, documents: [{ title: "Ignorado", mimeType: "application/pdf", bytes: documentBytes.buffer }] });
    const [base, output] = await Promise.all([PDFDocument.load(await baseBlob.arrayBuffer()), PDFDocument.load(await outputBlob.arrayBuffer())]);
    expect(output.getPageCount()).toBe(base.getPageCount());
    expect(JSON.stringify(buildPoolReportDefinition({ ...data, sections: { participants: true, games: true, documents: false }, documents: [{ title: "Ignorado", mimeType: "application/pdf", bytes: documentBytes.buffer }] }))).not.toContain("Comprovantes");
  });

  it.each([1, 2, 5, 10])("inclui a seção para %i comprovante(s)", (count) => {
    const definition = buildPoolReportDefinition({
      ...data,
      documents: Array.from({ length: count }, (_, index) => ({ title: `Comprovante ${index + 1}`, mimeType: "application/pdf" as const, bytes: new ArrayBuffer(0) })),
    });
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain("Comprovantes");
    expect(serialized).toContain(String(count));
  });

  it("cria nome amigável sem identificador técnico", () => {
    expect(poolReportFileName(pool)).toBe("relatorio-bolao-galera-gmill-concurso-3780.pdf");
  });

  it.each([
    [{ participants: true, games: false, documents: false }, true, false],
    [{ participants: false, games: true, documents: false }, false, true],
    [{ participants: true, games: true, documents: false }, true, true],
  ])("respeita a seleção de seções %o", (sections, hasParticipants, hasGames) => {
    const serialized = JSON.stringify(buildPoolReportDefinition({ ...data, sections }));
    expect(serialized.includes("Participantes ativos")).toBe(hasParticipants);
    expect(serialized.includes("Jogos do bolão")).toBe(hasGames);
  });

  it("inclui o cenário real e exclui dados privados", () => {
    const definition = buildPoolReportDefinition(data);
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain("Bolão Galera Gmill");
    expect(serialized).toContain("Participantes ativos");
    expect(serialized).toContain("R$ 1.380,00");
    expect(serialized).toContain("Saldo do bolão");
    expect(serialized).toContain("R$ 1,00");
    expect(serialized).toContain("Apostado");
    expect(serialized).not.toContain("11999999999");
    expect(serialized).not.toContain("privado");
    expect(serialized).not.toContain("game-0");
    expect(serialized).toContain("https://www.gestordasorte.com.br/b/relatorio-publico");
    expect(serialized).not.toContain("lovable.app");
    expect(serialized).not.toContain("localhost");
  });

  it("inicia jogos em nova página, repete o cabeçalho e mantém cada jogo indivisível", () => {
    const definition = buildPoolReportDefinition(data);
    const content = Array.isArray(definition.content) ? definition.content as unknown as Array<Record<string, unknown>> : [];
    const gamesHeading = content.find((item) => item["text"] === "Jogos do bolão");
    const gamesTable = content[content.indexOf(gamesHeading ?? {}) + 1] as { table?: { headerRows?: number; keepWithHeaderRows?: number; dontBreakRows?: boolean } };

    expect(gamesHeading?.["pageBreak"]).toBe("before");
    expect(gamesTable.table).toMatchObject({ headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true });
    const footer = typeof definition.footer === "function" ? definition.footer(1, 2, { width: 595.28, height: 841.89, orientation: "portrait" }) : null;
    expect(JSON.stringify(footer)).toContain("Gerado em 12/09/2026 16:52");
    expect(JSON.stringify(footer)).toContain("Página 1 de 2");
  });

  it.each([
    [1380, 1379, "R$ 1,00", false],
    [1380, 1380, "R$ 0,00", false],
    [1000, 1050, "-R$ 50,00", true],
  ])("calcula saldo recebido %i menos custo %i", (received, cost, expectedBalance, hasShortfall) => {
    const adjustedParticipants = participants.map((participant, index) => ({
      ...participant,
      amount_due: index === 0 ? received : 0,
      total_paid: index === 0 ? received : 0,
      payment_status: (index === 0 ? "PAID" : "PENDING") as PoolParticipantRow["payment_status"],
    }));
    const definition = buildPoolReportDefinition({
      ...data,
      participants: adjustedParticipants,
      games: [{ gameId: "balance-game", sequence: 1, status: "BET", contestNumber: 3780, numbers: [1, 2, 3, 4, 5, 6], cost }],
    });
    const serialized = JSON.stringify(definition);

    expect(serialized).toContain(expectedBalance);
    expect(serialized.includes("Valor ainda necessário para cobrir os jogos: R$ 50,00")).toBe(hasShortfall);
  });

  it.each([5, 23, 50, 100, 200])("aceita %i participantes sem cortar dados do documento", (count) => {
    const definition = buildPoolReportDefinition({ ...data, participants: participants.slice(0, 1).flatMap((item) => Array.from({ length: count }, (_, index) => ({ ...item, id: String(index), name: `Pessoa ${index + 1}` }))) });
    expect(JSON.stringify(definition)).toContain(`Pessoa ${count}`);
  });

  it.each([
    [5, 19],
    [23, 19],
    [50, 19],
    [100, 50],
  ])("mantém a separação entre %i participantes e %i jogos", (participantCount, gameCount) => {
    const definition = buildPoolReportDefinition({
      ...data,
      participants: participants.slice(0, 1).flatMap((item) => Array.from({ length: participantCount }, (_, index) => ({ ...item, id: String(index), name: `Pessoa ${index + 1}` }))),
      games: Array.from({ length: gameCount }, (_, index) => ({
        gameId: `volume-${index}`, sequence: index + 1, status: "BET", contestNumber: 3780,
        cost: 3.5, numbers: Array.from({ length: 15 }, (_, number) => number + 1),
      })),
    });
    const content = Array.isArray(definition.content) ? definition.content as unknown as Array<Record<string, unknown>> : [];
    const gamesHeading = content.find((item) => item["text"] === "Jogos do bolão");
    const gamesTable = content[content.indexOf(gamesHeading ?? {}) + 1] as { table?: { body?: unknown[]; dontBreakRows?: boolean } };

    expect(gamesHeading?.["pageBreak"]).toBe("before");
    expect(gamesTable.table?.dontBreakRows).toBe(true);
    expect(gamesTable.table?.body).toHaveLength(gameCount + 1);
  });

  it.each([
    ["Mega-Sena", 6, 10],
    ["Lotofácil", 15, 23],
    ["Quina", 5, 50],
    ["Mega-Sena", 6, 100],
    ["Lotofácil", 15, 200],
  ])("organiza %s com %i dezenas em %i jogos", (lottery, numbersCount, gamesCount) => {
    const definition = buildPoolReportDefinition({
      ...data,
      pool: { ...pool, lotteries: { ...pool.lotteries, name: lottery } } as PoolRow,
      games: Array.from({ length: gamesCount }, (_, index) => ({
        gameId: `g-${index}`,
        sequence: index + 1,
        status: "BET" as const,
        contestNumber: 3780,
        cost: 3.5,
        numbers: Array.from({ length: numbersCount }, (_, number) => number + 1),
      })),
    });
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain(lottery);
    expect(serialized).toContain(`\"${gamesCount}\"`);
  });
});