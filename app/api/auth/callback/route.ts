import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE,
  appUrl,
  createSessionToken,
  isAllowed,
  readOAuthToken,
  sessionCookieOptions,
  verifyGoogleIdToken,
} from "@/lib/auth";
import { registrarUsuario } from "@/lib/db";

export const dynamic = "force-dynamic";

function fail(reason: string) {
  const res = NextResponse.redirect(`${appUrl()}/login?erro=${encodeURIComponent(reason)}`);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}

function sameString(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = await readOAuthToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!code || !state || !saved) return fail("Login expirado. Tente de novo.");
  if (!sameString(saved.state, state)) return fail("Login inválido. Tente de novo.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl()}/api/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: saved.verifier,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return fail("O Google recusou o login.");
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return fail("O Google não devolveu a identidade.");

  let claims;
  try {
    claims = await verifyGoogleIdToken(id_token, saved.nonce);
  } catch {
    return fail("Não foi possível validar a identidade do Google.");
  }

  const check = isAllowed(claims);
  if (!check.ok) return fail(check.reason);

  const email = claims.email!.toLowerCase();
  const picture = typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : undefined;
  try {
    await registrarUsuario(email, claims.name, picture);
  } catch (e) {
    // Sem isso só falta o avatar na visão dos administradores; não vale bloquear o login.
    console.error("registrarUsuario falhou", e);
  }
  const token = await createSessionToken({ email, name: claims.name, picture });
  const res = NextResponse.redirect(`${appUrl()}/`);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
