import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { appConfig } from "@/config/app.config";
import { formatCurrency, formatDate } from "@/lib/format";
import { summarizeFinance } from "@/lib/pools/poolMath";
import type { CheckResultRow } from "@/lib/services/checkService";
import type { PoolParticipantRow, PoolRow } from "@/lib/services/poolService";
import { gameStatusLabel, paymentStatusLabel, poolStatusLabel, type GameStatus } from "@/types/domain";

export interface PoolReportGame {
  gameId: string;
  sequence: number;
  status: GameStatus;
  contestNumber: number | null;
  cost: number;
  numbers: number[];
}

export interface PoolReportData {
  pool: PoolRow;
  participants: PoolParticipantRow[];
  games: PoolReportGame[];
  checks: Map<string, CheckResultRow>;
  officialPrizeTotal: number;
  generatedAt?: Date;
  documents?: PoolReportDocument[];
}

export interface PoolReportDocument { title: string; mimeType: "image/jpeg" | "image/png" | "application/pdf"; bytes: ArrayBuffer; }

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

export function poolReportFileName(pool: PoolRow) {
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const suffix = contest ? `concurso-${contest}` : formatDate(pool.draw_date ?? pool.draw_date_planned).replace(/\D/g, "-").replace(/-+$/g, "") || "sem-concurso";
  return `relatorio-${slugify(pool.name) || "bolao"}-${suffix}.pdf`;
}

export function mapPoolReportGames(rows: Awaited<ReturnType<typeof import("@/lib/services/poolService")["poolService"]["games"]>>): PoolReportGame[] {
  return rows.flatMap((row, index) => {
    const game = row.generated_games;
    if (!game) return [];
    return [{
      gameId: row.game_id,
      sequence: game.sequence_number ?? index + 1,
      status: game.status,
      contestNumber: game.contest_number,
      cost: Number(game.cost ?? 0),
      numbers: [...(game.game_numbers ?? [])].sort((a, b) => a.position - b.position).map((item) => item.number),
    }];
  }).sort((a, b) => a.sequence - b.sequence);
}

export function buildPoolReportDefinition(data: PoolReportData): TDocumentDefinitions {
  const active = data.participants.filter((participant) => participant.status === "ACTIVE");
  const finance = summarizeFinance(active.map((participant) => ({
    quotas: participant.quotas,
    amountDue: Number(participant.amount_due),
    totalPaid: Number(participant.total_paid),
    paymentStatus: participant.payment_status,
  })));
  const gameContests = [...new Set(data.games.map((game) => game.contestNumber).filter((value): value is number => value !== null))];
  const contest = data.pool.contest_number ?? data.pool.contest_number_planned ?? (gameContests.length === 1 ? gameContests[0] : null);
  const drawDate = data.pool.draw_date ?? data.pool.draw_date_planned;
  const gameCost = data.games.reduce((sum, game) => sum + game.cost, 0);
  const poolBalance = finance.totalPaid - gameCost;
  const generatedAt = data.generatedAt ?? new Date();
  const generatedLabel = new Intl.DateTimeFormat(appConfig.locale, {
    dateStyle: "short", timeStyle: "short", timeZone: appConfig.timeZone,
  }).format(generatedAt).replace(",", "");
  const summaryRows = [
    ["Participantes ativos", String(active.length), "Cotas atribuídas", String(finance.quotasTaken)],
    ["Valor da cota", formatCurrency(data.pool.quota_value), "Limite de cotas", data.pool.total_quotas == null ? "Sem limite" : String(data.pool.total_quotas)],
    ["Total previsto", formatCurrency(finance.totalDue), "Total recebido", formatCurrency(finance.totalPaid)],
    ["Em aberto", formatCurrency(finance.totalOutstanding), "Custo dos jogos", formatCurrency(gameCost)],
    [
      { text: "Saldo do bolão", bold: true, fillColor: "#e9f2eb" },
      { text: formatCurrency(poolBalance), bold: true, fillColor: "#e9f2eb" },
      { text: "", fillColor: "#e9f2eb" },
      { text: "", fillColor: "#e9f2eb" },
    ],
  ];
  const participantRows = active.map((participant, index) => [
    String(index + 1), participant.name, String(participant.quotas), formatCurrency(participant.amount_due),
    formatCurrency(participant.total_paid), paymentStatusLabel[participant.payment_status],
  ]);
  const gameRows = data.games.map((game, index) => {
    const check = data.checks.get(game.gameId);
    const result = check
      ? `${check.hits} acertos${check.prize_label ? ` · ${check.prize_label}` : ""}${check.total_prize !== null ? ` · ${formatCurrency(check.total_prize)}` : ""}`
      : "—";
    return [
      String(index + 1), game.numbers.map((number) => String(number).padStart(2, "0")).join("  "),
      gameStatusLabel[game.status], formatCurrency(game.cost), result,
    ];
  });
  const checked = [...data.checks.values()];
  const balanceNotice: Content[] = poolBalance < 0
    ? [{ text: `Valor ainda necessário para cobrir os jogos: ${formatCurrency(Math.abs(poolBalance))}`, margin: [0, 6, 0, 0], fontSize: 8, color: "#66736b" }]
    : [];
  const resultSection: Content[] = checked.length > 0 ? [
    { text: "Resultado oficial", style: "section" },
    { columns: [
      { text: `Jogos conferidos\n${checked.length}`, bold: true },
      { text: `Jogos premiados\n${checked.filter((item) => item.is_prized).length}`, bold: true },
      { text: `Premiação oficial\n${formatCurrency(data.officialPrizeTotal)}`, bold: true },
    ], columnGap: 16 },
  ] : [];

  return {
    info: { title: `Relatório completo — ${data.pool.name}`, author: appConfig.name, subject: "Relatório administrativo de bolão" },
    pageSize: "A4",
    pageMargins: [36, 58, 36, 42],
    header: () => ({ text: appConfig.name, margin: [36, 22, 36, 0], color: "#427a52", bold: true, fontSize: 9 }),
    footer: (currentPage, pageCount) => ({
      columns: [{ text: `Gerado em ${generatedLabel}`, alignment: "left" }, { text: `Página ${currentPage} de ${pageCount}`, alignment: "right" }],
      margin: [36, 14, 36, 0], fontSize: 8, color: "#66736b",
    }),
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#243029", lineHeight: 1.2 },
    styles: {
      title: { fontSize: 20, bold: true, color: "#193c27", margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 10, color: "#66736b", margin: [0, 0, 0, 14] },
      section: { fontSize: 13, bold: true, color: "#193c27", margin: [0, 16, 0, 7] },
      tableHeader: { bold: true, color: "#193c27", fillColor: "#e9f2eb" },
    },
    content: [
      { text: data.pool.name, style: "title" },
      { text: `${data.pool.lotteries?.name ?? "Loteria"} · ${contest ? `Concurso ${contest}` : "Concurso a definir"} · ${poolStatusLabel[data.pool.status]}`, style: "subtitle" },
      { text: "Informações do bolão", style: "section" },
      { table: { widths: ["*", "auto", "*", "auto"], body: summaryRows }, layout: "lightHorizontalLines" },
      ...balanceNotice,
      { text: `Sorteio: ${drawDate ? formatDate(drawDate) : "A definir"}`, margin: [0, 8, 0, 0] },
      { text: "Participantes ativos", style: "section" },
      participantRows.length > 0
        ? { table: { headerRows: 1, widths: [20, "*", 34, 58, 58, 48], body: [[{ text: "#", style: "tableHeader" }, { text: "Nome", style: "tableHeader" }, { text: "Cotas", style: "tableHeader" }, { text: "Devido", style: "tableHeader" }, { text: "Pago", style: "tableHeader" }, { text: "Situação", style: "tableHeader" }], ...participantRows] }, layout: "lightHorizontalLines" }
        : { text: "Nenhum participante ativo.", color: "#66736b" },
      { text: "Jogos do bolão", style: "section", pageBreak: "before" },
      gameRows.length > 0
        ? { table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: [20, "*", 72, 55, 100], body: [[{ text: "#", style: "tableHeader" }, { text: "Dezenas", style: "tableHeader" }, { text: "Situação", style: "tableHeader" }, { text: "Custo", style: "tableHeader" }, { text: "Resultado", style: "tableHeader" }], ...gameRows] }, layout: "lightHorizontalLines" }
        : { text: "Nenhum jogo no bolão.", color: "#66736b" },
      ...resultSection,
      { text: "Relatório administrativo. Dados pessoais sensíveis, documentos, observações e identificadores internos não são incluídos.", margin: [0, 18, 0, 0], fontSize: 8, color: "#66736b" },
    ],
  };
}

export async function createPoolReportPdf(data: PoolReportData) {
  const [pdfMakeModule, fontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = pdfMakeModule.default;
  pdfMake.addVirtualFileSystem(fontsModule.default);
  const report = await pdfMake.createPdf(buildPoolReportDefinition(data)).getBlob();
  if (!data.documents?.length) return report;

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const merged = await PDFDocument.load(await report.arrayBuffer());
  const font = await merged.embedFont(StandardFonts.HelveticaBold);
  for (const document of data.documents) {
    if (document.mimeType === "application/pdf") {
      const attachment = await PDFDocument.load(document.bytes);
      const pages = await merged.copyPages(attachment, attachment.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      continue;
    }
    const image = document.mimeType === "image/png" ? await merged.embedPng(document.bytes) : await merged.embedJpg(document.bytes);
    const page = merged.addPage([595.28, 841.89]);
    const margin = 36;
    const titleHeight = 34;
    const availableWidth = page.getWidth() - margin * 2;
    const availableHeight = page.getHeight() - margin * 2 - titleHeight;
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawText(document.title, { x: margin, y: page.getHeight() - margin - 12, size: 12, font, color: rgb(0.1, 0.24, 0.15) });
    page.drawImage(image, { x: (page.getWidth() - width) / 2, y: margin + (availableHeight - height) / 2, width, height });
  }
  return new Blob([await merged.save()], { type: "application/pdf" });
}

export function canSharePdfFile(file: File) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try { return navigator.canShare({ files: [file] }); } catch { return false; }
}