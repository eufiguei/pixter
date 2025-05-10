// src/app/api/motorista/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { supabaseServer } from "@/lib/supabase/client";

// Define the list of valid avatar paths for validation
const VALID_AVATAR_PATHS = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`);

export async function GET(request: Request) {
  // 1) Validate via NextAuth
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // 2) Fetch the profile from Supabase
  const userId = session.user.id;
  const { data: profile, error } = await supabaseServer
    .from("profiles")
    .select("id, nome, email, celular, tipo, profissao, stripe_account_id, stripe_account_status, avatar_url")
    .eq("id", userId)
    .eq("tipo", "motorista")
    .single();

  if (error) {
    // If no profile exists yet, check by phone or email before creating
    if (error.code === 'PGRST116') {
      console.log("Profile not found by ID, checking by phone/email before creating");
      
      // Get phone number from user if available (added as custom field in NextAuth)
      const userPhone = (session.user as any).phone || '';
      
      // First check if there's already a profile with the same email/phone
      let existingProfile = null;
      
      if (session.user.email) {
        const { data: emailProfile } = await supabaseServer
          .from("profiles")
          .select("*")
          .eq("email", session.user.email)
          .maybeSingle();
          
        if (emailProfile) {
          console.log("Found existing profile by email:", emailProfile.id);
          existingProfile = emailProfile;
        }
      }
      
      // Check if profile exists by phone number
      
      if (!existingProfile && userPhone) {
        // Get phone with and without plus for checking
        const phoneWithPlus = userPhone.startsWith("+") ? userPhone : `+${userPhone}`;
        const phoneWithoutPlus = userPhone.startsWith("+") ? userPhone.substring(1) : userPhone;
        
        const { data: phoneProfile } = await supabaseServer
          .from("profiles")
          .select("*")
          .or(`celular.eq.${phoneWithPlus},celular.eq.${phoneWithoutPlus}`)
          .maybeSingle();
          
        if (phoneProfile) {
          console.log("Found existing profile by phone:", phoneProfile.id);
          existingProfile = phoneProfile;
        }
      }
      
      // If we found an existing profile, just return it (no need to update IDs)
      if (existingProfile) {
        console.log("Found existing profile, returning it directly");
        return NextResponse.json(existingProfile);
      }
      
      // If no existing profile found, create a new one
      console.log("No existing profile found, creating new one");
      
      const { data: newProfile, error: createError } = await supabaseServer
        .from("profiles")
        .insert({
          id: userId,
          tipo: "motorista",
          nome: session.user.name || "Motorista",
          email: session.user.email,
          celular: userPhone, // Use properly typed variable
          stripe_account_status: "unconnected"
        })
        .select()
        .single();

      if (createError) {
        console.error("Erro ao criar perfil do motorista:", createError);
        return NextResponse.json(
          { error: "Erro ao criar perfil do motorista" },
          { status: 500 }
        );
      }
      
      return NextResponse.json(newProfile);
    }

    console.error("Erro ao buscar perfil do motorista:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil do motorista" },
      { status: 500 }
    );
  }

  // 3) Return it
  return NextResponse.json(profile);
}

// PUT handler to update the driver’s info
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.tipo !== "motorista") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const userId = session.user.id;
  let updates: { [key: string]: any };
  try {
      updates = await request.json();
  } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Sanitize/validate updates
  const allowedUpdates: { [key: string]: any } = {};
  if (updates.hasOwnProperty("nome")) {
      allowedUpdates.nome = updates.nome;
  }
  if (updates.hasOwnProperty("profissao")) {
      allowedUpdates.profissao = updates.profissao;
  }
  // Validate and add avatar_url if present
  if (updates.hasOwnProperty("avatar_url")) {
      if (updates.avatar_url === null || VALID_AVATAR_PATHS.includes(updates.avatar_url)) {
          allowedUpdates.avatar_url = updates.avatar_url;
      } else {
          // Optional: Return an error if the avatar_url is invalid
          // console.warn(`Invalid avatar_url provided: ${updates.avatar_url}`);
          // return NextResponse.json({ error: "URL de avatar inválida." }, { status: 400 });
          // Or simply ignore the invalid avatar_url update
      }
  }

  // Ensure there are updates to perform
  if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo válido para atualização fornecido." }, { status: 400 });
  }

  allowedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("profiles")
    .update(allowedUpdates)
    .eq("id", userId)
    .eq("tipo", "motorista")
    .select("id, nome, email, celular, tipo, profissao, stripe_account_id, stripe_account_status, avatar_url") // Return updated profile
    .single();

  if (error) {
    console.error("Erro ao atualizar perfil do motorista:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil do motorista" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Perfil atualizado com sucesso",
    profile: data, // Return the updated profile data
  });
}

