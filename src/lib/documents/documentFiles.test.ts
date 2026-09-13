import { describe, expect, it } from "vitest";

import { documentExtension, sniffDocumentMime } from "./documentFiles";

describe("formatos seguros de comprovantes", () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0x00], "image/jpeg", "jpg"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", "png"],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp", "webp"],
    [[0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf", "pdf"],
  ] as const)("identifica assinatura real %#", (signature, expectedMime, expectedExtension) => {
    const mime = sniffDocumentMime(new Uint8Array(signature));
    expect(mime).toBe(expectedMime);
    expect(documentExtension(expectedMime)).toBe(expectedExtension);
  });

  it("rejeita conteúdo desconhecido mesmo com extensão aparente", () => {
    expect(sniffDocumentMime(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});