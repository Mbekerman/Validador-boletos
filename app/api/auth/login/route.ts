import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { SESSION_COOKIE, allowedDomain, appUrl, createOAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const b64url = (buf: Buffer) => buf.toString("base64url");

export async function GET() {
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl()}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    hd: allowedDomain(), // só dica de UI; a regra real está em isAllowed()
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set(SESSION_COOKIE, await createOAuthToken({ state, nonce, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
