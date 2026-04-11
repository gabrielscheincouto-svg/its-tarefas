import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";

interface Props {
  params: { path: string[] };
}

export default async function SistemaViewerPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=cliente");

  const [empresaSlug, sistemaSlug] = params.path;
  if (!empresaSlug || !sistemaSlug) redirect("/cliente");

  const htmlFile = path.join(process.cwd(), "public", "sistemas", empresaSlug, `${sistemaSlug}.html`);
  const exists = fs.existsSync(htmlFile);
  if (!exists) redirect("/cliente");

  const iframeSrc = `/sistemas/${empresaSlug}/${sistemaSlug}.html`;

  const NOMES: Record<string, string> = {
    "dashboard": "Dashboard Financeiro",
    "controle-fiscal": "Controle Fiscal",
    "planejamento": "Planejamento Tributário",
    "documentos": "Documentos",
    "relatorios": "Relatórios",
  };
  const titulo = NOMES[sistemaSlug] || sistemaSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <main className="min-h-screen bg-its-dark text-white flex flex-col">
      <header className="bg-its-darker border-b border-its-gray p-3 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cliente" className="text-xs text-gray-400 hover:text-its-green flex items-center gap-1">← Voltar</Link>
            <div className="h-4 w-px bg-its-gray" />
            <div>
              <div className="text-[10px] text-its-green">Sistema</div>
              <div className="font-bold text-sm">{titulo}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>
      <div className="flex-1 relative">
        <iframe src={iframeSrc} className="absolute inset-0 w-full h-full border-none" title={titulo} sandbox="allow-scripts allow-same-origin" />
      </div>
    </main>
  );
}
