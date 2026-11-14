import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "vb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export function allowedDomain(): string {
  return (process.env.ALLOWED_DOMAIN || "bkm.com.br").toLowerCase();
}

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

export type Session = { email: string; name?: string };

export type GoogleClaims = {
  email?: string;
  email_verified?: boolean | string;
  hd?: string;
  name?: string;
};

// Regra de acesso, aplicada no servidor sobre o id_token já verificado.
// O parâmetro `hd` na URL de login é só uma dica de UI e pode ser removido pelo usuário,
// por isso a decisão é feita aqui com o e-mail verificado e o claim `hd` do token.
export function isAllowed(claims: GoogleClaims, domain = allowedDomain()): { ok: true } | { ok: false; reason: string } {
  const email = (claims.email || "").trim().toLowerCase();
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!email || !verified) return { ok: false, reason: "E-mail não verificado pelo Google." };

  const at = email.lastIndexOf("@");
  if (at < 1 || email.slice(at + 1) !== domain) {
    return { ok: false, reason: `Acesso restrito a contas @${domain}.` };
  }
  // Exige conta gerenciada pelo Google Workspace do domínio. Sem isso, alguém poderia criar
  // uma conta Google "pessoal" usando um endereço @dominio e passar na checagem de e-mail.
  if (process.env.REQUIRE_HD !== "false" && (claims.hd || "").toLowerCase() !== domain) {
    return { ok: false, reason: `A conta precisa ser do Google Workspace @${domain}.` };
  }
  return { ok: true };
}

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function verifyGoogleIdToken(idToken: string, nonce: string): Promise<GoogleClaims> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce) throw new Error("nonce inválido");
  return payload as GoogleClaims;
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const email = String(payload.email || "");
    // Revalida o domínio a cada request: se ALLOWED_DOMAIN mudar, sessões antigas caem.
    if (!email.toLowerCase().endsWith(`@${allowedDomain()}`)) return null;
    return { email, name: payload.name ? String(payload.name) : undefined };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export function appUrl(): string {
  const u = process.env.APP_URL;
  if (!u) throw new Error("APP_URL não configurada.");
  return u.replace(/\/$/, "");
}
