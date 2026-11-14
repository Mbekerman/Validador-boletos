// Validação local da linha digitável, antes de gastar uma chamada no Asaas.
// Suporta boletos bancários (47 dígitos) e de arrecadação/concessionárias (48 dígitos).

export type LinhaResult =
  | { ok: true; digits: string; tipo: "bancario" | "arrecadacao" }
  | { ok: false; error: string };

function mod10(num: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * weight;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    sum += p;
    weight = weight === 2 ? 1 : 2;
  }
  const r = sum % 10;
  return r === 0 ? 0 : 10 - r;
}

// Módulo 11 usado na arrecadação (pesos 2..9, resto 0 ou 1 => DV 0).
function mod11Arrecadacao(num: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    sum += Number(num[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const r = sum % 11;
  if (r === 0 || r === 1) return 0;
  return 11 - r;
}

// Módulo 11 do DV geral do código de barras bancário (resultado 0, 10 ou 11 => 1).
function mod11Bancario(num: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    sum += Number(num[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

export function normalizeLinha(input: string): string {
  return input.replace(/\D/g, "");
}

export function validarLinhaDigitavel(input: string): LinhaResult {
  const d = normalizeLinha(input);

  if (d.length === 47) {
    const campos = [
      { body: d.slice(0, 9), dv: Number(d[9]) },
      { body: d.slice(10, 20), dv: Number(d[20]) },
      { body: d.slice(21, 31), dv: Number(d[31]) },
    ];
    for (const [i, c] of campos.entries()) {
      if (mod10(c.body) !== c.dv) {
        return { ok: false, error: `Dígito verificador do campo ${i + 1} não confere. Confira a digitação.` };
      }
    }
    // Monta o código de barras para checar o DV geral (posição 33 da linha).
    const barcodeSemDv = d.slice(0, 4) + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
    if (mod11Bancario(barcodeSemDv) !== Number(d[32])) {
      return { ok: false, error: "Dígito verificador geral não confere. Confira a digitação." };
    }
    return { ok: true, digits: d, tipo: "bancario" };
  }

  if (d.length === 48) {
    if (d[0] !== "8") return { ok: false, error: "Linha de 48 dígitos deve começar com 8 (arrecadação)." };
    const ref = d[2];
    const calc = ref === "6" || ref === "7" ? mod10 : ref === "8" || ref === "9" ? mod11Arrecadacao : null;
    if (!calc) return { ok: false, error: "Identificador de valor inválido na linha de arrecadação." };
    for (let i = 0; i < 4; i++) {
      const bloco = d.slice(i * 12, i * 12 + 11);
      if (calc(bloco) !== Number(d[i * 12 + 11])) {
        return { ok: false, error: `Dígito verificador do bloco ${i + 1} não confere. Confira a digitação.` };
      }
    }
    return { ok: true, digits: d, tipo: "arrecadacao" };
  }

  return { ok: false, error: `A linha digitável deve ter 47 ou 48 dígitos (recebi ${d.length}).` };
}

export function formatarLinha(d: string): string {
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
  }
  if (d.length === 48) {
    return [0, 1, 2, 3].map((i) => `${d.slice(i * 12, i * 12 + 11)}-${d[i * 12 + 11]}`).join(" ");
  }
  return d;
}
