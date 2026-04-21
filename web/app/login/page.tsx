"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    const isMakrochui = login.toLowerCase().endsWith("@makrochui.com");

    /* ââ Makrochui: @makrochui.com ââ */
    if (isMakrochui) {
      const username = login.split("@")[0].toLowerCase();
      try {
        const res = await fetch("/api/makrochui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", username, password: senha }),
        });
        if (!res.ok) {
          setErro("UsuÃ¡rio ou senha incorretos.");
          setLoading(false);
          return;
        }
        router.push("/makrochui/painel");
        return;
      } catch {
        setErro("Erro ao conectar. Tente novamente.");
        setLoading(false);
        return;
      }
    }

    /* ââ ITS: qualquer outro e-mail (Supabase Auth) ââ */
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: login, password: senha });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile && ["admin", "internal"].includes(profile.role)) {
        router.push("/gestao");
      } else if (profile && profile.role === "contador") {
        router.push("/contador");
      } else {
        router.push("/cliente");
      }
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-its-dark flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="text-xs text-gray-500 hover:text-its-green">â Voltar</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-its-green"
            style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
          <div>
            <div className="font-bold">ITS</div>
            <div className="text-[10px] text-its-green -mt-1">Tax and Corporate</div>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold">Ãrea do Cliente</h1>
        <p className="text-sm text-gray-400">Acesse com seu e-mail cadastrado.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400">E-mail</label>
            <input type="email" value={login} onChange={(e) => setLogin(e.target.value)}
              required placeholder="seu@email.com"
              className="mt-1 w-full bg-its-gray border border-its-gray rounded-md px-3 py-2 text-white focus:outline-none focus:border-its-green" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              required className="mt-1 w-full bg-its-gray border border-its-gray rounded-md px-3 py-2 text-white focus:outline-none focus:border-its-green" />
          </div>
          {erro && <div className="text-sm text-red-400">{erro}</div>}
          <button disabled={loading} type="submit" className="btn-green w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-its-gray text-center">
          <div className="text-xs text-gray-500">Ã da equipe ITS?</div>
          <Link href="/gestao"
            className="text-sm text-its-green font-bold hover:underline">
            Acessar espaÃ§o do escritÃ³rio â
          </Link>
        </div>
      </div>
    </main>
  );
}
