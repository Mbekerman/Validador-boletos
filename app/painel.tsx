"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { consultar, reconsultar, type ConsultaState } from "./actions";
import type { BoletoRow } from "@/lib/db";
import { formatarLinha } from "@/lib/linha-digitavel";
import { formatarBanco, formatarDocumento } from "@/lib/formatos";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

function fmtData(d: string | null) {
  if (!d) return null;
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function NaoInformado() {
  return <span className="nao-informado">Não informado</span>;
}

function Pessoa({ b }: { b: BoletoRow }) {
  const nome = b.usuario_nome || b.usuario.split("@")[0];
  return (
    <div className="pessoa" title={b.usuario}>
      <span className="avatar-mini" aria-hidden="true">
        {b.usuario_foto ? <img src={b.usuario_foto} alt="" referrerPolicy="no-referrer" /> : nome.charAt(0).toUpperCase()}
      </span>
      <span className="pessoa-nome">{nome}</span>
    </div>
  );
}

// ---------- Aviso (snackbar) ----------

type Aviso = { texto: string; erro?: boolean; id: number };

function useAviso() {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.erro ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [aviso]);
  return {
    aviso,
    mostrar: (texto: string, erro = false) => setAviso({ texto, erro, id: Date.now() }),
  };
}

// ---------- Ordenação de tabela (crescente, decrescente, sem ordem; várias colunas) ----------

type Ordem = { col: string; dir: 1 | -1 }[];

function useOrdem<T>(linhas: T[], valor: (l: T, col: string) => string | number | null) {
  const [ordem, setOrdem] = useState<Ordem>([]);
  const ordenadas = useMemo(() => {
    if (ordem.length === 0) return linhas;
    return [...linhas].sort((a, b) => {
      for (const { col, dir } of ordem) {
        const va = valor(a, col);
        const vb = valor(b, col);
        if (va === vb) continue;
        if (va === null) return 1;
        if (vb === null) return -1;
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
        if (c !== 0) return c * dir;
      }
      return 0;
    });
  }, [linhas, ordem, valor]);

  function clicar(col: string) {
    setOrdem((o) => {
      const atual = o.find((x) => x.col === col);
      if (!atual) return [...o, { col, dir: 1 }];
      if (atual.dir === 1) return o.map((x) => (x.col === col ? { col, dir: -1 } : x));
      return o.filter((x) => x.col !== col);
    });
  }
  return { ordenadas, ordem, clicar };
}

function Th({ col, children, ordem, clicar, num }: {
  col: string; children: React.ReactNode; ordem: Ordem; clicar: (c: string) => void; num?: boolean;
}) {
  const i = ordem.findIndex((o) => o.col === col);
  const dir = i >= 0 ? ordem[i].dir : 0;
  return (
    <th className={num ? "num" : undefined} aria-sort={dir === 1 ? "ascending" : dir === -1 ? "descending" : "none"}>
      <button type="button" className="th-btn" onClick={() => clicar(col)} title="Ordenar">
        {children}
        <span className="th-seta" aria-hidden="true">{dir === 1 ? "↑" : dir === -1 ? "↓" : ""}</span>
        {ordem.length > 1 && i >= 0 && <span className="th-n">{i + 1}</span>}
      </button>
    </th>
  );
}

// ---------- Painel ----------

const inicial: ConsultaState = { tipo: null, mensagem: "" };

export function Painel({ boletos, verTodos }: { boletos: BoletoRow[]; verTodos: boolean }) {
  const [estado, acao, enviando] = useActionState(consultar, inicial);
  const { aviso, mostrar } = useAviso();
  const formRef = useRef<HTMLFormElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  const liberados = useMemo(() => boletos.filter((b) => b.status === "liberado"), [boletos]);
  const pendentes = useMemo(() => boletos.filter((b) => b.status === "nao_liberado"), [boletos]);

  // Depois de uma consulta que gravou algo, limpa o campo para a próxima.
  useEffect(() => {
    if (estado.em && (estado.tipo === "liberado" || estado.tipo === "nao_liberado")) {
      formRef.current?.reset();
      campoRef.current?.focus();
    }
  }, [estado.em, estado.tipo]);

  return (
    <>
      <section className="quadro">
        <div className="quadro-h"><h2>Consultar boleto</h2></div>
        <form ref={formRef} action={acao} className="consulta">
          <label htmlFor="linha" className="rotulo">Linha digitável</label>
          <div className="consulta-linha">
            <input
              ref={campoRef}
              id="linha"
              name="linha"
              className="campo campo-mono"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cole ou digite os 47 ou 48 números"
              aria-invalid={estado.tipo === "erro" || undefined}
              aria-describedby={estado.tipo ? "consulta-msg" : undefined}
              onMouseUp={(e) => {
                // Primeiro clique seleciona tudo, para colar por cima.
                const el = e.currentTarget;
                if (document.activeElement === el && el.dataset.sel !== "1") {
                  el.select();
                  el.dataset.sel = "1";
                }
              }}
              onBlur={(e) => { e.currentTarget.dataset.sel = ""; }}
              required
            />
            <button type="submit" className="btn btn-primario" disabled={enviando}>
              {enviando ? "Consultando…" : "Consultar"}
            </button>
          </div>
          {estado.tipo && !enviando && (
            <p id="consulta-msg" className={`resultado resultado-${estado.tipo}`} role="status">
              {estado.mensagem}
            </p>
          )}
        </form>
      </section>

      <TabelaLiberados linhas={liberados} verTodos={verTodos} />
      <TabelaPendentes linhas={pendentes} verTodos={verTodos} mostrar={mostrar} />

      {aviso && (
        <div key={aviso.id} className={`snackbar${aviso.erro ? " snackbar-erro" : ""}`} role="status">
          {aviso.texto}
        </div>
      )}
    </>
  );
}

function valorLiberado(b: BoletoRow, col: string): string | number | null {
  switch (col) {
    case "pessoa": return (b.usuario_nome || b.usuario).toLowerCase();
    case "recebedor": return b.beneficiario_nome;
    case "doc": return b.beneficiario_documento;
    case "banco": return formatarBanco(b.banco);
    case "valor": return b.valor === null ? null : Number(b.valor);
    case "venc": return b.vencimento;
    case "consulta": return b.ultima_consulta_em;
    default: return null;
  }
}

function TabelaLiberados({ linhas, verTodos }: { linhas: BoletoRow[]; verTodos: boolean }) {
  const { ordenadas, ordem, clicar } = useOrdem(linhas, valorLiberado);
  return (
    <section className="quadro">
      <div className="quadro-h">
        <h2>Liberados para pagamento</h2>
        <span className="chip chip-ok">{linhas.length}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="vazio">Nenhum boleto liberado ainda.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <Th col="recebedor" ordem={ordem} clicar={clicar}>Recebedor</Th>
                <Th col="doc" ordem={ordem} clicar={clicar}>CPF/CNPJ</Th>
                <Th col="banco" ordem={ordem} clicar={clicar}>Banco</Th>
                <Th col="valor" ordem={ordem} clicar={clicar} num>Valor</Th>
                <Th col="venc" ordem={ordem} clicar={clicar}>Vencimento</Th>
                <th>Linha digitável</th>
                {verTodos && <Th col="pessoa" ordem={ordem} clicar={clicar}>Consultado por</Th>}
                <Th col="consulta" ordem={ordem} clicar={clicar}>Consultado em</Th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((b) => (
                <tr key={b.id}>
                  <td data-rotulo="Recebedor">
                    <div className="principal">{b.beneficiario_nome || <NaoInformado />}</div>
                    {b.empresa && b.empresa !== b.beneficiario_nome && <div className="sub">{b.empresa}</div>}
                  </td>
                  <td data-rotulo="CPF/CNPJ" className="nowrap">{formatarDocumento(b.beneficiario_documento) || <NaoInformado />}</td>
                  <td data-rotulo="Banco">{formatarBanco(b.banco) || <NaoInformado />}</td>
                  <td data-rotulo="Valor" className="num">{b.valor !== null ? brl.format(Number(b.valor)) : <NaoInformado />}</td>
                  <td data-rotulo="Vencimento" className="nowrap">
                    {fmtData(b.vencimento) || <NaoInformado />}
                    {b.vencido && <span className="chip chip-atencao">Vencido</span>}
                  </td>
                  <td data-rotulo="Linha digitável"><code className="linha">{formatarLinha(b.linha_digitavel)}</code></td>
                  {verTodos && <td data-rotulo="Consultado por"><Pessoa b={b} /></td>}
                  <td data-rotulo="Consultado em" className="nowrap">{dataHora.format(new Date(b.ultima_consulta_em))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function valorPendente(b: BoletoRow, col: string): string | number | null {
  switch (col) {
    case "pessoa": return (b.usuario_nome || b.usuario).toLowerCase();
    case "motivo": return b.motivo;
    case "consulta": return b.ultima_consulta_em;
    case "n": return b.consultas;
    default: return null;
  }
}

function TabelaPendentes({ linhas, verTodos, mostrar }: {
  linhas: BoletoRow[]; verTodos: boolean; mostrar: (t: string, erro?: boolean) => void;
}) {
  const { ordenadas, ordem, clicar } = useOrdem(linhas, valorPendente);
  const [emAndamento, setEmAndamento] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function refazer(id: number) {
    setEmAndamento(id);
    startTransition(async () => {
      const r = await reconsultar(id);
      setEmAndamento(null);
      if (r.tipo === "liberado") mostrar(r.mensagem);
      else if (r.tipo === "nao_liberado") mostrar("Continua não liberado.");
      else mostrar(r.mensagem, true);
    });
  }

  return (
    <section className="quadro">
      <div className="quadro-h">
        <h2>Ainda não liberados</h2>
        <span className="chip chip-atencao">{linhas.length}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="vazio">Nenhum boleto pendente.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Linha digitável</th>
                <Th col="motivo" ordem={ordem} clicar={clicar}>Resposta do Asaas</Th>
                {verTodos && <Th col="pessoa" ordem={ordem} clicar={clicar}>Consultado por</Th>}
                <Th col="consulta" ordem={ordem} clicar={clicar}>Última consulta</Th>
                <Th col="n" ordem={ordem} clicar={clicar} num>Consultas</Th>
                <th><span className="sr">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((b) => (
                <tr key={b.id}>
                  <td data-rotulo="Linha digitável"><code className="linha">{formatarLinha(b.linha_digitavel)}</code></td>
                  <td data-rotulo="Resposta do Asaas">{b.motivo || <NaoInformado />}</td>
                  {verTodos && <td data-rotulo="Consultado por"><Pessoa b={b} /></td>}
                  <td data-rotulo="Última consulta" className="nowrap">{dataHora.format(new Date(b.ultima_consulta_em))}</td>
                  <td data-rotulo="Consultas" className="num">{b.consultas}</td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="btn btn-contorno btn-compacto"
                      disabled={emAndamento !== null}
                      onClick={() => refazer(b.id)}
                    >
                      {emAndamento === b.id ? "Consultando…" : "Reconsultar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
