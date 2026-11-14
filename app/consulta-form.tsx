"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { consultar, type ConsultaState } from "./actions";

const initial: ConsultaState = { tipo: null, mensagem: "" };

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Consultando…" : "Consultar"}
    </button>
  );
}

export function ConsultaForm() {
  const [state, action] = useActionState(consultar, initial);
  return (
    <form action={action} className="consulta">
      <label htmlFor="linha">Linha digitável</label>
      <div className="row">
        <input
          id="linha"
          name="linha"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
          required
        />
        <Botao />
      </div>
      {state.tipo && (
        <p className={`aviso ${state.tipo}`} role="status">
          {state.mensagem}
        </p>
      )}
    </form>
  );
}
