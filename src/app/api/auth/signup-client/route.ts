// src/app/api/auth/signup-client/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers"; // Import headers to get IP
import { supabaseServer as supabase } from "@/lib/supabase/server"; // Use server client for DB operations

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, celular } = body; // Assuming celular might be passed

    // Validação dos parâmetros
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Get Client IP Address
    const headersList = headers();
    const ip_address = (headersList.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();

    // 2. Create user in Supabase Auth
    // Use the *server* client here for security if preferred, or stick to client if RLS is robust
    // Using server client for consistency with DB operations below
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          tipo: "cliente",
          celular: celular || null, // Include celular if provided
        },
      },
    });

    if (authError) {
      console.error("Erro ao criar usuário:", authError);
      // Handle specific errors like "User already registered"
      if (authError.message.includes("User already registered")) {
         // Check if it's an unconfirmed user
         const { data: existingUser, error: fetchError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1, filter: email });
         if (existingUser && existingUser.users.length > 0 && !existingUser.users[0].email_confirmed_at) {
            // Resend confirmation email
            await supabase.auth.resend({ type: "signup", email });
            return NextResponse.json(
              { error: "Email já registrado, mas não confirmado. Verifique seu email (incluindo spam) para o link de confirmação.", needsConfirmation: true },
              { status: 409 } // Conflict
            );
         }
         return NextResponse.json({ error: "Email já registrado." }, { status: 409 });
      }
      return NextResponse.json(
        { error: authError.message || "Erro ao criar usuário" },
        { status: 400 }
      );
    }

    const userId = authData.user?.id;

    if (!userId) {
        // This case might happen if email confirmation is required and the user object isn't fully populated yet.
        // The previous error handling for "User already registered" might cover this.
        // If email confirmation is enabled, the user needs to confirm before profile creation/login.
        console.log("Signup initiated, user needs to confirm email.");
        return NextResponse.json({
            success: true,
            message: "Cadastro iniciado! Verifique seu email (incluindo spam) para confirmar.",
            needsConfirmation: true
        });
        // Original code proceeded to create profile even without confirmed user, which might be undesirable.
        // return NextResponse.json(
        //   { error: "Falha ao obter ID do usuário após cadastro." },
        //   { status: 500 }
        // );
    }

    // --- Profile Creation (Moved after confirmation or handled by trigger) ---
    // It's generally better to handle profile creation via a database trigger (`handle_new_user`)
    // listening to `auth.users` insertions. This ensures the profile exists even if this API call fails.
    // If not using a trigger, uncomment and adapt the profile creation logic here.
    /*
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        nome: name,
        email,
        celular: celular || null,
        tipo: "cliente",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("Erro ao criar perfil:", profileError);
      // Consider cleanup: delete the auth user if profile creation fails?
      // await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message || "Erro ao criar perfil" },
        { status: 500 }
      );
    }
    */

    // 3. Check for recent temporary payments from this IP
    let associatedChargeId: string | null = null;
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: tempPayments, error: tempPaymentError } = await supabase
            .from("temporary_payments")
            .select("id, charge_id")
            .eq("ip_address", ip_address)
            .gte("created_at", fifteenMinutesAgo)
            .order("created_at", { ascending: false })
            .limit(1);

        if (tempPaymentError) {
            console.error("Error checking temporary payments:", tempPaymentError);
            // Continue signup even if this check fails
        } else if (tempPayments && tempPayments.length > 0) {
            associatedChargeId = tempPayments[0].charge_id;
            const tempPaymentId = tempPayments[0].id;
            console.log(`Found recent payment ${associatedChargeId} for IP ${ip_address}. Associating with user ${userId}.`);

            // 4. Associate payment with user (Example: update profile)
            // Adjust this based on your actual schema (e.g., add to a payments array or related table)
            const { error: updateProfileError } = await supabase
                .from("profiles")
                .update({ last_associated_charge_id: associatedChargeId }) // Example field
                .eq("id", userId);

            if (updateProfileError) {
                console.error("Error associating charge ID with profile:", updateProfileError);
            } else {
                // 5. Delete the temporary payment entry after successful association
                const { error: deleteError } = await supabase
                    .from("temporary_payments")
                    .delete()
                    .eq("id", tempPaymentId);
                if (deleteError) {
                    console.error("Error deleting temporary payment entry:", deleteError);
                }
            }
        }
    } catch (e) {
        console.error("Exception during temporary payment check:", e);
    }

    // --- Login (Removed - Supabase handles session after successful signUp confirmation) ---
    // If email confirmation is required, the user logs in *after* clicking the confirmation link.
    // If auto-confirmation is enabled, Supabase might return a session directly in the signUp response.
    /*
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (sessionError) {
      console.error("Erro ao fazer login pós-cadastro:", sessionError);
      // Don't fail the whole signup, maybe just return success without session
    }
    */

    // Return success, indicating user needs to check email if confirmation is enabled
    return NextResponse.json({
      success: true,
      message: "Cadastro iniciado! Verifique seu email (incluindo spam) para confirmar.",
      userId: userId,
      associatedChargeId: associatedChargeId, // Optionally inform client
      needsConfirmation: true // Adjust based on your Supabase email settings
    });

  } catch (error: any) {
    console.error("Erro geral no signup-client:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}

