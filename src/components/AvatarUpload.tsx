// src/components/AvatarUpload.tsx

"use client";

import { useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Image from "next/image";

interface AvatarUploadProps {
  currentAvatarUrl: string | null | undefined;
  onUpdate: (newAvatarUrl: string) => void; // Callback to update parent state
}

export default function AvatarUpload({ currentAvatarUrl, onUpdate }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);

  // Function to trigger file input click
  const triggerFileInput = () => {
    const fileInput = document.getElementById("avatarInput") as HTMLInputElement;
    fileInput?.click();
  };

  const uploadAvatar = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const supabase = createClientComponentClient(); // Initialize client here
    setError(null);
    setUploading(true);

    try {
      const files = event.target.files;
      if (!files || files.length === 0) {
        throw new Error("Você precisa selecionar uma imagem para fazer upload.");
      }

      const file = files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${Math.random()}.${fileExt}`; // Simple unique path

      // Get user ID for folder structure (optional but good practice)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "public";
      const fullPath = `${userId}/${filePath}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars") // Bucket name
        .upload(fullPath, file);

      if (uploadError) {
        console.error("Upload Error:", uploadError);
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fullPath);

      if (!urlData?.publicUrl) {
          throw new Error("Não foi possível obter a URL pública do avatar.");
      }
      
      const newUrl = urlData.publicUrl;
      setAvatarUrl(newUrl); // Update local preview

      // Update the user's profile in the database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", userId);

      if (updateError) {
        // Optionally try to delete the uploaded file if DB update fails
        await supabase.storage.from("avatars").remove([fullPath]);
        console.error("Profile Update Error:", updateError);
        throw new Error(`Falha ao atualizar perfil: ${updateError.message}`);
      }

      // Call the onUpdate callback to inform the parent component
      onUpdate(newUrl);

    } catch (error: any) {
      setError(error.message || "Ocorreu um erro desconhecido.");
    } finally {
      setUploading(false);
    }
  }, [onUpdate]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Avatar"
            layout="fill"
            objectFit="cover"
            onError={() => setAvatarUrl(null)} // Handle broken image links
          />
        ) : (
          <span className="text-gray-500">Sem foto</span>
        )}
        {/* Overlay for upload button */} 
        <button
          onClick={triggerFileInput}
          disabled={uploading}
          className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-full"
          aria-label="Mudar avatar"
        >
          {uploading ? "Enviando..." : "Mudar"}
        </button>
      </div>

      {/* Hidden file input */} 
      <input
        type="file"
        id="avatarInput"
        accept="image/*"
        onChange={uploadAvatar}
        disabled={uploading}
        style={{ display: "none" }}
      />

      {error && <p className="text-red-500 text-sm">Erro: {error}</p>}
    </div>
  );
}

