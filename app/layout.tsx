import type { Metadata } from "next";
import "./globals.css";

const dev = process.env.APP_ENV && process.env.APP_ENV !== "production";

export const metadata: Metadata = {
  title: dev ? "[DEV] Validador de boletos" : "Validador de boletos",
  robots: { index: false, follow: false },
};

// Aplica o tema guardado antes de pintar, para não piscar.
const temaScript = `try{var t=localStorage.getItem("bkm-validador-tema");if(t==="claro"||t==="escuro")document.documentElement.setAttribute("data-tema",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@300..700&family=Google+Sans+Code&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
