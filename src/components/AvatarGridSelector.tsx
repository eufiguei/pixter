// src/components/AvatarGridSelector.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

interface AvatarGridSelectorProps {
  currentAvatarUrl?: string | null;
  onSelect: (avatarUrl: string) => void;
  loading?: boolean;
}

const AVATAR_PATHS = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`);

export default function AvatarGridSelector({
  currentAvatarUrl,
  onSelect,
  loading = false,
}: AvatarGridSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null | undefined>(currentAvatarUrl);

  const handleSelect = (path: string) => {
    if (loading) return; // Prevent selection while loading/saving
    setSelectedAvatar(path);
    onSelect(path);
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Selecione seu Avatar</label>
      <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
        {AVATAR_PATHS.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => handleSelect(path)}
            disabled={loading}
            className={`relative rounded-full overflow-hidden border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${selectedAvatar === path ? "border-indigo-500" : "border-transparent hover:border-gray-300"}`}
          >
            <Image
              src={path}
              alt={`Avatar ${path.split("_")[1].split(".")[0]}`}
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
            {selectedAvatar === path && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

