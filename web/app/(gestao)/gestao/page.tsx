import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";

const SISTEMAS_META: Record<string, { titulo: string; icone: string }> = {
  "dashboard": { titulo: "Dashboard Financeiro", icone: "📊" },
  "controle-fiscal": { titulo: "Controle Fiscal", icone: "✅" },
  "planejamento": { titulo: "Planejamento Tributário", icone: "💰" },
  "documentos": { titulo: "Documentos", icone: "📁" },
  "relatorios": { titulo: "Relatórios", icone: "📋" },
};

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function detectSistemas(empresaSlug: string) {
  try {
    const dir = path.join(process.cwd(), "public", "sistemas", empresaSlug);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith(".html")).map(f => {
      const slug = f.replace(".html", "");
      const meta = SISTEMAS_META[slug] || { titulo: slug.replace(/-/g, " "), icone: "⚙️" };
      return { slug, ...meta };
    });
  } catch { return []; }
}

function getAllClientFolders() {
  try {
    const baseDir = path.join(process.cwd(), "public", "sistemas");
    if (!fs.existsSync(baseDir)) return [];
    return fs.readdirSync(baseDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  } catch { return []; }
}

export default async function GestaoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, nome").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "internal"].includes(profile.role)) redirect("/cliente");

  const { data: empresas } = await supabase.from("empresas").select("id, razao_social, nome_fantasia, cnpj, regime, ativo").order("razao_social");
  const folders = getAllClientFolders();

  const clientesComSistemas = (empresas || []).map(emp => {
    const slug = slugify(emp.nome_fantasia || emp.razao_social);
    const sistemas = detectSistemas(slug);
    const hasFolder = folders.includes(slug);
    return { ...emp, slug, sistemas, hasFolder };
  });

  const empresaSlugs = clientesComSistemas.map(c => c.slug);
  const orphanFolders = folders.filter(f => !empresaSlugs.includes(f));

  return (
    <main className="min-h-screen bg-its-dark text-white">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-its-green" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
            <div>
              <div className="text-[10px] text-its-green">Área de Gestão</div>
              <div className="font-bold">Olá, {profile.nome}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/gestao/clientes" className="text-xs text-gray-400 hover:text-its-green">Gerenciar clientes</Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Clientes e Sistemas</h1>
          <Link href="/gestao/clientes/novo" className="btn-green text-sm">+ Novo cliente</Link>
        </div>
        <p className="text-gray-400 mb-8">Sistemas detectados automaticamente a partir das pastas em <code className="text-xs bg-its-gray px-2 py-0.5 rounded">/sistemas/&lt;slug&gt;/</code></p>

        {clientesComSistemas.length === 0 && orphanFolders.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">Nenhum cliente cadastrado. Clique em <b className="text-its-green">Novo cliente</b> para começar.</div>
        ) : (
          <div className="space-y-4">
            {clientesComSistemas.map((c) => (
              <div key={c.id} className="card overflow-hidden">
                <div className="p-6 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">{c.razao_social}</h2>
                      {c.nome_fantasia && <span className="text-xs text-gray-500">({c.nome_fantasia})</span>}
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${c.ativo ? "bg-its-green text-black" : "bg-gray-700 text-gray-400"}`}>
                        {c.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>CNPJ: {c.cnpj}</span>
                      <span>Regime: {c.regime?.toUpperCase()}</span>
                      <span>Slug: <code className="bg-its-gray px-1 rounded">{c.slug}</code></span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">{c.sistemas.length} sistema{c.sistemas.length !== 1 ? "s" : ""}</div>
                </div>
                {c.sistemas.length > 0 ? (
                  <div className="border-t border-its-gray px-6 py-4">
                    <div className="flex flex-wrap gap-3">
                      {c.sistemas.map((s) => (
                        <div key={s.slug} className="flex items-center gap-2 bg-its-darker border border-its-gray rounded-lg px-4 py-2 text-sm">
                          <span>{s.icone}</span>
                          <span className="font-medium">{s.titulo}</span>
                          <span className="text-[10px] text-its-green ml-1">●</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-its-gray px-6 py-4 text-sm text-gray-500">
                    {c.hasFolder ? "Pasta encontrada, mas sem arquivos .html" : <>Sem pasta <code className="bg-its-gray px-1 rounded text-xs">/sistemas/{c.slug}/</code> — crie para adicionar sistemas</>}
                  </div>
                )}
              </div>
            ))}
            {orphanFolders.length > 0 && (
              <div className="card p-6 border-yellow-600/30">
                <div className="text-sm font-bold text-yellow-400 mb-2">Pastas sem empresa vinculada</div>
                <div className="flex flex-wrap gap-2">
                  {orphanFolders.map(f => <code key={f} className="bg-its-gray px-2 py-1 rounded text-xs text-gray-400">/sistemas/{f}/</code>)}
                </div>
                <p className="text-xs text-gray-500 mt-2">Cadastre uma empresa com nome/fantasia correspondente ou renomeie a pasta.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="border-t border-its-gray p-6 text-xs text-gray-500 text-center mt-12">ITS Tax and Corporate · Acesso restrito à equipe</footer>
    </main>
  );
}
