
// src/components/NavBar.tsx
'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function NavBar(){
  const [open,setOpen] = useState(false);
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white shadow">
      <Link href="/" className="flex items-center space-x-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#7c3aed">
          <rect width="24" height="24" rx="4" />
          <text x="12" y="17" fontSize="13" textAnchor="middle" fill="white">P</text>
        </svg>
        <span className="font-bold text-xl">Pixter</span>
      </Link>

      <div className="relative">
        <button onClick={()=>setOpen(!open)} className="text-sm font-medium hover:text-purple-600">
          Entrar / Cadastrar
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow">
            <Link href="/login" className="block px-4 py-2 hover:bg-gray-50">Acessar conta Cliente</Link>
            <Link href="/motorista/login" className="block px-4 py-2 hover:bg-gray-50">Acessar conta Motorista</Link>
            <div className="border-t"/>
            <Link href="/cadastro" className="block px-4 py-2 hover:bg-gray-50">Criar conta Cliente</Link>
            <Link href="/motorista/cadastro" className="block px-4 py-2 hover:bg-gray-50">Criar conta Motorista</Link>
          </div>
        )}
      </div>
    </header>
  )
}
