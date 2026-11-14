import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listarBoletos } from "@/lib/db";
import { TopBar } from "./top-bar";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const boletos = await listarBoletos();

  return (
    <>
      <TopBar session={session} />
      <main className="pagina">
        <h1 className="titulo-pagina">Validador de boletos</h1>
        <Painel boletos={boletos} />
      </main>
    </>
  );
}
