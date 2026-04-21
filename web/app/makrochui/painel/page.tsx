"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserSession {
  id: number;
  name: string;
  department: string;
  role: string;
  email?: string;
  loja?: string;
}

export default function MakrochuiPainel() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/makrochui?action=me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        router.push("/makrochui");
      });
  }, [router]);

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0A0A0A" }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center text-white font-black text-lg"
            style={{
              background: "linear-gradient(135deg, #DC2626, #991B1B)",
              boxShadow: "0 6px 20px rgba(220,38,38,0.35)",
            }}
          >
            MK
          </div>
          <div className="text-white font-bold text-lg">Carregando...</div>
          <div className="text-gray-500 text-sm mt-1">Cecopel Analytics</div>
        </div>
      </main>
    );
  }

  return (
    <iframe
      src="/makrochui/painel.html"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
        position: "fixed",
        top: 0,
        left: 0,
      }}
      title="Makrochui - Cecopel Analytics"
    />
  );
}
