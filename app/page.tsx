import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listarBoletos, type BoletoRow } from "@/lib/db";
import { formatarLinha } from "@/lib/linha-digitavel";
import { ConsultaForm } from "./consulta-form";
import { ReconsultarButton } from "./reconsultar-button";
import { reconsultar } from "./actions";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function fmtData(d: string | null) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function Linha({ v }: { v: string }) {
  return <code className="linha">{formatarLinha(v)}</code>;
}

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const boletos = await listarBoletos();
  const liberados = boletos.filter((b) => b.status === "liberado");
  const pendentes = boletos.filter((b) => b.status === "nao_liberado");

  return (
    <main>
      <header>
        <h1>Validador de boletos</h1>
        <form action="/api/auth/logout" method="post">
          <span className="usuario">{session.email}</span>
          <button type="submit" className="link">Sair</button>
        </form>
      </header>

      <ConsultaForm />

      <section>
        <h2>Liberados para pagamento <span className="contador">{liberados.length}</span></h2>
        {liberados.length === 0 ? (
          <p className="vazio">Nenhum boleto liberado ainda.</p>
        ) : (
          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>Recebedor</th>
                  <th>CPF/CNPJ</th>
                  <th>Banco</th>
                  <th className="num">Valor</th>
                  <th>Vencimento</th>
                  <th>Linha digitável</th>
                  <th>Consultado</th>
                </tr>
              </thead>
              <tbody>
                {liberados.map((b: BoletoRow) => (
                  <tr key={b.id}>
                    <td>
                      {b.beneficiario_nome || "—"}
                      {b.empresa && b.empresa !== b.beneficiario_nome && <div className="sub">{b.empresa}</div>}
                    </td>
                    <td>{b.beneficiario_documento || "—"}</td>
                    <td>{b.banco || "—"}</td>
                    <td className="num">{b.valor ? brl.format(Number(b.valor)) : "—"}</td>
                    <td>
                      {fmtData(b.vencimento)}
                      {b.vencido && <span className="tag">vencido</span>}
                    </td>
                    <td><Linha v={b.linha_digitavel} /></td>
                    <td className="sub">{dataHora.format(new Date(b.ultima_consulta_em))}<br />{b.consultado_por}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Ainda não liberados <span className="contador">{pendentes.length}</span></h2>
        {pendentes.length === 0 ? (
          <p className="vazio">Nenhum boleto pendente.</p>
        ) : (
          <div className="tabela">
            <table>
              <thead>
                <tr>
                  <th>Linha digitável</th>
                  <th>Motivo (Asaas)</th>
                  <th>Última consulta</th>
                  <th className="num">Consultas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((b: BoletoRow) => (
                  <tr key={b.id}>
                    <td><Linha v={b.linha_digitavel} /></td>
                    <td>{b.motivo || "—"}</td>
                    <td className="sub">{dataHora.format(new Date(b.ultima_consulta_em))}<br />{b.consultado_por}</td>
                    <td className="num">{b.consultas}</td>
                    <td>
                      <form action={reconsultar}>
                        <input type="hidden" name="id" value={b.id} />
                        <ReconsultarButton />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
