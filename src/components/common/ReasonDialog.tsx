/**
 * Diálogo com formulário de motivo (substitui `window.prompt`).
 * Valida obrigatoriedade, mostra o erro dentro do próprio diálogo e evita
 * perder o texto digitado ao tocar fora.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldLabel = "Motivo",
  placeholder,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loadingLabel = "Salvando…",
  destructive = false,
  loading = false,
  error,
  details,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  fieldLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  details?: React.ReactNode;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const invalid = touched && reason.trim() === "";

  return (
    <Dialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-h-[85vh] max-w-[min(30rem,calc(100vw-2rem))] overflow-y-auto"
        onInteractOutside={(event) => {
          if (reason.trim() !== "" || loading) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (loading) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-3">
          {details}
          <div className="space-y-1.5">
            <Label htmlFor="reason-dialog-field">{fieldLabel}</Label>
            <Textarea
              id="reason-dialog-field"
              autoFocus
              rows={3}
              value={reason}
              placeholder={placeholder ?? ""}
              aria-invalid={invalid}
              onChange={(event) => setReason(event.target.value)}
            />
            {invalid ? <p className="text-xs text-danger">Informe o motivo para continuar.</p> : null}
            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-11"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            className="h-11"
            variant={destructive ? "destructive" : "default"}
            disabled={loading}
            onClick={() => {
              setTouched(true);
              if (reason.trim() === "") return;
              onConfirm(reason.trim());
            }}
          >
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
