import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { excluirCliente } from "./actions";

export default async function ClientesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, nome").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "internal"].includes(profile.role)) redirect("/cliente");

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, regime, owner_user_id, ativo, profiles!empresas_owner_user_id_fkey(email, nome)")
    .order("razao_social");

  return (
    <main className="min-h-screen bg-its-dark text-white">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/gestao" className="text-xs text-gray-400 hover:text-its-green">← Gestão</Link>
            <div>
              <div className="text-[10px] text-its-green">Gestão ITS</div>
              <div className="font-bold">Clientes e Empresas</div>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Clientes cadastrados</h1>
            <p className="text-gray-400 mt-1">{empresas?.length || 0} empresas ativas</p>
          </div>
          <Link href="/gestao/clientes/novo" className="btn-green">
            + Novo cliente
          </Link>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-its-darker text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-left px-4 py-3">Regime</th>
                <th className="text-left px-4 py-3">Titular</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas?.map((e: any) => (
                <tr key={e.id} className="border-t border-its-gray hover:bg-its-darker/50">
                  <td className="px-4 py-3">
                    <div className="font-bold">{e.razao_social}</div>
                    {e.nome_fantasia && (
                      <div className="text-xs text-gray-500">{e.nome_fantasia}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{e.cnpj}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-its-gray px-2 py-1 rounded uppercase">
                      {e.regime}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{e.profiles?.nome || "—"}</div>
                    <div className="text-[10px] text-gray-500">{e.profiles?.email || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={async () => {
                      "use server";
                      if (e.owner_user_id) await excluirCliente(e.owner_user_id);
                    }}>
                      <button className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!empresas || empresas.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-12">
                    Nenhum cliente cadastrado ainda. Clique em <b className="text-its-green">Novo cliente</b>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
