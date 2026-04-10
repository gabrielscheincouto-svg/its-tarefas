/**
 * Seed do admin master — rodar UMA VEZ após o primeiro deploy.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/seed-admin.ts
 *
 * Ou cole as variáveis no .env.local e rode:
 *   npx tsx scripts/seed-admin.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ADMIN_EMAIL = "gabrielscouto@hotmail.com";
const ADMIN_SENHA = "Its@2026Master!";
const ADMIN_NOME = "Gabriel Couto";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("🔄 Criando usuário admin...");

  // 1. Cria usuário no Auth
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_SENHA,
    email_confirm: true,
    user_metadata: { nome: ADMIN_NOME, role: "admin" },
  });

  if (error) {
    if (error.message.includes("already been registered")) {
      console.log("⚠️  Usuário já existe. Atualizando role para admin...");
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users?.users?.find((u) => u.email === ADMIN_EMAIL);
      if (existing) {
        await admin
          .from("profiles")
          .update({ nome: ADMIN_NOME, role: "admin" })
          .eq("id", existing.id);
        console.log("✅ Role atualizada para admin!");
        console.log(`📧 Email: ${ADMIN_EMAIL}`);
        console.log(`🔑 Senha: (a que você já definiu antes)`);
      }
      return;
    }
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }

  const userId = data.user!.id;

  // 2. Atualiza profile como admin
  await admin
    .from("profiles")
    .update({ nome: ADMIN_NOME, role: "admin" })
    .eq("id", userId);

  console.log("✅ Admin master criado com sucesso!");
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("  📧 Email:  ", ADMIN_EMAIL);
  console.log("  🔑 Senha:  ", ADMIN_SENHA);
  console.log("  👤 Role:    admin");
  console.log("═══════════════════════════════════════");
  console.log("");
  console.log("⚠️  Troque a senha no primeiro acesso!");
}

main().catch(console.error);
