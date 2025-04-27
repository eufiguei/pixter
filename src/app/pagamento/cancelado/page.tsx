'use client';

import Link from 'next/link';

export default function PagamentoCancelado() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Pagamento cancelado</h2>
        <p className="text-gray-600 mb-6">
          O processo de pagamento foi cancelado. Nenhum valor foi cobrado.
        </p>
        
        <div className="flex flex-col space-y-3">
          <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
            Voltar para a página inicial
          </Link>
          <Link href="/pagamento" className="text-blue-500 hover:text-blue-600">
            Tentar novamente
          </Link>
        </div>
      </div>
    </main>
  );
}
