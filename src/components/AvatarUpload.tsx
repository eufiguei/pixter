'use client';

import { useState } from 'react';
import Image from 'next/image';

interface AvatarUploadProps {
  driverId: string;
  currentAvatarUrl?: string;
  onAvatarChange: (url: string) => void;
}

export default function AvatarUpload({ 
  driverId, 
  currentAvatarUrl, 
  onAvatarChange 
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || '');
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      return;
    }

    setError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('driverId', driverId);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload do avatar');
      }

      setAvatarUrl(result.avatarUrl);
      onAvatarChange(result.avatarUrl);
    } catch (error) {
      console.error('Erro no upload:', error);
      setError('Falha ao fazer upload da imagem. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-2 border-gray-300">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Avatar do motorista"
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        ) }
      </div>

      <label className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded cursor-pointer transition-colors">
        {isUploading ? 'Enviando...' : 'Escolher Avatar'}
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>

      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
    </div>
  );
}
