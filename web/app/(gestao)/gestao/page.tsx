import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function GestaoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=gestao");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nome")
    .eq("id", user.id)
    .maybeSingle();

  // Só equipe ITS pode entrar aqui
  if (!profile || !["admin", "internal"].includes(profile.role)) {
    redirect("/cliente");
  }

  const sistemas = [
    {
      title: "Controle de Tarefas",
      desc: "Sistema de tarefas da equipe ITS com checklist, clientes, histórico e modo TV.",
      href: "https://its-tarefas-7xlm.onrender.com/",
      icon: "✅",
      badge: "ATIVO",
      external: true,
    },
    {
      title: "Auditoria Mensal",
      desc: "Processo mensal, auditorias, diffs e publicação do relatório ao cliente.",
      href: "/admin",
      icon: "📊",
      badge: "ATIVO",
      external: false,
    },
    {
      title: "Empresas & Contadores",
      desc: "Cadastro de empresas-cliente, escritórios contábeis e vínculos.",
      href: "/admin",
      icon: "🏢",
      badge: "ATIVO",
      external: false,
    },
    {
      title: "Planejamento Tributário",
      desc: "Simulação Simples × Presumido × Real a partir do balancete.",
      href: "#",
      icon: "💰",
      badge: "EM BREVE",
      external: false,
    },
  ];

  return (
    <main className="min-h-screen bg-its-dark text-white">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-its-green"
              style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
            <div>
              <div className="text-[10px] text-its-green">Área de Gestão</div>
              <div className="font-bold">Olá, {profile.nome}</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Sistemas de Gestão ITS</h1>
        <p className="text-gray-400 mt-2">Acesse os sistemas internos da equipe.</p>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          {sistemas.map((s) => (
            <SistemaCard key={s.title} {...s} />
          ))}
        </div>
      </section>

      <footer className="border-t border-its-gray p-6 text-xs text-gray-500 text-center mt-12">
        ITS Tax and Corporate · Acesso restrito à equipe
      </footer>
    </main>
  );
}

function SistemaCard({ title, desc, href, icon, badge, external }: any) {
  const disabled = badge === "EM BREVE";
  const Tag: any = disabled ? "div" : "a";
  const props = disabled
    ? { className: "card p-6 block opacity-50 cursor-not-allowed" }
    : {
        href,
        target: external ? "_blank" : undefined,
        rel: external ? "noopener noreferrer" : undefined,
        className: "card p-6 block hover:border-its-green transition group",
      };

  return (
    <Tag {...props}>
      <div className="flex items-start justify-between">
        <div className="text-4xl">{icon}</div>
        <span
          className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${
            disabled ? "bg-gray-700 text-gray-400" : "bg-its-green text-black"
          }`}
        >
          {badge}
        </span>
      </div>
      <div className="mt-4 text-xl font-bold flex items-center gap-2">
        {title}
        {external && <span className="text-xs text-gray-500">↗</span>}
      </div>
      <div className="mt-2 text-sm text-gray-400">{desc}</div>
      {!disabled && (
        <div className="mt-4 text-its-green text-sm font-bold group-hover:translate-x-1 transition-transform">
          Abrir →
        </div>
      )}
    </Tag>
  );
}
