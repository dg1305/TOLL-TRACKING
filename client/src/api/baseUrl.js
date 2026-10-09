/**
 * API base for SERVE_CLIENT:
 * - Dev: relative /api/v1 (Vite proxies to the API)
 * - Prod: same window.location.origin so LAN never hits baked-in localhost
 */
function isLoopbackUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

export function getApiBase() {
  const envUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

  if (import.meta.env.DEV) {
    return "/api/v1";
  }

  if (typeof window !== "undefined") {
    const originBase = `${window.location.origin}/api/v1`;
    if (envUrl && !isLoopbackUrl(envUrl)) return envUrl;
    if (envUrl && isLoopbackUrl(window.location.origin)) return envUrl;
    return originBase;
  }

  return envUrl || "http://localhost:4090/api/v1";
}
