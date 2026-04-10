"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await criarCliente(fd);
      if (r.ok) {
        setResultado(r);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <main className="min-h-screen bg-its-dark text-white">
      <header className="bg-its-darker border-b border-its-gray p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/gestao/clientes" className="text-xs text-gray-400 hover:text-its-green">← Clientes</Link>
          <div>
            <div className="text-[10px] text-its-green">Gestão ITS</div>
            <div className="font-bold">Novo cliente</div>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto p-6">
        {resultado ? (
          <div className="card p-8 border-its-green">
            <div className="text-4xl">✅</div>
            <h1 className="mt-4 text-2xl font-bold">Cliente criado com sucesso</h1>
            <p className="text-gray-400 mt-2">
              Compartilhe as credenciais abaixo com o cliente. Ele poderá trocar
              a senha depois do primeiro acesso.
            </p>

            <div className="mt-6 bg-its-darker border border-its-gray rounded-lg p-4 space-y-3 font-mono text-sm">
              <div>
                <div className="text-[10px] text-gray-500 uppercase">URL de acesso</div>
                <div className="text-its-green">(sua URL do Netlify)/login</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">E-mail</div>
                <div>{resultado.email}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Senha inicial</div>
                <div className="text-its-green">{resultado.senha}</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/gestao/clientes" className="btn-green">
                Voltar para a lista
              </Link>
              <button
                onClick={() => { setResultado(null); router.refresh(); }}
                className="text-sm text-gray-400 hover:text-its-green px-4 py-3"
              >
                Cadastrar outro
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Dados do responsável</h1>
              <p className="text-gray-400 text-sm mt-1">
                Quem vai acessar a Área do Cliente. Um login para cada cliente.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nome completo *" name="nome" required />
              <Field label="E-mail de acesso *" name="email" type="email" required />
              <Field
                label="Senha inicial (opcional)"
                name="senha"
                type="text"
                placeholder="Deixe vazio para gerar automática"
              />
            </div>

            <div className="border-t border-its-gray pt-6">
              <h2 className="text-xl font-bold">Dados da empresa</h2>
              <p className="text-gray-400 text-sm mt-1">
                Empresa vinculada a este cliente.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Razão social *" name="razao_social" required />
              <Field label="Nome fantasia" name="nome_fantasia" />
              <Field label="CNPJ *" name="cnpj" placeholder="00.000.000/0001-00" required />
              <div>
                <label className="text-xs text-gray-400">Regime tributário *</label>
                <select
                  name="regime"
                  defaultValue="presumido"
                  required
                  className="mt-1 w-full bg-its-gray border border-its-gray rounded-md px-3 py-2 text-white focus:border-its-green outline-none"
                >
                  <option value="simples">Simples Nacional</option>
                  <option value="presumido">Lucro Presumido</option>
                  <option value="real">Lucro Real</option>
                </select>
              </div>
            </div>

            {erro && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm p-3 rounded">
                {erro}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={pending} className="btn-green">
                {pending ? "Criando..." : "Criar cliente"}
              </button>
              <Link href="/gestao/clientes" className="text-sm text-gray-400 hover:text-its-green px-4 py-3">
                Cancelar
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function Field({ label, name, type = "text", required = false, placeholder = "" }:
  { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full bg-its-gray border border-its-gray rounded-md px-3 py-2 text-white focus:border-its-green outline-none"
      />
    </div>
  );
}
