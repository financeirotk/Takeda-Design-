import type { Metadata } from "next";
import "@fontsource-variable/source-sans-3";
import "./globals.css";
import "./paineis.css";
import "./shell.css";

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#b8203a" };

export const metadata: Metadata = {
  title: "Intranet Takeda",
  description: "Painéis de gestão da Takeda Design",
  applicationName: "Intranet Takeda",
  appleWebApp: { capable: true, title: "Takeda", statusBarStyle: "default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
