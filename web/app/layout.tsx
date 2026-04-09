import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ITS Tax and Corporate",
  description: "Auditoria, planejamento tributário e inteligência fiscal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
