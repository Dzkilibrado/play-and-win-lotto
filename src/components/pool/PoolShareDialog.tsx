/**
 * Interface única de compartilhamento do bolão.
 * Todos os botões "Compartilhar" do módulo abrem este diálogo — a mensagem,
 * o link e o tratamento de erro vêm de `@/lib/pools/poolShare`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Eye, FileText, Link2Off, Loader2, MessageCircle, RefreshCw, Share2, Users, Ticket, LayoutList } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentViewer, type ViewableDocument } from "@/components/common/DocumentViewer";
import { getAvailablePoolDocuments, getPoolDocumentUrl } from "@/lib/pools/poolManagement.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canUseNativeShare,
  copyText,
  nativeShare,
  openWhatsApp,
  poolPublicUrl,
  poolShareMessage,
  poolSharePreview,
  poolShareScopeDescription,
  poolShareScopeLabel,
  poolShareTitle,
} from "@/lib/pools/poolShare";
import { canSharePdfFile, createPoolReportPdf, defaultPoolReportSections, mapPoolReportGames, poolReportFileName, type PoolReportSections } from "@/lib/pools/poolReportPdf";
import { sniffDocumentMime } from "@/lib/documents/documentFiles";
import { checkService } from "@/lib/services/checkService";
import { poolService, type PoolRow, type PoolShareScope } from "@/lib/services/poolService";
import { userErrorMessage } from "@/lib/user-error";

export function PoolShareDialog({
  pool,
  open,
  onOpenChange,
  canManage,
}: {
  pool: PoolRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const getDocumentUrl = useServerFn(getPoolDocumentUrl);
  const getAvailableDocuments = useServerFn(getAvailablePoolDocuments);
  const [scope, setScope] = useState<PoolShareScope>("FULL");
  const [scopeReady, setScopeReady] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [reportSections, setReportSections] = useState<PoolReportSections>(defaultPoolReportSections);
  const [pdfSelectionError, setPdfSelectionError] = useState(false);
  const documentRows = useQuery({
    queryKey: ["pool-available-documents", pool.id],
    queryFn: () => getAvailableDocuments({ data: { poolId: pool.id } }),
    enabled: open,
    staleTime: 30_000,
  });
  const publishedDocuments = documentRows.data ?? [];
  const publishedDocumentFingerprint = publishedDocuments.map((document) => `${document.id}:${document.version}:${document.updated_at}`).join("|");
  const url = poolPublicUrl(pool, scope);
  const message = poolShareMessage(pool, scope, url);
  const preview = poolSharePreview(pool, scope, publishedDocuments.length);

  useEffect(() => {
    if (!open) {
      setScopeReady(false);
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem(`pool-share-scope:${pool.id}`);
      if (saved === "PARTICIPANTS" || saved === "GAMES" || saved === "FULL") setScope(saved);
    }
    setScopeReady(true);
  }, [open, pool.id]);

  useEffect(() => {
    if (open) setPdfBlob(null);
  }, [open, pool.id, publishedDocumentFingerprint]);

  useEffect(() => {
    if (!documentRows.isLoading && publishedDocuments.length === 0 && reportSections.documents) {
      setReportSections((current) => ({ ...current, documents: false }));
      setPdfBlob(null);
    }
  }, [documentRows.isLoading, publishedDocuments.length, reportSections.documents]);

  const chooseScope = (next: PoolShareScope) => {
    setScope(next);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(`pool-share-scope:${pool.id}`, next);
  };

  const enableLink = useMutation({
    mutationFn: ({ enabled, regenerate = false }: { enabled: boolean; regenerate?: boolean }) =>
      poolService.setShareLink(pool.id, scope, enabled, regenerate),
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? (variables.regenerate ? "Novo link criado" : "Link público criado") : "Link revogado");
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  // Ação explícita do organizador já é intenção suficiente: o link é criado
  // automaticamente ao abrir o compartilhamento, sem confirmação extra.
  const requested = useRef<PoolShareScope | null>(null);
  useEffect(() => {
    if (!open) {
      requested.current = null;
      return;
    }
    if (url) {
      requested.current = null;
      return;
    }
    if (!scopeReady || !canManage || requested.current === scope || enableLink.isPending) return;
    requested.current = scope;
    enableLink.mutate({ enabled: true });
  }, [open, url, scope, scopeReady, canManage, enableLink.isPending]);

  const share = async () => {
    const result = await nativeShare({ title: poolShareTitle(pool), text: message, url });
    if (result === "shared") {
      toast.success("Compartilhamento aberto");
      onOpenChange(false);
      return;
    }
    if (result === "cancelled") return;
    if (result === "unsupported") {
      await copy(message, "Mensagem e link copiados");
      return;
    }
    if (result === "error") {
      toast.error("Não foi possível abrir o compartilhamento. Use o WhatsApp ou copie o link.");
    }
  };

  const copy = async (value: string, label: string) => {
    const ok = await copyText(value);
    if (ok) toast.success(label);
    else toast.error("Não foi possível copiar. Selecione o texto manualmente.");
  };

  const generatePdf = async () => {
    if (pdfBlob) return pdfBlob;
    if (!reportSections.participants && !reportSections.games && !reportSections.documents) {
      setPdfSelectionError(true);
      return null;
    }
    setPdfLoading(true);
    try {
      const [participants, rawGames, officialPrizeTotal] = await Promise.all([
        poolService.participants(pool.id),
        poolService.games(pool.id),
        poolService.prizeTotal(pool.id),
      ]);
      const games = mapPoolReportGames(rawGames);
      const checks = reportSections.games ? await checkService.getChecksForGames(games.map((game) => game.gameId)) : new Map();
      const documents = reportSections.documents ? await Promise.all(publishedDocuments.map(async (document) => {
          const url = await getDocumentUrl({ data: { documentId: document.id } });
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error("Comprovante indisponível.");
          const bytes = await response.arrayBuffer();
          const mimeType = sniffDocumentMime(new Uint8Array(bytes));
          if (!mimeType || mimeType !== document.mime_type) throw new Error("Comprovante inválido.");
          return { title: document.title, description: document.description, mimeType, bytes, originalFileName: document.original_file_name, sourceVersion: document.version };
        })) : [];
      const blob = await createPoolReportPdf({ pool, participants, games, checks, officialPrizeTotal, documents, sections: reportSections });
      setPdfBlob(blob);
      setPdfOptionsOpen(false);
      toast.success("PDF preparado");
      return blob;
    } catch (error) {
      toast.error(userErrorMessage(error, "Não foi possível gerar o PDF."));
      return null;
    } finally {
      setPdfLoading(false);
    }
  };

  const updateReportSection = (section: keyof PoolReportSections, checked: boolean) => {
    setReportSections((current) => ({ ...current, [section]: checked }));
    setPdfBlob(null);
    setPdfSelectionError(false);
  };

  const downloadPdf = async () => {
    const blob = await generatePdf();
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = poolReportFileName(pool);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  };

  const previewPdf = async () => {
    const blob = await generatePdf();
    if (blob) setPdfPreviewOpen(true);
  };

  const reportDocument = useMemo<ViewableDocument | null>(() => pdfBlob ? { title: `Relatório completo — ${pool.name}`, fileName: poolReportFileName(pool), mimeType: "application/pdf", fileSize: pdfBlob.size, getUrl: async () => URL.createObjectURL(pdfBlob) } : null, [pdfBlob, pool]);

  const sharePdf = async () => {
    const blob = await generatePdf();
    if (!blob) return;
    const file = new File([blob], poolReportFileName(pool), { type: "application/pdf" });
    if (!canSharePdfFile(file)) {
      await downloadPdf();
      toast.info("O compartilhamento de arquivos não está disponível. O PDF foi salvo.");
      return;
    }
    try {
      await navigator.share({ title: poolShareTitle(pool), files: [file] });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o PDF. Você ainda pode visualizá-lo ou salvá-lo.");
    }
  };

  return (
    <><Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[34rem] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Compartilhar bolão</DialogTitle>
          <DialogDescription>O que você quer compartilhar?</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Tipo de compartilhamento">
          {(["PARTICIPANTS", "GAMES", "FULL"] as PoolShareScope[]).map((item) => {
            const Icon = item === "PARTICIPANTS" ? Users : item === "GAMES" ? Ticket : LayoutList;
            return (
            <Button
              key={item}
              type="button"
              role="radio"
              aria-checked={scope === item}
              variant="outline"
              className={`h-auto min-h-14 justify-start whitespace-normal px-3 py-2 text-left ${scope === item ? "border-lottery bg-lottery-soft ring-1 ring-lottery" : ""}`}
              onClick={() => chooseScope(item)}
            >
              <Icon className="size-5 shrink-0 text-lottery" aria-hidden />
              <span><span className="block font-semibold">{poolShareScopeLabel[item]}</span><span className="block text-xs font-normal text-text-secondary">{poolShareScopeDescription[item]}</span></span>
            </Button>
          )})}
        </div>

        {scopeReady && url ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-secondary p-3">
              <p className="text-xs font-semibold uppercase text-text-secondary">Será compartilhado</p>
              <ul className="mt-1.5 space-y-1 text-sm text-text-primary">{preview.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="grid min-w-0 gap-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">Compartilhar</p>
              {canUseNativeShare() ? (
                <Button className="h-11 justify-start" onClick={() => void share()}>
                  <Share2 className="size-4 shrink-0" aria-hidden />
                  Compartilhar
                </Button>
              ) : (
                <p className="rounded-lg bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
                  O compartilhamento direto não está disponível neste navegador. Use o WhatsApp ou copie a mensagem.
                </p>
              )}
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => {
                  const ok = openWhatsApp(message);
                  if (!ok) toast.error("Não foi possível abrir o WhatsApp. Copie a mensagem abaixo.");
                }}
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                WhatsApp
              </Button>
              <p className="mt-1 text-xs font-semibold uppercase text-text-secondary">Copiar</p>
              <Button
                variant="default"
                className="h-11 justify-start"
                onClick={() => void copy(message, "Mensagem e link copiados")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar mensagem e link
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => void copy(url, "Link copiado")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar somente o link
              </Button>
              {canManage ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase text-text-secondary">Outras opções</p>
                  {!pdfBlob ? (
                    <Button variant="outline" className="h-11 w-full justify-start" disabled={pdfLoading} onClick={() => setPdfOptionsOpen(true)}>
                      <FileText className="size-4" aria-hidden />
                      Gerar PDF
                    </Button>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button variant="outline" className="h-11" onClick={() => void previewPdf()}><Eye className="size-4" aria-hidden /> Visualizar</Button>
                      <Button variant="outline" className="h-11" onClick={() => void sharePdf()}><Share2 className="size-4" aria-hidden /> Compartilhar</Button>
                      <Button variant="outline" className="h-11" onClick={() => void downloadPdf()}><Download className="size-4" aria-hidden /> Salvar</Button>
                      <Button variant="outline" className="h-11" onClick={() => setPdfOptionsOpen(true)}><FileText className="size-4" aria-hidden /> Alterar conteúdo</Button>
                    </div>
                  )}
                  <p className="text-xs text-text-secondary">Escolha as seções detalhadas antes de gerar. O resumo principal permanece no relatório.</p>
                </div>
              ) : null}
              {canManage ? (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button variant="outline" className="h-11" onClick={() => enableLink.mutate({ enabled: true, regenerate: true })}>
                    <RefreshCw className="size-4" aria-hidden /> Novo link
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => enableLink.mutate({ enabled: false })}>
                    <Link2Off className="size-4" aria-hidden /> Revogar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
            {canManage
              ? `Preparando o link de ${poolShareScopeLabel[scope].toLocaleLowerCase("pt-BR")}…`
              : "Somente o organizador pode ativar o link público deste bolão."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={pdfOptionsOpen} onOpenChange={setPdfOptionsOpen}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Gerar PDF</DialogTitle>
          <DialogDescription>Conteúdo do relatório</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {([
            ["participants", "Participantes", "Lista detalhada de participantes ativos."],
            ["games", "Jogos", "Jogos, dezenas, situação, custo e resultado."],
            ["documents", "Incluir comprovantes publicados", `${publishedDocuments.length} ${publishedDocuments.length === 1 ? "comprovante disponível" : "comprovantes disponíveis"}.`],
          ] as const).map(([section, label, description]) => (
            <label key={section} className={`flex min-h-14 items-start gap-3 rounded-md border border-border p-3 ${section === "documents" && publishedDocuments.length === 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <Checkbox checked={reportSections[section]} disabled={section === "documents" && publishedDocuments.length === 0} onCheckedChange={(checked) => updateReportSection(section, checked === true)} aria-label={label} />
              <span className="min-w-0"><span className="block text-sm font-medium text-text-primary">{label}</span><span className="block text-xs text-text-secondary">{description}</span></span>
            </label>
          ))}
          {pdfSelectionError ? <p role="alert" className="text-sm text-destructive">Selecione pelo menos uma seção para gerar o relatório.</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setPdfOptionsOpen(false)}>Cancelar</Button>
          <Button disabled={pdfLoading} onClick={() => void generatePdf()}>
            {pdfLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
            {pdfLoading ? "Preparando PDF…" : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <DocumentViewer open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen} document={reportDocument} /></>
  );
}
