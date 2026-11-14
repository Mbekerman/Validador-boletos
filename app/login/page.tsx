import { redirect } from "next/navigation";
import { allowedDomain, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/");
  const { erro } = await searchParams;
  return (
    <main className="login">
      <div className="quadro login-quadro">
        <img className="logo logo-claro" src="/marca/bkm-original-azul.svg" alt="BKM" width={140} height={61} />
        <img className="logo logo-escuro" src="/marca/bkm-negativo-azul.svg" alt="BKM" width={140} height={61} />
        <h1>Validador de boletos</h1>
        <p className="sub">Entre com sua conta Google @{allowedDomain()}.</p>
        {erro && <p className="resultado resultado-erro" role="alert">{erro}</p>}
        <a className="btn btn-primario" href="/api/auth/login">Entrar com Google</a>
      </div>
    </main>
  );
}
