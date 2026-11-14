"use client";

import { useEffect, useRef, useState } from "react";

type Tema = "claro" | "escuro" | "auto";
const CHAVE_TEMA = "bkm-validador-tema";

function aplicarTema(t: Tema) {
  if (t === "auto") document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", t);
}

export function AvatarMenu({ nome, email, foto }: { nome?: string; email: string; foto?: string }) {
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<Tema>("auto");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(CHAVE_TEMA) as Tema | null;
      if (t === "claro" || t === "escuro") setTema(t);
    } catch {}
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function escolherTema(t: Tema) {
    setTema(t);
    aplicarTema(t);
    try {
      if (t === "auto") localStorage.removeItem(CHAVE_TEMA);
      else localStorage.setItem(CHAVE_TEMA, t);
    } catch {}
  }

  const inicial = (nome || email).trim().charAt(0).toUpperCase();

  return (
    <div className="avatar-wrap" ref={ref}>
      <button
        type="button"
        className="avatar"
        aria-label="Conta"
        title={`Conta: ${email}`}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {foto ? <img src={foto} alt="" referrerPolicy="no-referrer" /> : <span>{inicial}</span>}
      </button>
      {aberto && (
        <div className="menu" role="menu">
          <div className="menu-conta">
            {nome && <div className="menu-nome">{nome}</div>}
            <div className="menu-email">{email}</div>
          </div>
          <div className="menu-sec">
            <div className="menu-rotulo">Tema</div>
            <div className="segmentado" role="group" aria-label="Tema">
              {(["claro", "escuro", "auto"] as Tema[]).map((t) => (
                <button key={t} type="button" aria-pressed={tema === t} onClick={() => escolherTema(t)}>
                  {t === "claro" ? "Claro" : t === "escuro" ? "Escuro" : "Automático"}
                </button>
              ))}
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="menu-sec">
            <button type="submit" className="btn btn-texto" role="menuitem">Sair</button>
          </form>
        </div>
      )}
    </div>
  );
}
