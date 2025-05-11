// src/app/[phoneNumber]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { signOut, useSession } from "next-auth/react";
// Corrected: Ensure all icons including Settings are from lucide-react
import { LogIn, LogOut, User, Phone, Settings } from "lucide-react"; 

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

const defaultAvatar = "/images/avatars/avatar_1.png"; 

const formatPhoneNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("55") ? digits.substring(2) : digits;
  if (nationalNumber.length >= 10) {
    const areaCode = nationalNumber.substring(0, 2);
    const number = nationalNumber.substring(2);
    if (nationalNumber.length === 11) { 
        return `(${areaCode}) ${number.substring(0,5)}-${number.substring(5)}`;
    }
    return `(${areaCode}) ${number.substring(0,4)}-${number.substring(4)}`; 
  }
  return nationalNumber;
};

function PaymentForm({ onSuccess, onError, amount }: { onSuccess: (paymentIntent: any) => void; onError: (error: any) => void; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError("");

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pagamento/sucesso?amount=${amount}`,
        },
        redirect: "if_required",
      });

      if (error) {
        setPaymentError(error.message || "Ocorreu um erro no pagamento.");
        onError(error);
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess(paymentIntent);
      }
    } catch (err: any) {
      setPaymentError("Erro inesperado ao processar o pagamento.");
      onError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {paymentError}
        </div>
      )}
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-150"
      >
        {isProcessing ? "Processando..." : `Pagar R$ ${amount.toFixed(2).replace(".", ",")}`}
      </button>
      <p className="text-center text-xs text-gray-500 mt-2">
        Pagamento seguro processado via Stripe.
      </p>
    </form>
  );
}

export default function VendedorPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { data: session, status } = useSession();
  const isVendedor = session?.user?.tipo === "vendedor";

  const { phoneNumber } = params;
  const [amount, setAmount] = useState<number>(0);
  const [rawAmountDigits, setRawAmountDigits] = useState("");
  const [vendedorInfo, setVendedorInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const formatBRL = (digits: string): string => {
    if (!digits) return "R$ 0,00";
    const num = parseInt(digits, 10);
    if (isNaN(num) || num === 0) return "R$ 0,00";
    const reais = Math.floor(num / 100);
    const centavos = (num % 100).toString().padStart(2, "0");
    const formattedReais = reais.toLocaleString("pt-BR");
    return `R$ ${formattedReais},${centavos}`;
  };

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D/g, "");
    setRawAmountDigits(digits.slice(0, 9)); 
  };

  useEffect(() => {
    fetch(`/api/public/driver-info/${phoneNumber}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setVendedorInfo)
      .catch((err: any) => setError(err.error || err.message || "Vendedor não encontrado."))
      .finally(() => setLoadingInfo(false));
  }, [phoneNumber]);

  useEffect(() => {
    clearTimeout(debounceRef.current!);
    const num = parseInt(rawAmountDigits || "0", 10);
    const numericAmount = num / 100;
    setAmount(numericAmount);

    if (numericAmount >= 0.01) {
      debounceRef.current = setTimeout(async () => {
        setError("");
        try {
          const res = await fetch("/api/stripe/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: num, 
              driverPhoneNumber: phoneNumber, 
            }),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "Erro ao preparar pagamento.");
          }
          const { clientSecret: newClientSecret } = await res.json();
          setClientSecret(newClientSecret);
        } catch (err: any) {
          setError(err.message || "Erro ao iniciar pagamento.");
          setClientSecret("");
        }
      }, 500);
    } else {
      setClientSecret("");
      if (!rawAmountDigits) setError(""); 
    }
  }, [rawAmountDigits, phoneNumber]);

  const handleSuccess = (pi: any) => {
    setPaymentSuccess(true);
    setPaymentDetails(pi);
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-purple-600 rounded-full"></div>
      </div>
    );
  }

  if (error && !vendedorInfo?.profile) { 
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="p-8 bg-white rounded-lg shadow-xl text-center max-w-md">
          <h1 className="text-xl font-semibold text-red-600 mb-3">Erro</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium hover:underline">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }
  
  const profile = vendedorInfo?.profile;
  if (!profile) { 
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
              <div className="p-8 bg-white rounded-lg shadow-xl text-center max-w-md">
                  <h1 className="text-xl font-semibold text-red-600 mb-3">Erro</h1>
                  <p className="text-gray-700 mb-6">Informações do vendedor não encontradas.</p>
                  <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium hover:underline">
                      Voltar para o início
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow flex flex-col items-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
          
          <div className="flex justify-end w-full -mt-2 -mr-2 sm:mt-0 sm:mr-0">
            <div className="space-x-3 text-xs sm:text-sm">
              {!session ? (
                <>
                  <Link href={`/login?callbackUrl=/${phoneNumber}`} className="font-medium text-purple-600 hover:text-purple-500">
                    Entrar
                  </Link>
                  <Link href={`/cadastro?callbackUrl=/${phoneNumber}`} className="font-medium text-purple-600 hover:text-purple-500">
                    Criar Conta
                  </Link>
                </>
              ) : isVendedor && session.user?.celular?.replace(/\D/g, "") === phoneNumber.replace(/\D/g, "") ? (
                <Link href="/vendedor/dashboard/overview" className="font-medium text-purple-600 hover:text-purple-500 flex items-center">
                  <Settings className="w-4 h-4 mr-1" /> Painel
                </Link>
              ) : (
                <div className="flex items-center space-x-3">
                  {session.user?.name && <span className="text-gray-700">Olá, {session.user.name.split(" ")[0]}</span>}
                  <button
                    onClick={async () => {
                      await signOut({ redirect: false });
                      window.location.reload();
                    }}
                    className="font-medium text-purple-600 hover:text-purple-500 flex items-center"
                  >
                    <LogOut className="w-4 h-4 mr-1" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center text-center space-y-2 pt-2">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden relative shadow-md">
              <Image
                src={profile.avatar_url || defaultAvatar}
                alt={profile.nome || "Avatar do Vendedor"}
                fill
                sizes="(max-width: 640px) 80px, 96px"
                style={{ objectFit: "cover" }}
                onError={(e) => { e.currentTarget.src = defaultAvatar; }} 
                priority
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{profile.nome || "Vendedor"}</h1>
            {profile.profissao && (
              <p className="text-xs sm:text-sm text-gray-500">{profile.profissao}</p>
            )}
            {profile.celular && (
              <a
                href={`tel:${profile.celular.replace(/\D/g, "")}`}
                className="text-xs sm:text-sm text-gray-500 hover:text-purple-600 flex items-center justify-center gap-1 transition-colors"
              >
                <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                {formatPhoneNumber(profile.celular)}
              </a>
            )}
          </div>

          <div className="flex items-center justify-center pt-2 pb-4">
            <Link href="/" className="flex items-center space-x-2" aria-label="Pixter Home">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-600 rounded-lg flex items-center justify-center shadow">
                <span className="text-white font-bold text-lg sm:text-xl">P</span>
              </div>
              <span className="font-semibold text-2xl sm:text-3xl text-gray-800">Pixter</span>
            </Link>
          </div>

          {!paymentSuccess ? (
            <div className="space-y-4">
              <h2 className="text-center text-2xl sm:text-3xl font-medium text-gray-700">
                Qual valor a pagar?
              </h2>
              <div className="relative w-full">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={formatBRL(rawAmountDigits)}
                  onChange={handleAmountInputChange}
                  className="w-full text-center text-3xl sm:text-4xl py-3 border-b-2 border-gray-300 focus:border-purple-500 outline-none bg-transparent transition-colors duration-150"
                  aria-label="Valor do pagamento"
                />
              </div>

              {error && !clientSecret && rawAmountDigits && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}

              {clientSecret && amount >= 0.01 ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <PaymentForm onSuccess={handleSuccess} onError={(e) => setError(e.message || "Erro no pagamento.")} amount={amount} />
                </Elements>
              ) : rawAmountDigits && amount >= 0.01 && !error ? (
                <p className="text-center text-gray-500 text-sm py-4">Carregando opções de pagamento...</p>
              ) : null}
            </div>
          ) : (
            <div className="text-center space-y-3 py-8">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-semibold text-gray-800">Pagamento Realizado!</h2>
              <p className="text-gray-600">
                Valor: <span className="font-medium">R$ {paymentDetails?.amount_received ? (paymentDetails.amount_received / 100).toFixed(2).replace(".", ",") : "N/A"}</span>
              </p>
              <p className="text-xs text-gray-500">ID da Transação: {paymentDetails?.id || "N/A"}</p>
              <Link href="/cliente/dashboard/historico" className="inline-block mt-4 px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors">
                Ver Meus Pagamentos
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs sm:text-sm text-gray-500">
        © {new Date().getFullYear()} Pixter. Todos os direitos reservados.
      </footer>
    </div>
  );
}
