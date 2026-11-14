import { describe, expect, it } from "vitest";
import { validarLinhaDigitavel } from "../lib/linha-digitavel";

// Exemplo da documentação do Asaas.
const ASAAS_EXEMPLO = "03399.77779 29900.000000 04751.101017 1 81510000002990";

describe("validarLinhaDigitavel", () => {
  it("aceita a linha de exemplo do Asaas, com ou sem pontuação", () => {
    const r = validarLinhaDigitavel(ASAAS_EXEMPLO);
    expect(r.ok).toBe(true);
    expect(validarLinhaDigitavel(ASAAS_EXEMPLO.replace(/\D/g, "")).ok).toBe(true);
  });

  it("rejeita tamanho errado", () => {
    const r = validarLinhaDigitavel("123");
    expect(r.ok).toBe(false);
  });

  it("rejeita dígito trocado no campo 1", () => {
    const d = ASAAS_EXEMPLO.replace(/\D/g, "");
    const trocado = d.slice(0, 3) + ((Number(d[3]) + 1) % 10) + d.slice(4);
    expect(validarLinhaDigitavel(trocado).ok).toBe(false);
  });

  it("rejeita valor trocado (DV geral)", () => {
    const d = ASAAS_EXEMPLO.replace(/\D/g, "");
    const trocado = d.slice(0, 46) + ((Number(d[46]) + 1) % 10);
    expect(validarLinhaDigitavel(trocado).ok).toBe(false);
  });

  it("valida arrecadação (48 dígitos) com mod10", () => {
    // Monta uma linha de arrecadação válida (ref 6 => módulo 10).
    const blocos = ["83660000000", "12345678901", "23456789012", "34567890123"];
    const mod10 = (n: string) => {
      let s = 0, w = 2;
      for (let i = n.length - 1; i >= 0; i--) {
        let p = Number(n[i]) * w;
        if (p > 9) p = Math.floor(p / 10) + (p % 10);
        s += p; w = w === 2 ? 1 : 2;
      }
      return s % 10 === 0 ? 0 : 10 - (s % 10);
    };
    const linha = blocos.map((b) => b + mod10(b)).join("");
    expect(validarLinhaDigitavel(linha)).toMatchObject({ ok: true, tipo: "arrecadacao" });
    expect(validarLinhaDigitavel(linha.slice(0, 47) + ((Number(linha[47]) + 1) % 10)).ok).toBe(false);
  });
});
