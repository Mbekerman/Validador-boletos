import type { Session } from "@/lib/auth";
import { AvatarMenu } from "./avatar-menu";

export function TopBar({ session }: { session: Session }) {
  const ambiente = process.env.APP_ENV && process.env.APP_ENV !== "production" ? "Desenvolvimento" : null;
  return (
    <header className="barra">
      <div className="barra-marca">
        {/* Logo oficial, K azul chapado (versão para interfaces); negativo no tema escuro. */}
        <img className="logo logo-claro" src="/marca/bkm-original-azul.svg" alt="BKM" width={120} height={52} />
        <img className="logo logo-escuro" src="/marca/bkm-negativo-azul.svg" alt="BKM" width={120} height={52} />
        {ambiente && <span className="selo-ambiente">{ambiente}</span>}
      </div>
      <AvatarMenu nome={session.name} email={session.email} foto={session.picture} />
    </header>
  );
}
