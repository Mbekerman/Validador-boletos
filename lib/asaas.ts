// Cliente mínimo do endpoint POST /v3/bill/simulate do Asaas.
// Docs: https://docs.asaas.com/reference/simulate-a-bill-payment
//
// O Asaas NÃO tem um campo "liberado". A regra adotada aqui:
//  - 200 com bankSlipInfo            => liberado
//  - 400 de regra de negócio         => não liberado (guarda a mensagem do Asaas)
//  - 401, 403, 429, 5xx, rede, ou conta sem "pagamento de contas" => erro de sistema,
//    que NÃO pode virar "não liberado".

export type BankSlipInfo = {
  identificationField?: string;
  value?: number;
  dueDate?: string;
  companyName?: string | null;
  bank?: string;
  beneficiaryCpfCnpj?: string;
  beneficiaryName?: string;
  allowChangeValue?: boolean;
  minValue?: number;
  maxValue?: number;
  discountValue?: number;
  interestValue?: number;
  fineValue?: number;
  originalValue?: number;
  totalDiscountValue?: number;
  totalAdditionalValue?: number;
  totalPaidValue?: number;
  isOverdue?: boolean;
};

export type SimulateResponse = {
  minimumScheduleDate?: string;
  fee?: number;
  bankSlipInfo?: BankSlipInfo;
};

export type AsaasError = { code?: string; description?: string };

export type SimulateOutcome =
  | { kind: "liberado"; data: SimulateResponse }
  | { kind: "nao_liberado"; motivo: string; raw: unknown }
  | { kind: "erro"; motivo: string; status?: number };

// Mensagens de 400 que indicam problema da conta/integração, não do boleto.
const ERROS_DE_CONTA = [/habilitad/i, /access_token/i, /chave de api/i, /permiss/i];

export function classifyResponse(status: number, body: unknown): SimulateOutcome {
  if (status === 200) {
    const data = body as SimulateResponse;
    if (data && typeof data === "object" && data.bankSlipInfo) {
      return { kind: "liberado", data };
    }
    return { kind: "erro", motivo: "O Asaas respondeu 200 sem os dados do boleto.", status };
  }

  const errors: AsaasError[] =
    body && typeof body === "object" && Array.isArray((body as { errors?: unknown }).errors)
      ? ((body as { errors: AsaasError[] }).errors)
      : [];
  const motivo = errors.map((e) => e.description || e.code).filter(Boolean).join("; ");

  if (status === 400) {
    if (!motivo) return { kind: "erro", motivo: "O Asaas recusou a consulta sem explicar o motivo.", status };
    const texto = errors.map((e) => `${e.code ?? ""} ${e.description ?? ""}`).join(" ");
    if (ERROS_DE_CONTA.some((re) => re.test(texto))) {
      return { kind: "erro", motivo: `Problema na conta Asaas: ${motivo}`, status };
    }
    return { kind: "nao_liberado", motivo, raw: body };
  }

  if (status === 401 || status === 403) {
    return { kind: "erro", motivo: `Chave do Asaas inválida ou sem permissão (${status}). ${motivo}`.trim(), status };
  }
  if (status === 429) return { kind: "erro", motivo: "Limite de requisições do Asaas atingido. Tente em instantes.", status };
  return { kind: "erro", motivo: `Erro do Asaas (${status}). ${motivo}`.trim(), status };
}

export async function simulateBill(identificationField: string): Promise<SimulateOutcome> {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";
  if (!apiKey) return { kind: "erro", motivo: "ASAAS_API_KEY não configurada no servidor." };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/bill/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "validador-boletos",
        access_token: apiKey,
      },
      body: JSON.stringify({ identificationField }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { kind: "erro", motivo: `Não foi possível falar com o Asaas: ${(e as Error).message}` };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return classifyResponse(res.status, body);
}
