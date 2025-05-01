// src/components/AvatarUpload.tsx

"use client";

import { useState, useCallback, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // Use Auth Helper client
import Image from "next/image";
import type { User } from "@supabase/supabase-js";

interface AvatarUploadProps {
  currentAvatarUrl: string | null | undefined;
  onUpdate: (newAvatarUrl: string) => void; // Callback to update parent state
  userId: string | undefined; // Pass user ID as prop
}

export default function AvatarUpload({ currentAvatarUrl, onUpdate, userId }: AvatarUploadProps) {
  const supabase = createClientComponentClient(); // Initialize client
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);

  // Update local avatar URL if the prop changes
  useEffect(() => {
    setAvatarUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl]);

  // Function to trigger file input click
  const triggerFileInput = () => {
    const fileInput = document.getElementById("avatarInput") as HTMLInputElement;
    fileInput?.click();
  };

  const uploadAvatar = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploading(true);

    if (!userId) {
        setError("Usuário não autenticado.");
        setUploading(false);
        return;
    }

    try {
      const files = event.target.files;
      if (!files || files.length === 0) {
        throw new Error("Você precisa selecionar uma imagem para fazer upload.");
      }

      const file = files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`; // Use userId and timestamp for path

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars") // Bucket name
        .upload(filePath, file, { upsert: true }); // Use upsert to overwrite if needed

      if (uploadError) {
        console.error("Upload Error:", uploadError);
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
          throw new Error("Não foi possível obter a URL pública do avatar.");
      }

      const newUrl = urlData.publicUrl;
      // Construct URL with a timestamp to bypass cache if needed
      const newUrlWithTimestamp = `${newUrl}?t=${new Date().getTime()}`;

      setAvatarUrl(newUrlWithTimestamp); // Update local preview immediately

      // Update the user's profile in the database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl }) // Store the base URL without timestamp
        .eq("id", userId);

      if (updateError) {
        // Optionally try to delete the uploaded file if DB update fails
        await supabase.storage.from("avatars").remove([filePath]);
        console.error("Profile Update Error:", updateError);
        setAvatarUrl(currentAvatarUrl || null); // Revert preview on error
        throw new Error(`Falha ao atualizar perfil: ${updateError.message}`);
      }

      // Call the onUpdate callback to inform the parent component
      onUpdate(newUrl); // Pass the base URL

    } catch (error: any) {
      setError(error.message || "Ocorreu um erro desconhecido.");
      // Optionally revert preview on error
      // setAvatarUrl(currentAvatarUrl || null);
    } finally {
      setUploading(false);
    }
  }, [supabase, userId, onUpdate, currentAvatarUrl]); // Add dependencies

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-gray-300">
        {avatarUrl ? (
          <Image
            key={avatarUrl} // Add key to force re-render on URL change
            src={avatarUrl}
            alt="Avatar"
            layout="fill"
            objectFit="cover"
            priority // Prioritize loading the avatar image
            onError={() => {
                console.error(`Failed to load image: ${avatarUrl}`);
                setAvatarUrl(null); // Reset if image fails to load
            }}
          />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        )}
        {/* Overlay for upload button */} 
        <button
          onClick={triggerFileInput}
          disabled={uploading || !userId} // Disable if no user or uploading
          className={`absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 flex items-center justify-center text-white text-sm font-medium opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-full ${!userId ? 'cursor-not-allowed' : ''}`}
          aria-label="Mudar avatar"
        >
          {uploading ? "Enviando..." : "Mudar"}
        </button>
      </div>

      {/* Hidden file input */} 
      <input
        type="file"
        id="avatarInput"
        accept="image/png, image/jpeg, image/webp"
        onChange={uploadAvatar}
        disabled={uploading || !userId}
        style={{ display: "none" }}
      />

      {error && <p className="text-red-500 text-sm mt-2">Erro: {error}</p>}
    </div>
  );
}

