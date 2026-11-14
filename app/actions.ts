"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { simulateBill } from "@/lib/asaas";
import { validarLinhaDigitavel } from "@/lib/linha-digitavel";
import { buscarLinha, salvarLiberado, salvarNaoLiberado } from "@/lib/db";

export type ConsultaState = {
  tipo: "liberado" | "nao_liberado" | "erro" | null;
  mensagem: string;
  /** Muda a cada resposta, para a tela saber que chegou um resultado novo. */
  em?: number;
};

async function consultarLinha(linha: string, email: string): Promise<ConsultaState> {
  const outcome = await simulateBill(linha);
  if (outcome.kind === "liberado") {
    await salvarLiberado(linha, outcome.data, email);
    const nome = outcome.data.bankSlipInfo?.beneficiaryName || "recebedor não informado";
    return { tipo: "liberado", mensagem: `Liberado para pagamento. Recebedor: ${nome}.` };
  }
  if (outcome.kind === "nao_liberado") {
    await salvarNaoLiberado(linha, outcome.motivo, outcome.raw, email);
    return { tipo: "nao_liberado", mensagem: `Ainda não liberado. O Asaas respondeu: ${outcome.motivo}` };
  }
  // Erro de sistema: não grava nada, para não marcar como "não liberado" por falha nossa.
  return { tipo: "erro", mensagem: outcome.motivo };
}

export async function consultar(_prev: ConsultaState, form: FormData): Promise<ConsultaState> {
  const session = await getSession();
  if (!session) return { tipo: "erro", mensagem: "Sessão expirada. Entre de novo." };

  const v = validarLinhaDigitavel(String(form.get("linha") || ""));
  if (!v.ok) return { tipo: "erro", mensagem: v.error, em: Date.now() };

  const result = await consultarLinha(v.digits, session.email);
  revalidatePath("/");
  return { ...result, em: Date.now() };
}

export async function reconsultar(id: number): Promise<ConsultaState> {
  const session = await getSession();
  if (!session) return { tipo: "erro", mensagem: "Sessão expirada. Entre de novo." };
  if (!Number.isInteger(id) || id <= 0) return { tipo: "erro", mensagem: "Boleto inválido." };
  const linha = await buscarLinha(id);
  if (!linha) return { tipo: "erro", mensagem: "Boleto não encontrado." };
  const result = await consultarLinha(linha, session.email);
  revalidatePath("/");
  return result;
}
