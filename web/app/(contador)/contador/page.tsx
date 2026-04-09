import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function ContadorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?area=contador");

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razao_social, cnpj, regime")
    .eq("ativo", true);

  return (
    <main className="min-h-screen bg-its-dark text-white pb-24">
      <header className="bg-its-darker border-b border-its-gray p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] text-its-green">Área do Contador</div>
            <div className="font-bold">Envio mensal de documentos</div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-its-green">Sair</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="card p-6">
          <div className="font-bold mb-4">Empresas sob sua responsabilidade</div>
          <div className="space-y-2">
            {empresas?.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between border-b border-its-gray py-3">
                <div>
                  <div className="font-bold">{e.razao_social}</div>
                  <div className="text-xs text-gray-400">{e.cnpj} · {e.regime}</div>
                </div>
                <a href={`/contador/empresa/${e.id}`} className="btn-green text-sm">Enviar docs</a>
              </div>
            ))}
            {(!empresas || empresas.length === 0) && (
              <div className="text-sm text-gray-400">Nenhuma empresa vinculada.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
