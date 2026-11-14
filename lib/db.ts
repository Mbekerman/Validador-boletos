import { neon } from "@neondatabase/serverless";
import type { SimulateResponse } from "./asaas";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  return neon(url);
}

export type BoletoRow = {
  id: number;
  linha_digitavel: string;
  status: "liberado" | "nao_liberado";
  beneficiario_nome: string | null;
  beneficiario_documento: string | null;
  empresa: string | null;
  banco: string | null;
  valor: string | null;
  vencimento: string | null;
  vencido: boolean | null;
  motivo: string | null;
  consultado_por: string;
  consultas: number;
  criado_em: string;
  ultima_consulta_em: string;
};

export async function salvarLiberado(linha: string, data: SimulateResponse, email: string) {
  const b = data.bankSlipInfo ?? {};
  await sql()`
    INSERT INTO boletos (linha_digitavel, status, beneficiario_nome, beneficiario_documento, empresa, banco,
                         valor, vencimento, vencido, motivo, resposta, consultado_por)
    VALUES (${linha}, 'liberado', ${b.beneficiaryName ?? null}, ${b.beneficiaryCpfCnpj ?? null},
            ${b.companyName ?? null}, ${b.bank ?? null}, ${b.value ?? null}, ${b.dueDate ?? null},
            ${b.isOverdue ?? null}, NULL, ${JSON.stringify(data)}, ${email})
    ON CONFLICT (linha_digitavel) DO UPDATE SET
      status = 'liberado',
      beneficiario_nome = EXCLUDED.beneficiario_nome,
      beneficiario_documento = EXCLUDED.beneficiario_documento,
      empresa = EXCLUDED.empresa,
      banco = EXCLUDED.banco,
      valor = EXCLUDED.valor,
      vencimento = EXCLUDED.vencimento,
      vencido = EXCLUDED.vencido,
      motivo = NULL,
      resposta = EXCLUDED.resposta,
      consultado_por = EXCLUDED.consultado_por,
      consultas = boletos.consultas + 1,
      ultima_consulta_em = now()`;
}

export async function salvarNaoLiberado(linha: string, motivo: string, raw: unknown, email: string) {
  await sql()`
    INSERT INTO boletos (linha_digitavel, status, motivo, resposta, consultado_por)
    VALUES (${linha}, 'nao_liberado', ${motivo}, ${JSON.stringify(raw)}, ${email})
    ON CONFLICT (linha_digitavel) DO UPDATE SET
      motivo = EXCLUDED.motivo,
      resposta = EXCLUDED.resposta,
      consultado_por = EXCLUDED.consultado_por,
      consultas = boletos.consultas + 1,
      ultima_consulta_em = now()
    -- Um boleto já liberado não volta a "não liberado" por uma recusa posterior
    -- (ex.: "Esta conta já foi paga"); só atualizamos o motivo se ainda estava pendente.
    WHERE boletos.status = 'nao_liberado'`;
}

export async function buscarLinha(id: number): Promise<string | null> {
  const rows = (await sql()`SELECT linha_digitavel FROM boletos WHERE id = ${id}`) as { linha_digitavel: string }[];
  return rows[0]?.linha_digitavel ?? null;
}

export async function listarBoletos(): Promise<BoletoRow[]> {
  return (await sql()`
    SELECT id, linha_digitavel, status, beneficiario_nome, beneficiario_documento, empresa, banco,
           valor::text AS valor, to_char(vencimento, 'YYYY-MM-DD') AS vencimento, vencido, motivo,
           consultado_por, consultas, criado_em::text, ultima_consulta_em::text
    FROM boletos
    ORDER BY ultima_consulta_em DESC
    LIMIT 500`) as BoletoRow[];
}
