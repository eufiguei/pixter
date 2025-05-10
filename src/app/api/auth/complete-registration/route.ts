// src/app/api/auth/complete-registration/route.ts
import { NextResponse } from "next/server";
import {
  createDriverWithPhone,
  formatPhoneNumber,
  supabaseServer, // Import server client for storage and profile updates
} from "@/lib/supabase/client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Extract form data
    const phone = formData.get("phone") as string;
    const countryCode = formData.get("countryCode") as string;
    const nome = formData.get("nome") as string;
    const cpf = formData.get("cpf") as string;
    const profissao = formData.get("profissao") as string;
    const dataNascimento = formData.get("dataNascimento") as string;
    const avatarIndex = formData.get("avatarIndex") as string;
    const email = formData.get("email") as string | null;
    const selfieFile = formData.get("selfie") as File | null;

    // --- Basic Validation ---
    if (!phone || !nome || !cpf || !profissao || !dataNascimento || !avatarIndex) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // --- Prepare User Data for Creation ---
    const userData: any = {
      nome,
      cpf,
      profissao,
      data_nascimento: dataNascimento,
      // avatar_index: Number(avatarIndex), // We'll set avatar_url later
    };
    if (email && email.trim() !== "") userData.email = email.trim();

    // --- Create User and Initial Profile --- 
    // (createDriverWithPhone handles auth user creation and basic profile upsert)
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    const { data: creationData, error: creationError } = await createDriverWithPhone(
      formattedPhone,
      userData
    );

    if (creationError) {
      console.error("Error during createDriverWithPhone:", creationError.message);
      const msg = creationError.message;
      // Map specific errors to user-friendly messages if needed
      const userFriendlyError = 
        msg === "phone_exists" ? "Este número de telefone já está cadastrado."
        : msg === "email_exists" ? "Este email já está cadastrado."
        : "Erro ao criar usuário.";
      const status = msg === "phone_exists" || msg === "email_exists" ? 409 : 500;
      return NextResponse.json({ error: userFriendlyError }, { status });
    }

    const userId = creationData?.user?.id;
    if (!userId) {
      console.error("User creation succeeded but no user ID returned.");
      return NextResponse.json(
        { error: "Falha ao obter ID do usuário após criação." },
        { status: 500 }
      );
    }

    // --- Handle Selfie Upload and Avatar URL --- 
    let selfieUrl: string | null = null;
    let avatarUrl: string | null = null;
    const updates: { selfie_url?: string; avatar_url?: string } = {};

    // 1. Upload Selfie
    if (selfieFile) {
      const selfiePath = `public/selfies/${userId}/${selfieFile.name || "selfie.jpg"}`;
      const { error: uploadError } = await supabaseServer.storage
        .from("selfies") // Ensure 'selfies' bucket exists and has appropriate policies
        .upload(selfiePath, selfieFile, { upsert: true });

      if (uploadError) {
        console.error(`Error uploading selfie for user ${userId}:`, uploadError);
        // Decide if this is a critical error. Maybe proceed without selfie?
        // For now, we'll log it but continue.
      } else {
        const { data: urlData } = supabaseServer.storage
          .from("selfies")
          .getPublicUrl(selfiePath);
        selfieUrl = urlData?.publicUrl;
        if (selfieUrl) {
            updates.selfie_url = selfieUrl;
        }
        console.log(`Selfie uploaded for ${userId} to ${selfieUrl}`);
      }
    }

    // 2. Determine Avatar URL (using static paths)
    const index = Number(avatarIndex);
    if (!isNaN(index) && index >= 0 && index < 9) { // Assuming 9 avatars (0-8)
      avatarUrl = `/images/avatars/avatar_${index + 1}.png`;
      updates.avatar_url = avatarUrl;
      console.log(`Avatar URL set for ${userId} to ${avatarUrl}`);
    } else {
        console.warn(`Invalid avatarIndex received: ${avatarIndex} for user ${userId}`);
    }

    // 3. Update Profile with URLs
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseServer
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        console.error(`Error updating profile URLs for user ${userId}:`, updateError);
        // Log error, but registration is mostly complete.
      }
    }

    // --- Success --- 
    console.log(`Registration completed for user ${userId}`);
    return NextResponse.json({ userId }, { status: 200 });

  } catch (err: any) {
    console.error("Unhandled error in complete-registration:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

