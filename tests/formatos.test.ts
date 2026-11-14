import { describe, expect, it } from "vitest";
import { formatarBanco, formatarDocumento } from "../lib/formatos";

describe("formatarDocumento", () => {
  it("formata CNPJ e CPF", () => {
    expect(formatarDocumento("28979210000192")).toBe("28.979.210/0001-92");
    expect(formatarDocumento("12345678909")).toBe("123.456.789-09");
  });
  it("mantém o que já vem formatado ou não reconhece", () => {
    expect(formatarDocumento("28.979.210/0001-92")).toBe("28.979.210/0001-92");
    expect(formatarDocumento("123")).toBe("123");
    expect(formatarDocumento(null)).toBe(null);
  });
});

describe("formatarBanco", () => {
  it("mostra código e nome", () => {
    expect(formatarBanco("461")).toBe("461 · Asaas");
    expect(formatarBanco("1")).toBe("001 · Banco do Brasil");
  });
  it("código desconhecido fica só o número; nome fica como veio", () => {
    expect(formatarBanco("999")).toBe("999");
    expect(formatarBanco("Itaú Unibanco")).toBe("Itaú Unibanco");
  });
});
