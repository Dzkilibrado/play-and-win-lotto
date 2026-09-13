import { appConfig } from "@/config/app.config";

const APEX_HOST = "gestordasorte.com.br";

/** Redireciona somente o domínio oficial sem WWW, preservando todo o endereço. */
export function canonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== APEX_HOST) return null;
  url.protocol = "https:";
  url.host = new URL(appConfig.canonicalOrigin).host;
  return Response.redirect(url, 308);
}