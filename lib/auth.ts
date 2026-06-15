// Barrière d'accès simple : ne s'active que si ACCESS_PASSWORD est défini
// (en ligne). Le cookie ne contient pas le mot de passe en clair, mais son
// empreinte SHA-256 — calculée pareil côté middleware (edge) et route (node).

export const ACCESS_COOKIE = "elan_access";

export async function hashToken(pw: string): Promise<string> {
  const data = new TextEncoder().encode(`elan::${pw}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
