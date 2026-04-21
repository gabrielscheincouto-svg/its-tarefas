"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MakrochuiLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/makrochui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErro(d.error || "Usuário ou senha incorretos.");
        setLoading(false);
        return;
      }
      router.push("/makrochui/painel");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #0A0A0A 0%, #1A0808 100%)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10"
        style={{
          background: "#141414",
          border: "1px solid rgba(220,38,38,0.12)",
          boxShadow: "0 30px 60px -12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-sm"
            style={{
              background: "linear-gradient(135deg, #DC2626, #991B1B)",
              boxShadow: "0 6px 20px rgba(220,38,38,0.35)",
              letterSpacing: "1px",
            }}
          >
            MK
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white" style={{ letterSpacing: "-0.5px" }}>
              Makrochui
            </div>
            <div
              className="text-[10px] font-bold uppercase"
              style={{ color: "#DC2626", letterSpacing: "2px" }}
            >
              Cecopel Analytics
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Entrar</h1>
        <p className="text-sm mb-8" style={{ color: "#777" }}>
          Acesse com seu usuário e senha cadastrados.
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              className="block text-[10px] font-bold uppercase mb-2"
              style={{ color: "#999", letterSpacing: "1.2px" }}
            >
              E-mail
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="seu@cecopel.com.br"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-200"
              style={{ background: "#0D0D0D", border: "1.5px solid #2A2A2A" }}
              onFocus={(e) => (e.target.style.borderColor = "#DC2626")}
              onBlur={(e) => (e.target.style.borderColor = "#2A2A2A")}
            />
          </div>
          <div>
            <label
              className="block text-[10px] font-bold uppercase mb-2"
              style={{ color: "#999", letterSpacing: "1.2px" }}
            >
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-200"
              style={{ background: "#0D0D0D", border: "1.5px solid #2A2A2A" }}
              onFocus={(e) => (e.target.style.borderColor = "#DC2626")}
              onBlur={(e) => (e.target.style.borderColor = "#2A2A2A")}
            />
          </div>
          {erro && (
            <div
              className="text-sm p-3 rounded-lg"
              style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)" }}
            >
              {erro}
            </div>
          )}
          <button
            disabled={loading}
            type="submit"
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
            style={{
              background: loading ? "#444" : "linear-gradient(135deg, #DC2626, #B91C1C)",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 6px 20px rgba(220,38,38,0.4)",
              letterSpacing: "0.4px",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div
          className="mt-10 pt-6 text-center text-[10px] font-medium uppercase"
          style={{ borderTop: "1px solid #1E1E1E", color: "#444", letterSpacing: "1.5px" }}
        >
          Makrochui · Cecopel Analytics
        </div>
      </div>
    </main>
  );
}
