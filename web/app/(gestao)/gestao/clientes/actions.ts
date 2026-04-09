"use server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function guardAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("não autenticado");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "internal"].includes(profile.role)) {
    throw new Error("sem permissão");
  }
}

export type NovoClienteResult =
  | { ok: true; email: string; senha: string; empresaId: string }
  | { ok: false; erro: string };

export async function criarCliente(formData: FormData): Promise<NovoClienteResult> {
  try {
    await guardAdmin();

    const nome = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const senhaInformada = String(formData.get("senha") || "").trim();
    const razaoSocial = String(formData.get("razao_social") || "").trim();
    const nomeFantasia = String(formData.get("nome_fantasia") || "").trim();
    const cnpj = String(formData.get("cnpj") || "").trim();
    const regime = String(formData.get("regime") || "presumido");

    if (!nome || !email || !razaoSocial || !cnpj) {
      return { ok: false, erro: "Preencha nome, e-mail, razão social e CNPJ." };
    }

    const senha = senhaInformada || gerarSenha();

    const admin = createAdminClient();

    // 1. Cria usuário no Auth
    const { data: userCreated, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, role: "cliente" },
    });
    if (authErr || !userCreated.user) {
      return { ok: false, erro: "Erro ao criar usuário: " + (authErr?.message || "desconhecido") };
    }

    // 2. Garante profile como cliente
    await admin.from("profiles").update({ nome, role: "cliente" }).eq("id", userCreated.user.id);

    // 3. Cria empresa vinculada
    const { data: empresa, error: empErr } = await admin
      .from("empresas")
      .insert({
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia || null,
        cnpj,
        regime,
        owner_user_id: userCreated.user.id,
        ativo: true,
      })
      .select("id")
      .single();

    if (empErr) {
      await admin.auth.admin.deleteUser(userCreated.user.id);
      return { ok: false, erro: "Erro ao criar empresa: " + empErr.message };
    }

    // 4. Checklist padrão de documentos
    const docsDefault = [
      { codigo: "SPED_FISCAL", nome: "SPED Fiscal", ordem: 1 },
      { codigo: "SPED_CONTRIB", nome: "SPED Contribuições", ordem: 2 },
      { codigo: "BALANCETE", nome: "Balancete do mês", ordem: 3 },
      { codigo: "DCTFWEB", nome: "DCTFWeb", ordem: 4 },
      { codigo: "EFD_REINF", nome: "EFD-Reinf", ordem: 5 },
      { codigo: "ESOCIAL", nome: "eSocial", ordem: 6 },
    ];
    await admin.from("empresa_docs_config").insert(
      docsDefault.map((d) => ({ ...d, empresa_id: empresa.id, obrigatorio: true }))
    );

    revalidatePath("/gestao/clientes");
    return { ok: true, email, senha, empresaId: empresa.id };
  } catch (e: any) {
    return { ok: false, erro: e?.message || "Erro inesperado" };
  }
}

function gerarSenha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "!";
}

export async function excluirCliente(userId: string) {
  await guardAdmin();
  const admin = createAdminClient();
  await admin.from("empresas").delete().eq("owner_user_id", userId);
  await admin.auth.admin.deleteUser(userId);
  revalidatePath("/gestao/clientes");
}
