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
  /** Dono da consulta: quem consultou o boleto pela primeira vez. Nunca muda. */
  usuario: string;
  usuario_nome: string | null;
  usuario_foto: string | null;
  /** Quem fez a consulta mais recente (o dono ou um administrador). */
  ultima_consulta_por: string;
  consultas: number;
  criado_em: string;
  ultima_consulta_em: string;
};

/** Guarda nome e foto do Google para mostrar o avatar de quem consultou. */
export async function registrarUsuario(email: string, nome: string | undefined, foto: string | undefined) {
  await sql()`
    INSERT INTO usuarios (email, nome, foto)
    VALUES (${email}, ${nome ?? null}, ${foto ?? null})
    ON CONFLICT (email) DO UPDATE SET
      nome = EXCLUDED.nome,
      foto = EXCLUDED.foto,
      ultimo_login_em = now()`;
}

// Cada pessoa tem a própria linha por boleto: (linha_digitavel, usuario) é único.
// `dono` é o usuário da linha; `por` é quem está consultando agora.

export async function salvarLiberado(linha: string, data: SimulateResponse, dono: string, por: string) {
  const b = data.bankSlipInfo ?? {};
  await sql()`
    INSERT INTO boletos (linha_digitavel, usuario, status, beneficiario_nome, beneficiario_documento, empresa, banco,
                         valor, vencimento, vencido, motivo, resposta, ultima_consulta_por)
    VALUES (${linha}, ${dono}, 'liberado', ${b.beneficiaryName ?? null}, ${b.beneficiaryCpfCnpj ?? null},
            ${b.companyName ?? null}, ${b.bank ?? null}, ${b.value ?? null}, ${b.dueDate ?? null},
            ${b.isOverdue ?? null}, NULL, ${JSON.stringify(data)}, ${por})
    ON CONFLICT (linha_digitavel, usuario) DO UPDATE SET
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
      ultima_consulta_por = EXCLUDED.ultima_consulta_por,
      consultas = boletos.consultas + 1,
      ultima_consulta_em = now()`;
}

export async function salvarNaoLiberado(linha: string, motivo: string, raw: unknown, dono: string, por: string) {
  await sql()`
    INSERT INTO boletos (linha_digitavel, usuario, status, motivo, resposta, ultima_consulta_por)
    VALUES (${linha}, ${dono}, 'nao_liberado', ${motivo}, ${JSON.stringify(raw)}, ${por})
    ON CONFLICT (linha_digitavel, usuario) DO UPDATE SET
      motivo = EXCLUDED.motivo,
      resposta = EXCLUDED.resposta,
      ultima_consulta_por = EXCLUDED.ultima_consulta_por,
      consultas = boletos.consultas + 1,
      ultima_consulta_em = now()
    -- Um boleto já liberado não volta a "não liberado" por uma recusa posterior
    -- (ex.: "Esta conta já foi paga"); só atualizamos o motivo se ainda estava pendente.
    WHERE boletos.status = 'nao_liberado'`;
}

export async function buscarBoleto(id: number): Promise<{ linha_digitavel: string; usuario: string } | null> {
  const rows = (await sql()`SELECT linha_digitavel, usuario FROM boletos WHERE id = ${id}`) as {
    linha_digitavel: string;
    usuario: string;
  }[];
  return rows[0] ?? null;
}

/** Administrador vê todas as consultas; os demais, só as próprias. */
export async function listarBoletos(email: string, verTodos: boolean): Promise<BoletoRow[]> {
  return (await sql()`
    SELECT b.id, b.linha_digitavel, b.status, b.beneficiario_nome, b.beneficiario_documento, b.empresa, b.banco,
           b.valor::text AS valor, to_char(b.vencimento, 'YYYY-MM-DD') AS vencimento, b.vencido, b.motivo,
           b.usuario, u.nome AS usuario_nome, u.foto AS usuario_foto, b.ultima_consulta_por,
           b.consultas, b.criado_em::text, b.ultima_consulta_em::text
    FROM boletos b
    LEFT JOIN usuarios u ON u.email = b.usuario
    WHERE ${verTodos} OR b.usuario = ${email}
    ORDER BY b.ultima_consulta_em DESC
    LIMIT 1000`) as BoletoRow[];
}
