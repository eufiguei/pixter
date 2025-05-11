'use client';

// @ts-ignore - Bypassing TypeScript errors for React hooks
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CadastroMotorista() {
  const router = useRouter();

  /* ──────────────── Estados ──────────────── */
  // @ts-ignore - generic removed, use type assertion instead
  const [step, setStep] = useState('phone' as 'phone' | 'details');

  // telefone / OTP
  const [phone, setPhone] = useState('');
  const [countryCode] = useState('55');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // dados pessoais
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [profissao, setProfissao] = useState('Motorista de táxi');
  const [dataNascimento, setDataNascimento] = useState('');
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // selfie + avatar
  const [selfieCapturada, setSelfieCapturada] = useState(false);
  // @ts-ignore - generic removed, use type assertion instead
  const [selfiePreview, setSelfiePreview] = useState(null as string | null);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [showAvatarSelection, setShowAvatarSelection] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ──────────────── Refs ──────────────── */
  // @ts-ignore - generic removed, use type assertion instead
  const videoRef = useRef(null as HTMLVideoElement | null);
  // @ts-ignore - generic removed, use type assertion instead
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  // @ts-ignore - generic removed, use type assertion instead
  const streamRef = useRef(null as MediaStream | null);

  /* ──────────────── Avatares ──────────────── */
  const avatars = Array.from({ length: 9 }, (_, i) => `/images/avatars/avatar_${i + 1}.png`);

  /* ──────────────── Efeitos ──────────────── */
  // countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((n) => (n <= 1 ? (clearInterval(t), 0) : n - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // limpar câmera ao desmontar
  useEffect(
    () => () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    },
    []
  );

  /* ──────────────── API: enviar / verificar código ──────────────── */
  const enviarCodigoVerificacao = async () => {
    if (!phone) return setError('Informe o número');
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar código');
      setCodeSent(true);
      setCountdown(60);
      setSuccess('Código enviado! Verifique o WhatsApp.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async () => {
    if (!verificationCode) return setError('Informe o código');
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: verificationCode, countryCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      setStep('details');
      setSuccess('Telefone verificado!');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────── Câmera & Selfie ──────────────── */
  const iniciarCamera = async () => {
    setCameraAtiva(true); // garante que o <video> seja renderizado antes
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
    } catch (e) {
      setError('Não foi possível acessar a câmera');
      setCameraAtiva(false);
    }
  };

  const capturarSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return setError('Erro ao capturar selfie');
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    ctx?.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    setSelfiePreview(dataUrl);
    setSelfieCapturada(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraAtiva(false);
    setShowAvatarSelection(true);
  };

  const reiniciarCamera = () => {
    setSelfieCapturada(false);
    setSelfiePreview(null);
    setShowAvatarSelection(false);
    iniciarCamera();
  };

  /* ──────────────── Helpers ──────────────── */
  const dataURLtoBlob = (dataURL: string) => {
    const [meta, b64] = dataURL.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    arr.forEach((_, i) => (arr[i] = bin.charCodeAt(i)));
    return new Blob([arr], { type: mime });
  };

  /* ──────────────── Submit final ──────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCompleto || !cpf || !dataNascimento) return setError('Preencha todos os campos obrigatórios');
    if (!selfieCapturada) return setError('Capture uma selfie');
    if (!aceitaTermos) return setError('Aceite os termos');
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('phone', phone);
      fd.append('countryCode', countryCode);
      fd.append('nome', nomeCompleto);
      fd.append('profissao', profissao);
      fd.append('dataNascimento', dataNascimento);
      fd.append('cpf', cpf);
      if (email) fd.append('email', email);
      fd.append('avatarIndex', selectedAvatar.toString());
      if (selfiePreview) fd.append('selfie', new File([dataURLtoBlob(selfiePreview)], 'selfie.jpg'));
      const res = await fetch('/api/auth/complete-registration', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar cadastro');
      router.push('/motorista/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────── Render condicional ──────────────── */
  const renderStepContent = () => {
    if (step === 'phone') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Cadastro de Motorista</h2>
          <p className="text-center text-gray-600">Informe seu número de WhatsApp para começar</p>

          {/* telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (com DDD)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
                +{countryCode}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 98765-4321"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">{success}</div>}

          <button
            type="button"
            onClick={enviarCodigoVerificacao}
            disabled={loading || !phone}
            className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
              loading || !phone ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
            }`}
          >
            {loading ? 'Enviando…' : 'Enviar código de verificação'}
          </button>

          {codeSent && (
            <div className="mt-4">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Digite o código"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                <button
                  type="button"
                  onClick={verificarCodigo}
                  disabled={loading || !verificationCode}
                  className={`bg-blue-600 text-white px-4 py-2 rounded-md font-medium transition ${
                    loading || !verificationCode ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Verificando…' : 'Verificar'}
                </button>
              </div>

              {countdown > 0 ? (
                <p className="text-sm text-gray-500 mt-2">Reenviar código em {countdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={enviarCodigoVerificacao}
                  disabled={loading}
                  className="text-sm text-purple-600 hover:text-purple-800 mt-2"
                >
                  Reenviar código
                </button>
              )}
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            Já tem uma conta?{' '}
            <Link href="/motorista/login" className="text-purple-600 hover:text-purple-800">
              Acesse aqui
            </Link>
          </p>
        </div>
      );
    }

    /* ---------- Detalhes + Selfie + Avatar ---------- */
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Complete seu cadastro</h2>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}

        {/* dados pessoais */}
        <div className="space-y-4">
          {/* nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              required
              placeholder="000.000.000-00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* profissão */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profissão</label>
            <input
              type="text"
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* data de nascimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* selfie + avatar */}
        <div className="space-y-4">
          {!selfieCapturada ? (
            <>
              {!cameraAtiva ? (
                <button
                  type="button"
                  onClick={iniciarCamera}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
                >
                  Iniciar câmera
                </button>
              ) : (
                <>
                  <div className="relative w-full h-64 bg-gray-100 rounded-md overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={capturarSelfie}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700"
                  >
                    Capturar selfie
                  </button>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="relative w-48 h-48 bg-gray-100 rounded-full overflow-hidden">
                  {selfiePreview && <img src={selfiePreview} alt="Selfie" className="absolute inset-0 w-full h-full object-cover" />}
                </div>
              </div>
              <button
                type="button"
                onClick={reiniciarCamera}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700"
              >
                Tirar nova selfie
              </button>
            </>
          )}

          {showAvatarSelection && (
            <div className="space-y-4">
              <h4 className="text-md font-medium">Escolha seu avatar</h4>
              <div className="grid grid-cols-3 gap-4">
                {avatars.map((avatar, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAvatar(idx)}
                    className={`relative rounded-full overflow-hidden border-4 cursor-pointer ${
                      selectedAvatar === idx ? 'border-purple-500' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={avatar}
                      alt={`Avatar ${idx + 1}`}
                      onError={(e) => ((e.target as HTMLImageElement).src = '/images/avatar-placeholder.png')}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* termos */}
        <div className="flex items-start">
          <input
            id="aceita"
            type="checkbox"
            checked={aceitaTermos}
            onChange={(e) => setAceitaTermos(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mt-1"
            required
          />
          <label htmlFor="aceita" className="ml-2 text-sm text-gray-700">
            Aceito os{' '}
            <Link href="/termos" className="text-purple-600 hover:text-purple-800">
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacidade" className="text-purple-600 hover:text-purple-800">
              Política de Privacidade
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !aceitaTermos || !selfieCapturada}
          className={`w-full bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition ${
            loading || !aceitaTermos || !selfieCapturada ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'
          }`}
        >
          {loading ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
    );
  };

  /* ──────────────── JSX principal ──────────────── */
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">{renderStepContent()}</div>
    </main>
  );
}
