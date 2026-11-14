import { describe, expect, it } from "vitest";
import { classifyResponse } from "../lib/asaas";
import { isAllowed } from "../lib/auth";

describe("isAllowed (domínio)", () => {
  const d = "bkm.com.br";
  it("aceita conta Workspace verificada do domínio", () => {
    expect(isAllowed({ email: "Ana@BKM.com.br", email_verified: true, hd: "bkm.com.br" }, d).ok).toBe(true);
  });
  it("rejeita e-mail não verificado", () => {
    expect(isAllowed({ email: "ana@bkm.com.br", email_verified: false, hd: "bkm.com.br" }, d).ok).toBe(false);
  });
  it("rejeita outro domínio, inclusive subdomínio e sufixo parecido", () => {
    expect(isAllowed({ email: "x@gmail.com", email_verified: true }, d).ok).toBe(false);
    expect(isAllowed({ email: "x@evil.bkm.com.br", email_verified: true, hd: "evil.bkm.com.br" }, d).ok).toBe(false);
    expect(isAllowed({ email: "x@notbkm.com.br", email_verified: true, hd: "notbkm.com.br" }, d).ok).toBe(false);
    expect(isAllowed({ email: "x@bkm.com.br.evil.com", email_verified: true }, d).ok).toBe(false);
  });
  it("rejeita conta Google pessoal com e-mail do domínio (sem hd)", () => {
    expect(isAllowed({ email: "x@bkm.com.br", email_verified: true }, d).ok).toBe(false);
  });
});

describe("classifyResponse (Asaas)", () => {
  it("200 com bankSlipInfo => liberado", () => {
    const r = classifyResponse(200, { fee: 0, bankSlipInfo: { beneficiaryName: "ACME" } });
    expect(r.kind).toBe("liberado");
  });
  it("400 de negócio => não liberado", () => {
    const r = classifyResponse(400, { errors: [{ code: "invalid_action", description: "Os dados de pagamento são inválidos." }] });
    expect(r).toMatchObject({ kind: "nao_liberado", motivo: "Os dados de pagamento são inválidos." });
  });
  it("400 de conta sem pagamento de contas => erro, não 'não liberado'", () => {
    const r = classifyResponse(400, { errors: [{ code: "x", description: "Você não possui pagamento de contas habilitados, entre em contato com seu gerente." }] });
    expect(r.kind).toBe("erro");
  });
  it("401 e 500 => erro", () => {
    expect(classifyResponse(401, { errors: [{ code: "invalid_access_token" }] }).kind).toBe("erro");
    expect(classifyResponse(500, null).kind).toBe("erro");
  });
});
