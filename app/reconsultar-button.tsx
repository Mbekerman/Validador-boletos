"use client";

import { useFormStatus } from "react-dom";

export function ReconsultarButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secundario" disabled={pending}>
      {pending ? "Consultando…" : "Reconsultar"}
    </button>
  );
}
