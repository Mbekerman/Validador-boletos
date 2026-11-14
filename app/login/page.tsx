import { redirect } from "next/navigation";
import { allowedDomain, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getSession()) redirect("/");
  const { erro } = await searchParams;
  return (
    <main className="login">
      <h1>Validador de boletos</h1>
      <p>Entre com sua conta Google @{allowedDomain()}.</p>
      {erro && <p className="aviso erro" role="alert">{erro}</p>}
      <a className="botao" href="/api/auth/login">Entrar com Google</a>
    </main>
  );
}
