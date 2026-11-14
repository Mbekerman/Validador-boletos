import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(48);
  process.env.ALLOWED_DOMAIN = "bkm.com.br";
});

describe("cookie __session", () => {
  it("o estado do login não vale como sessão, e a sessão não vale como estado do login", async () => {
    const { createOAuthToken, createSessionToken, readOAuthToken, readSessionToken } = await import("../lib/auth");
    const oauth = await createOAuthToken({ state: "s", nonce: "n", verifier: "v" });
    const sessao = await createSessionToken({ email: "ana@bkm.com.br" });
    expect(await readSessionToken(oauth)).toBeNull();
    expect(await readOAuthToken(sessao)).toBeNull();
    expect(await readOAuthToken(oauth)).toEqual({ state: "s", nonce: "n", verifier: "v" });
    expect((await readSessionToken(sessao))?.email).toBe("ana@bkm.com.br");
  });
  it("rejeita token adulterado", async () => {
    const { createSessionToken, readSessionToken } = await import("../lib/auth");
    const t = await createSessionToken({ email: "ana@bkm.com.br" });
    expect(await readSessionToken(t.slice(0, -2) + "xx")).toBeNull();
  });
});
