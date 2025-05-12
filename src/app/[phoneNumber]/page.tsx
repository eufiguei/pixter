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
import { LogIn, LogOut, User } from "lucide-react";
// Removed: import CurrencyInput from 'react-currency-input-field';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

// Fallback avatar
const defaultAvatar = "/images/avatars/avatar_1.png";

// Format phone number to (XX) XXXXXXXXX format
const formatPhoneNumber = (phone: string) => {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Remove country code if present
  const nationalNumber = digits.startsWith("55") ? digits.substring(2) : digits;

  // Format as (XX) XXXXXXXXX
  if (nationalNumber.length >= 10) {
    const areaCode = nationalNumber.substring(0, 2);
    const number = nationalNumber.substring(2);
    return `(${areaCode}) ${number}`;
  }

  return nationalNumber;
};

function PaymentForm({ onSuccess, onError }: any) {
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
          return_url: `${window.location.origin}/pagamento/sucesso`,
        },
        redirect: "if_required",
      });

      if (error) {
        setPaymentError(error.message!);
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
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {paymentError}
        </div>
      )}
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md disabled:opacity-50"
      >
        {isProcessing ? "Processando..." : "Pagar com Pix, Apple Pay ou Cartão"}
      </button>
      <p className="text-center text-xs text-gray-500 mt-2">
        Pagamento processado com segurança via Stripe
      </p>
    </form>
  );
}

export default function DriverPaymentPage({
  params,
}: {
  params: { phoneNumber: string };
}) {
  const { data } = useSession();

  const isDriver = data?.user?.tipo === "motorista";

  const { phoneNumber } = params;
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [rawAmountDigits, setRawAmountDigits] = useState(""); // State for raw digits input
  // driverInfo state will hold the entire API response, including the nested 'profile' object
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // --- Formatting Helper ---
  const formatBRL = (digits: string): string => {
    if (!digits || digits === "0") return "R$ 0,00";
    // Ensure we handle potential leading zeros if needed, though replace should manage it
    const num = parseInt(digits, 10);
    if (isNaN(num)) return "R$ 0,00"; // Handle case where digits might become NaN

    const reais = Math.floor(num / 100);
    const centavos = (num % 100).toString().padStart(2, "0");
    // Add thousands separator for reais using Intl.NumberFormat for robustness
    const formattedReais = reais.toLocaleString("pt-BR");
    return `R$ ${formattedReais},${centavos}`;
  };

  // --- Input Handler ---
  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove non-digit characters
    const digits = value.replace(/\D/g, "");
    // Limit length if necessary, e.g., max 9 digits (R$ 999.999,99)
    setRawAmountDigits(digits.slice(0, 9));
  };

  // fetch driver public info
  useEffect(() => {
    fetch(`/api/public/driver-info/${phoneNumber}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setDriverInfo) // Store the whole response { profile: { ... } }
      .catch((err: any) => setError(err.error || err.message))
      .finally(() => setLoadingInfo(false));
  }, [phoneNumber]);

  // create PaymentIntent whenever `amount` derived from raw digits is >= R$0.01
  useEffect(() => {
    clearTimeout(debounceRef.current!);
    // Derive numeric amount from raw digits
    const num = parseInt(rawAmountDigits || "0", 10);
    const numericAmount = num / 100; // Convert cents to BRL value

    // Update the separate amount state for potential display or other logic
    setAmount(numericAmount);

    if (!isNaN(numericAmount) && numericAmount >= 0.01) {
      // Check if amount is valid and >= 0.01 BRL
      debounceRef.current = setTimeout(async () => {
        setError("");
        try {
          const res = await fetch("/api/stripe/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Send amount in cents (integer)
            body: JSON.stringify({
              amount: num,
              driverPhoneNumber: phoneNumber,
            }),
          });
          if (!res.ok) throw await res.json();
          const { clientSecret } = await res.json();
          setClientSecret(clientSecret);
        } catch (err: any) {
          setError(err.error || err.message || "Erro ao iniciar pagamento");
        }
      }, 500);
    } else {
      setClientSecret("");
      // Clear error only if input is empty, otherwise keep potential errors
      if (!rawAmountDigits) {
        setError("");
      }
    }
    // Depend on rawAmountDigits instead of amount
  }, [rawAmountDigits, phoneNumber]);

  const handleSuccess = (pi: any) => {
    setPaymentSuccess(true);
    setPaymentDetails(pi);
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-purple-600 rounded-full"></div>
      </div>
    );
  }

  // Check for error OR if driverInfo exists but driverInfo.profile does not
  if (error || !driverInfo?.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-6 bg-white rounded shadow text-center">
          <h1 className="text-red-600 font-semibold mb-4">Erro</h1>
          {/* Display specific error or a generic one if profile is missing */}
          <p>{error || "Informações do motorista não encontradas."}</p>
          <Link href="/" className="text-indigo-600 hover:underline mt-4 block">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  // Now we can safely access driverInfo.profile properties
  const profile = driverInfo.profile;

  return (
   

          <div className="flex justify-end w-full mt-2 mb-4">
            <div className="space-x-4">
              {!data ? (
                // Not logged in - show both links
                <>
                  <Link
                    href="/login"
                    className="text-sm text-gray-600 hover:text-purple-600"
                  >
                    Acessar Conta
                  </Link>
                  <Link
                    href="/cadastro"
                    className="text-sm text-gray-600 hover:text-purple-600"
                  >
                    Create Account
                  </Link>
                </>
              ) : isDriver ? (
                // Logged in as driver - show switch account option
                <button
                  className="text-sm text-gray-600 hover:text-purple-600 flex items-center gap-1"
                  onClick={async () => {
                    try {
                      // Log out from Supabase
                      await fetch("/api/auth/logout", { method: "POST" });
                      // Log out from NextAuth
                      await signOut({ redirect: false });
                      // Redirect to login
                      window.location.href = "/login";
                    } catch (error) {
                      console.error("Error signing out:", error);
                      window.location.href = "/login";
                    }
                  }}
                >
                  {/* <LogOut className="w-4 h-4" /> */}
                  <LogIn className="w-4 h-4" />
                  {/* Switch Account */}
                  LogIn
                </button>
              ) : (
                // Logged in but not a driver - show user info and logout option
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden relative bg-gray-200">
                      {data.user?.image ? (
                        <Image
                          src={data.user.image}
                          alt="Profile"
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <User className="w-4 h-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-500" />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {data.user?.name || data.user?.email || "User"}
                    </span>
                  </div>
                  <button
                    className="text-sm text-gray-600 hover:text-purple-600 flex items-center gap-1"
                    onClick={async () => {
                      try {
                        // Log out from Supabase
                        await fetch("/api/auth/logout", { method: "POST" });
                        // Log out from NextAuth
                        await signOut({ redirect: false });
                        // Refresh the current page
                        window.location.reload();
                      } catch (error) {
                        console.error("Error signing out:", error);
                        window.location.reload();
                      }
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </button>
                </div>
              )}
            </div>
          </div>

 <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-grow flex flex-col items-center p-4 pt-8 md:pt-16">
        {/* Logo Header */}
        <div className="mb-8 flex flex-col items-center justify-center space-y-2">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-600">
              <span className="text-lg font-bold text-white">P</span>
            </div>
          </Link>
        </div>

        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl bg-white rounded-lg shadow-md p-8 space-y-8">
          {/* Pixter Header Section */}
          <div className="flex items-center justify-center">
            <Link href="/" className="text-3xl font-bold text-center">
              Pixter
            </Link>
          </div>

          {/* Driver Info - Access via profile object */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-24 h-24 rounded-full overflow-hidden relative">
              <Image
                src={profile.avatar_url || defaultAvatar}
                alt={profile.nome || "Driver Avatar"}
                fill
                style={{ objectFit: "cover" }}
                onError={(e) => (e.currentTarget.src = defaultAvatar)}
                priority
              />
            </div>
            <h1 className="text-2xl font-bold">{profile.nome || "Driver"}</h1>
            {profile.profissao && (
              <p className="text-sm text-gray-600">{profile.profissao}</p>
            )}
            {/* Make phone number clickable and properly formatted */}
            {profile.celular && (
              <a
                href={`tel:${profile.celular}`}
                className="text-sm text-gray-500 hover:text-purple-600 flex items-center justify-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {formatPhoneNumber(profile.celular)}
              </a>
            )}
          </div>

          {/* amount input */}
          {!paymentSuccess ? (
            <>
              <h2 className="text-center text-3xl font-semibold">
                Qual valor pago?
              </h2>
              {/* Custom BRL Input */}
              <div className="relative w-full">
                <input
                  type="text" // Use text to allow custom formatting display
                  inputMode="numeric" // Hint for mobile numeric keyboard
                  placeholder="R$ 0,00"
                  value={formatBRL(rawAmountDigits)} // Display formatted value
                  onChange={handleAmountInputChange} // Handle raw digit input
                  className="w-full text-center text-3xl py-3 border rounded focus:ring-purple-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}

              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm onSuccess={handleSuccess} onError={setError} />
                </Elements>
              ) : (
                amount && (
                  <p className="text-center text-gray-500">
                    Carregando opções de pagamento...
                  </p>
                )
              )}
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-green-600 font-semibold">
                Pagamento concluído!
              </p>
              <p>
                Valor: R${" "}
                {(paymentDetails.amount_received / 100)
                  .toFixed(2)
                  .replace(".", ",")}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Pixter. Todos os direitos reservados.
      </footer>
    </div>
  );
}
