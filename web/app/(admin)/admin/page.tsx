import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=admin");

  const { data: profile } = await supabase.from("profiles").select("role, nome").eq("id", user.id).maybeSingle();
  if (profile && !["admin", "internal"].includes(profile.role)) redirect("/cliente");

  const { data: empresas } = await supabase.from("empresas").select("id, razao_social, cnpj, regime");
  const { data: contadores } = await supabase.from("contadores").select("id, razao_social, cnpj");
  const { data: processos } = await supabase
    .from("processos_mensais")
    .select("id, empresa_id, competencia, status, economia_gerada, empresas(razao_social)")
    .order("competencia", { ascending: false })
    .limit(10);

  return (
    <main className="min-h-screen bg-its-dark text-white pb-24">
      <header className="bg-its-darker border-b border-its-gray p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] text-its-green">Gestão ITS</div>
            <div className="font-bold">Painel do gestor</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <Stat label="Empresas ativas" value={empresas?.length || 0} />
          <Stat label="Contadores" value={contadores?.length || 0} />
          <Stat label="Economia total gerada (acum.)" value={
            "R$ " + (processos?.reduce((s, p) => s + Number(p.economia_gerada || 0), 0) || 0)
              .toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          } />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold">Processo mensal — últimos</div>
            <Link href="/admin/processo" className="text-xs text-its-green">Ver todos →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="py-2">Empresa</th>
                <th>Competência</th>
                <th>Status</th>
                <th className="text-right">Economia</th>
              </tr>
            </thead>
            <tbody>
              {processos?.map((p: any) => (
                <tr key={p.id} className="border-t border-its-gray">
                  <td className="py-2">{p.empresas?.razao_social}</td>
                  <td>{new Date(p.competencia).toLocaleDateString("pt-BR")}</td>
                  <td><StatusBadge s={p.status} /></td>
                  <td className="text-right text-its-green font-bold">
                    R$ {Number(p.economia_gerada || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/admin/empresas" className="card p-6 hover:border-its-green">
            <div className="text-its-green text-xs font-bold">GERENCIAR →</div>
            <div className="text-xl font-bold mt-1">Empresas</div>
            <div className="text-sm text-gray-400">Criar, editar e configurar checklist.</div>
          </Link>
          <Link href="/admin/contadores" className="card p-6 hover:border-its-green">
            <div className="text-its-green text-xs font-bold">GERENCIAR →</div>
            <div className="text-xl font-bold mt-1">Contadores</div>
            <div className="text-sm text-gray-400">Cadastrar escritórios e vincular empresas.</div>
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-6">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-3xl font-bold text-its-green mt-1">{value}</div>
    </div>
  );
}
function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    pendente: "bg-gray-700", em_andamento: "bg-yellow-700",
    concluido: "bg-green-700", publicado: "bg-its-green text-black"
  };
  return <span className={`px-2 py-1 rounded text-[10px] font-bold ${map[s] || "bg-gray-700"}`}>{s}</span>;
}
