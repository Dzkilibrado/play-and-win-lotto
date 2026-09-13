export const DOCUMENT_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type PreviewableDocumentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const MIME_INFO: Record<PreviewableDocumentMime, { extension: string; label: string }> = {
  "image/jpeg": { extension: "jpg", label: "Imagem JPEG" },
  "image/png": { extension: "png", label: "Imagem PNG" },
  "image/webp": { extension: "webp", label: "Imagem WEBP" },
  "application/pdf": { extension: "pdf", label: "PDF" },
};

export function isPreviewableDocumentMime(value: string | null | undefined): value is PreviewableDocumentMime {
  return typeof value === "string" && value in MIME_INFO;
}

export function documentExtension(mimeType: PreviewableDocumentMime) {
  return MIME_INFO[mimeType].extension;
}

export function documentTypeLabel(mimeType: string | null | undefined) {
  return isPreviewableDocumentMime(mimeType) ? MIME_INFO[mimeType].label : "Arquivo";
}

export function formatDocumentSize(size: number | null | undefined) {
  if (!size || size < 1) return "Tamanho não informado";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function sniffDocumentMime(bytes: Uint8Array): PreviewableDocumentMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 12 && new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export function validateDocumentFile(file: File) {
  if (file.size <= 0) throw new Error("Selecione um arquivo válido.");
  if (file.size > DOCUMENT_MAX_FILE_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
  if (!isPreviewableDocumentMime(file.type)) throw new Error("Use um arquivo JPG, PNG, WEBP ou PDF.");
  return file;
}