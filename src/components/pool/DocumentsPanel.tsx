import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { poolService, type PoolDocumentRow } from "@/lib/services/poolService";

const ACCEPT = "image/jpeg,image/png,application/pdf";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function DocumentsPanel({ poolId, canManage, readOnly }: { poolId: string; canManage: boolean; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PoolDocumentRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PoolDocumentRow | null>(null);
  const replacement = useRef<PoolDocumentRow | null>(null);
  const replaceInput = useRef<HTMLInputElement | null>(null);
  const documents = useQuery({ queryKey: ["pool-documents", poolId], queryFn: () => poolService.activeDocuments(poolId) });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["pool-documents", poolId] }); void queryClient.invalidateQueries({ queryKey: ["pool-events", poolId] }); };
  const replace = useMutation({
    mutationFn: ({ document, file }: { document: PoolDocumentRow; file: File }) => poolService.replaceDocument(document, file),
    onSuccess: () => { toast.success("Arquivo substituído"); invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (document: PoolDocumentRow) => poolService.deleteDocument(document),
    onSuccess: () => { toast.success("Comprovante excluído"); setDeleting(null); invalidate(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const openDocument = async (document: PoolDocumentRow) => {
    try { window.open(await poolService.documentUrl(document.storage_path), "_blank", "noopener,noreferrer"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir o comprovante"); }
  };
  const validFile = (file: File) => {
    if (!ACCEPT.split(",").includes(file.type)) { toast.error("Use um arquivo JPG, PNG ou PDF."); return false; }
    if (file.size > MAX_FILE_SIZE) { toast.error("O arquivo deve ter no máximo 20 MB."); return false; }
    return true;
  };

  if (documents.isLoading) return <LoadingState rows={3} />;
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
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-text-primary">{document.title}</p><StatusBadge label={document.is_published ? "Publicado" : "Privado"} tone={document.is_published ? "success" : "neutral"} /></div>{document.description ? <p className="mt-1 text-sm text-text-secondary">{document.description}</p> : null}<p className="mt-1 text-xs text-text-secondary">{document.mime_type === "application/pdf" ? "PDF" : "Imagem"} · versão {document.version}</p></div>
            <div className="flex flex-wrap gap-1">
              <Button size="icon" variant="ghost" title="Abrir comprovante" aria-label="Abrir comprovante" onClick={() => void openDocument(document)}><ExternalLink /></Button>
              {canManage && !readOnly ? <><Button size="icon" variant="ghost" title="Editar comprovante" aria-label="Editar comprovante" onClick={() => setEditing(document)}><Pencil /></Button><Button size="icon" variant="ghost" title="Substituir arquivo" aria-label="Substituir arquivo" onClick={() => { replacement.current = document; replaceInput.current?.click(); }}><RefreshCw /></Button><Button size="icon" variant="ghost" title="Excluir comprovante" aria-label="Excluir comprovante" onClick={() => setDeleting(document)}><Trash2 /></Button></> : null}
            </div>
          </li>)}
        </ul>
      )}
      <input ref={replaceInput} className="hidden" type="file" accept={ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; const document = replacement.current; event.target.value = ""; if (file && document && validFile(file)) replace.mutate({ document, file }); }} />
      <DocumentForm open={adding || editing !== null} poolId={poolId} document={editing} nextOrder={rows.length} onClose={() => { setAdding(false); setEditing(null); }} onSaved={invalidate} />
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir comprovante?</DialogTitle><DialogDescription>O arquivo deixará de aparecer no bolão, nos links compartilhados e no relatório.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>Excluir</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function DocumentForm({ open, poolId, document, nextOrder, onClose, onSaved }: { open: boolean; poolId: string; document: PoolDocumentRow | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [published, setPublished] = useState(false); const [file, setFile] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: async () => document ? poolService.updateDocument(document.id, { title, description, sortOrder: document.sort_order, isPublished: published }) : poolService.uploadDocument(poolId, file as File, title, description, nextOrder),
    onSuccess: () => { toast.success(document ? "Comprovante atualizado" : "Comprovante anexado"); onSaved(); onClose(); },
    onError: (error: Error) => toast.error(error.message),
  });
  useEffect(() => { if (open) { setTitle(document?.title ?? ""); setDescription(document?.description ?? ""); setPublished(document?.is_published ?? false); setFile(null); } }, [open, document]);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{document ? "Editar comprovante" : "Adicionar comprovante"}</DialogTitle><DialogDescription>{document ? "Altere a identificação e a visibilidade deste comprovante." : "JPG, PNG ou PDF, com no máximo 20 MB."}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label htmlFor="document-title">Título</Label><Input id="document-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="document-description">Descrição opcional</Label><Textarea id="document-description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></div>{!document ? <div className="space-y-1.5"><Label htmlFor="document-file">Arquivo</Label><Input id="document-file" type="file" accept={ACCEPT} onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && (selected.size > MAX_FILE_SIZE || !ACCEPT.split(",").includes(selected.type))) { toast.error("Use JPG, PNG ou PDF de até 20 MB."); event.target.value = ""; setFile(null); } else setFile(selected); }} /></div> : <div className="flex items-center justify-between gap-4"><div><Label htmlFor="document-published">Visível no compartilhamento</Label><p className="text-xs text-text-secondary">Aparece nas visões Jogos e Completo.</p></div><Switch id="document-published" checked={published} onCheckedChange={setPublished} /></div>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!title.trim() || (!document && !file) || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>;
}