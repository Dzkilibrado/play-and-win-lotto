import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, FileText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { useSession } from "@/hooks/useAuth";
import { resolveQueryState } from "@/lib/query/queryState";
import { DocumentViewer, type ViewableDocument } from "@/components/common/DocumentViewer";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePoolDocument, getPoolDocumentUrl, replacePoolDocumentFile, uploadPoolDocument } from "@/lib/pools/poolManagement.functions";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { poolService, type PoolDocumentRow } from "@/lib/services/poolService";
import { DOCUMENT_ACCEPT, documentTypeLabel, validateDocumentFile } from "@/lib/documents/documentFiles";

export function DocumentsPanel({ poolId, canManage, readOnly }: { poolId: string; canManage: boolean; readOnly: boolean }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const replaceFile = useServerFn(replacePoolDocumentFile);
  const deleteDocument = useServerFn(deletePoolDocument);
  const getDocumentUrl = useServerFn(getPoolDocumentUrl);
  const [editing, setEditing] = useState<PoolDocumentRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PoolDocumentRow | null>(null);
  const [viewing, setViewing] = useState<PoolDocumentRow | null>(null);
  const replacement = useRef<PoolDocumentRow | null>(null);
  const replaceInput = useRef<HTMLInputElement | null>(null);
  const documents = useQuery({ queryKey: ["pool-documents", user.id, poolId], queryFn: () => poolService.activeDocuments(poolId) });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool-documents", user.id, poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pool-available-documents", poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pool", poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
    void queryClient.invalidateQueries({ queryKey: ["pool-events", user.id, poolId] });
    void queryClient.invalidateQueries({ queryKey: ["public-pool"] });
    void queryClient.invalidateQueries({ queryKey: ["public-pool-documents"] });
  };
  const replace = useMutation({
    mutationFn: ({ document, file }: { document: PoolDocumentRow; file: File }) => {
      const form = new FormData();
      form.set("documentId", document.id);
      form.set("file", file);
      return replaceFile({ data: form });
    },
    onSuccess: () => { toast.success("Arquivo substituído"); invalidate(); },
    onError: () => toast.error("Não foi possível substituir o arquivo. Tente novamente."),
  });
  const remove = useMutation({
    mutationFn: (document: PoolDocumentRow) => deleteDocument({ data: { documentId: document.id } }),
    onSuccess: () => { toast.success("Comprovante excluído"); setDeleting(null); invalidate(); },
    onError: () => toast.error("Não foi possível excluir o comprovante. Tente novamente."),
  });
  const validFile = (file: File) => {
    try { validateDocumentFile(file); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Use um arquivo JPG, PNG, WEBP ou PDF."); return false; }
  };
  const viewerDocument = useMemo<ViewableDocument | null>(() => viewing ? { title: viewing.title, description: viewing.description, fileName: viewing.original_file_name || viewing.title, mimeType: viewing.mime_type, fileSize: viewing.file_size, getUrl: () => getDocumentUrl({ data: { documentId: viewing.id } }) } : null, [getDocumentUrl, viewing]);

  const state = resolveQueryState(documents);
  if (state === "loading") return <LoadingState rows={3} />;
  if (state === "error") return <ErrorState onRetry={() => void documents.refetch()} />;
  const rows = documents.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">{rows.length} {rows.length === 1 ? "comprovante" : "comprovantes"}</p>
        {canManage && !readOnly ? <Button size="sm" className="h-11" onClick={() => setAdding(true)}><Plus aria-hidden />Adicionar comprovante</Button> : null}
      </div>
      {rows.length === 0 ? <EmptyState icon={FileText} title="Nenhum comprovante anexado" description="Os comprovantes das apostas aparecerão aqui." /> : (
        <ul className="space-y-2">
          {rows.map((document) => <li key={document.id} className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setViewing(document)} aria-label={`Visualizar ${document.title}`}><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-text-primary">{document.title}</p><StatusBadge label={document.is_published ? "Publicado" : "Privado"} tone={document.is_published ? "success" : "neutral"} /></div>{document.description ? <p className="mt-1 text-sm text-text-secondary">{document.description}</p> : null}<p className="mt-1 text-xs text-text-secondary">{documentTypeLabel(document.mime_type)} · versão {document.version}</p></button>
            <div className="flex flex-wrap gap-1 sm:justify-end">
              <Button variant="outline" className="h-11" onClick={() => setViewing(document)}><Eye aria-hidden />Visualizar</Button>
              {canManage && !readOnly ? <><Button size="icon" className="size-11" variant="ghost" title="Editar comprovante" aria-label="Editar comprovante" onClick={() => setEditing(document)}><Pencil /></Button><Button size="icon" className="size-11" variant="ghost" title="Substituir arquivo" aria-label="Substituir arquivo" onClick={() => { replacement.current = document; replaceInput.current?.click(); }}><RefreshCw /></Button><Button size="icon" className="size-11" variant="ghost" title="Excluir comprovante" aria-label="Excluir comprovante" onClick={() => setDeleting(document)}><Trash2 /></Button></> : null}
            </div>
          </li>)}
        </ul>
      )}
      <input ref={replaceInput} className="hidden" type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; const document = replacement.current; event.target.value = ""; if (file && document && validFile(file)) replace.mutate({ document, file }); }} />
      <DocumentViewer open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }} document={viewerDocument} />
      <DocumentForm open={adding || editing !== null} poolId={poolId} document={editing} nextOrder={rows.length} onClose={() => { setAdding(false); setEditing(null); }} onSaved={invalidate} />
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir comprovante?</DialogTitle><DialogDescription>O arquivo deixará de aparecer no bolão, nos links compartilhados e no relatório.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function DocumentForm({ open, poolId, document, nextOrder, onClose, onSaved }: { open: boolean; poolId: string; document: PoolDocumentRow | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const uploadDocument = useServerFn(uploadPoolDocument);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [published, setPublished] = useState(false); const [file, setFile] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (document) return poolService.updateDocument(document.id, { title, description, sortOrder: document.sort_order, isPublished: published });
      if (!file) throw new Error("Selecione um arquivo válido.");
      const form = new FormData();
      form.set("poolId", poolId);
      form.set("title", title);
      form.set("description", description);
      form.set("sortOrder", String(nextOrder));
      form.set("file", file);
      return uploadDocument({ data: form });
    },
    onSuccess: () => { toast.success(document ? "Comprovante atualizado" : "Comprovante anexado"); onSaved(); onClose(); },
    onError: () => toast.error("Não foi possível salvar o comprovante. Tente novamente."),
  });
  useEffect(() => { if (open) { setTitle(document?.title ?? ""); setDescription(document?.description ?? ""); setPublished(document?.is_published ?? false); setFile(null); } }, [open, document]);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{document ? "Editar comprovante" : "Adicionar comprovante"}</DialogTitle><DialogDescription>{document ? "Altere a identificação e a visibilidade deste comprovante." : "JPG, PNG, WEBP ou PDF, com no máximo 20 MB."}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label htmlFor="document-title">Título</Label><Input id="document-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="document-description">Descrição opcional</Label><Textarea id="document-description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></div>{!document ? <div className="space-y-1.5"><Label htmlFor="document-file">Arquivo</Label><Input id="document-file" type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (!selected) { setFile(null); return; } try { validateDocumentFile(selected); setFile(selected); } catch (error) { toast.error(error instanceof Error ? error.message : "Use JPG, PNG, WEBP ou PDF de até 20 MB."); event.target.value = ""; setFile(null); } }} /></div> : <div className="space-y-2"><div className="flex items-center justify-between gap-4"><div><Label htmlFor="document-published">Visível no compartilhamento</Label><p className="text-xs text-text-secondary">Aparece nas visões Jogos e Completo.</p></div><Switch id="document-published" checked={published} onCheckedChange={setPublished} /></div>{published ? <p className="rounded-md bg-warning-soft p-3 text-xs text-warning-foreground">Verifique se o comprovante contém informações pessoais ou sensíveis antes de disponibilizá-lo aos participantes.</p> : null}</div>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!title.trim() || (!document && !file) || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>;
}