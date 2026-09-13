import { Download, FileQuestion, Loader2, Minus, Plus, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { documentTypeLabel, formatDocumentSize, isPreviewableDocumentMime } from "@/lib/documents/documentFiles";

export interface ViewableDocument {
  title: string;
  description?: string | null;
  fileName?: string | null;
  mimeType: string | null;
  fileSize?: number | null;
  getUrl: () => Promise<string>;
}

export function DocumentViewer({ open, onOpenChange, document }: { open: boolean; onOpenChange: (open: boolean) => void; document: ViewableDocument | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !document) { setUrl(null); setFailed(false); return; }
    let active = true;
    let resolvedUrl: string | null = null;
    setLoading(true); setFailed(false); setUrl(null);
    void document.getUrl().then((nextUrl) => { resolvedUrl = nextUrl; if (active) setUrl(nextUrl); else if (nextUrl.startsWith("blob:")) URL.revokeObjectURL(nextUrl); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (resolvedUrl?.startsWith("blob:")) URL.revokeObjectURL(resolvedUrl); };
  }, [open, document, attempt]);

  const retry = () => setAttempt((value) => value + 1);
  const download = () => {
    if (!url || !document) return;
    const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = document.fileName || document.title; anchor.rel = "noopener"; anchor.click();
  };
  const share = async () => {
    if (!url || !document || typeof navigator.share !== "function") return;
    try { await navigator.share({ title: document.title, url }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Não foi possível compartilhar este comprovante."); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-6xl grid-cols-none flex-col gap-3 overflow-hidden p-3 sm:h-[min(90vh,56rem)] sm:p-5">
    <DialogHeader className="min-w-0 pr-8 text-left"><DialogTitle className="truncate">{document?.title ?? "Comprovante"}</DialogTitle><DialogDescription className="line-clamp-2">{document?.description || `${documentTypeLabel(document?.mimeType)} · ${formatDocumentSize(document?.fileSize)}`}</DialogDescription></DialogHeader>
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-secondary">
      {loading ? <div className="flex flex-col items-center gap-3 text-sm text-text-secondary" role="status"><Loader2 className="size-7 animate-spin" aria-hidden />Carregando comprovante...</div> : failed ? <ViewerError onRetry={retry} onDownload={url ? download : undefined} /> : url && document && isPreviewableDocumentMime(document.mimeType) ? (document.mimeType === "application/pdf" ? <PdfViewer url={url} title={document.title} /> : <ImageViewer url={url} title={document.title} onError={() => setFailed(true)} />) : <FileFallback document={document} onDownload={url ? download : undefined} />}
    </div>
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      {url && typeof navigator !== "undefined" && typeof navigator.share === "function" ? <Button variant="outline" className="h-11" onClick={() => void share()}><Share2 aria-hidden />Compartilhar</Button> : null}
      <Button variant="outline" className="h-11" disabled={!url} onClick={download}><Download aria-hidden />Baixar</Button>
      <Button className="h-11" onClick={() => onOpenChange(false)}>Fechar</Button>
    </div>
  </DialogContent></Dialog>;
}

function ImageViewer({ url, title, onError }: { url: string; title: string; onError: () => void }) {
  const [zoom, setZoom] = useState(1);
  return <div className="relative flex size-full min-h-0 flex-col">
    <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md border border-border bg-background p-1 shadow-soft">
      <Button size="icon" variant="ghost" aria-label="Diminuir zoom" title="Diminuir zoom" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - .25))}><Minus /></Button>
      <Button size="icon" variant="ghost" aria-label="Restaurar zoom" title="Restaurar zoom" disabled={zoom === 1} onClick={() => setZoom(1)}><RotateCcw /></Button>
      <Button size="icon" variant="ghost" aria-label="Aumentar zoom" title="Aumentar zoom" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + .25))}><Plus /></Button>
    </div>
    <div className="flex min-h-0 flex-1 overflow-auto p-3 touch-pan-x touch-pan-y sm:p-5"><img src={url} alt={title} onError={onError} className="m-auto block max-h-full max-w-full object-contain" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }} /></div>
  </div>;
}

function PdfViewer({ url, title }: { url: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void import("pdfjs-dist").then(({ GlobalWorkerOptions, getDocument }) => {
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return getDocument({ url }).promise;
    }).then((loaded) => { if (active) { setPdf(loaded); setPage(1); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; renderTaskRef.current?.cancel(); };
  }, [url, attempt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;
    let active = true;
    renderTaskRef.current?.cancel();
    void pdf.getPage(page).then((pdfPage) => {
      if (!active) return;
      const viewport = pdfPage.getViewport({ scale: 1.45 * zoom });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas indisponível");
      canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
      const task = pdfPage.render({ canvas, canvasContext: context, viewport }); renderTaskRef.current = task;
      return task.promise;
    }).catch((cause) => { if (active && (!(cause instanceof Error) || cause.name !== "RenderingCancelledException")) setError(true); });
    return () => { active = false; renderTaskRef.current?.cancel(); };
  }, [pdf, page, zoom]);

  if (error) return <ViewerError onRetry={() => { setError(false); setPdf(null); setAttempt((value) => value + 1); }} onDownload={undefined} />;
  return <div className="flex size-full min-h-0 flex-col">
    <div className="flex min-h-11 shrink-0 items-center justify-center gap-1 border-b border-border bg-background px-2">
      <Button size="icon" variant="ghost" aria-label="Página anterior" disabled={!pdf || page <= 1} onClick={() => setPage((value) => value - 1)}>‹</Button>
      <span className="min-w-24 text-center text-sm tabular-nums text-text-primary" aria-live="polite">{pdf ? `Página ${page} de ${pdf.numPages}` : "Carregando PDF..."}</span>
      <Button size="icon" variant="ghost" aria-label="Próxima página" disabled={!pdf || page >= pdf.numPages} onClick={() => setPage((value) => value + 1)}>›</Button>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <Button size="icon" variant="ghost" aria-label="Diminuir zoom do PDF" disabled={zoom <= .75} onClick={() => setZoom((value) => Math.max(.75, value - .25))}><Minus /></Button>
      <Button size="icon" variant="ghost" aria-label="Aumentar zoom do PDF" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + .25))}><Plus /></Button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto bg-surface-secondary p-2 sm:p-4"><canvas ref={canvasRef} aria-label={`${title}, página ${page}`} className="mx-auto block max-w-none bg-surface shadow-raised" /></div>
  </div>;
}

function ViewerError({ onRetry, onDownload }: { onRetry: () => void; onDownload: (() => void) | undefined }) { return <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center"><FileQuestion className="size-10 text-danger" aria-hidden /><div><p className="font-semibold text-text-primary">Não foi possível visualizar este comprovante.</p><p className="text-sm text-text-secondary">O arquivo pode estar indisponível, corrompido ou a autorização pode ter expirado.</p></div><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={onRetry}>Tentar novamente</Button>{onDownload ? <Button variant="outline" onClick={onDownload}><Download aria-hidden />Baixar arquivo</Button> : null}</div></div>; }

function FileFallback({ document, onDownload }: { document: ViewableDocument | null; onDownload: (() => void) | undefined }) { return <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center"><FileQuestion className="size-10 text-text-secondary" aria-hidden /><div><p className="font-semibold text-text-primary">Pré-visualização não disponível para este formato.</p><p className="text-sm text-text-secondary">{document?.fileName || document?.title} · {documentTypeLabel(document?.mimeType)} · {formatDocumentSize(document?.fileSize)}</p></div>{onDownload ? <Button onClick={onDownload}><Download aria-hidden />Baixar arquivo</Button> : null}</div>; }