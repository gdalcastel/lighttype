"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CreditCard,
  Download,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { checkoutPay, sendVerificationCode, verifyCheckoutCode } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = "email" | "code" | "payment";

const STEPS: { id: Step; label: string }[] = [
  { id: "email", label: "E-mail" },
  { id: "code", label: "Verificação" },
  { id: "payment", label: "Pagamento" },
];

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StepIllustration({ step }: { step: Step }) {
  const icons = {
    email: Mail,
    code: ShieldCheck,
    payment: CreditCard,
  } as const;

  return (
    <div className="relative mx-auto flex h-[88px] w-[88px] items-center justify-center">
      {STEPS.map((s) => {
        const StepIcon = icons[s.id];
        return (
          <div
            key={s.id}
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-400",
              step === s.id
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-90 opacity-0",
            )}
          >
            <div className="flex size-[72px] items-center justify-center rounded-[20px] bg-accent-soft">
              <StepIcon className="size-8 text-accent" strokeWidth={1.5} />
            </div>
          </div>
        );
      })}
      <div className="pointer-events-none absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
        <Lock className="size-3.5 text-muted" />
      </div>
    </div>
  );
}

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (index: number, digit: string) => {
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 4) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < 5; i += 1) next[i] = pasted[i] ?? "";
    onChange(next);
    refs.current[Math.min(pasted.length, 4)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Dígito ${index + 1} do código`}
          className="h-14 w-11 rounded-[14px] border border-border bg-background text-center text-[22px] font-semibold text-foreground transition-colors focus:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50"
          onChange={(e) => setDigit(index, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

function SecurityFooter() {
  return (
    <div className="flex items-center justify-center gap-4 border-t border-border pt-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Lock className="size-3" />
        <span>Conexão segura</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck className="size-3" />
        <span>Dados criptografados</span>
      </div>
    </div>
  );
}

export function DownloadCheckoutModal({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (downloadToken: string) => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", ""]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [priceCents, setPriceCents] = useState(2990);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const reset = useCallback(() => {
    setStep("email");
    setEmail("");
    setCodeDigits(["", "", "", "", ""]);
    setSessionId(null);
    setPriceCents(2990);
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setLoading(false);
    setError(null);
    setDevCodeHint(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const code = codeDigits.join("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await sendVerificationCode(email);
      if (result.dev_code) setDevCodeHint(result.dev_code);
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length < 5 || verifyingRef.current) {
      if (code.length < 5) setError("Digite os 5 dígitos do código.");
      return;
    }
    verifyingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyCheckoutCode(email, code);
      setSessionId(result.session_id);
      setPriceCents(result.price_cents);
      setStep("payment");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }

  async function handleResendCode() {
    setError(null);
    setLoading(true);
    try {
      const result = await sendVerificationCode(email);
      if (result.dev_code) setDevCodeHint(result.dev_code);
      setCodeDigits(["", "", "", "", ""]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    if (!cardName.trim() || cardNumber.replace(/\s/g, "").length < 13 || !cardExpiry || cardCvv.length < 3) {
      setError("Preencha os dados do cartão.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await checkoutPay(sessionId);
      onComplete(result.download_token);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step === "code" && code.length === 5 && !loading) {
      void handleVerifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  const titles: Record<Step, string> = {
    email: "Baixar arquivos STL",
    code: "Verifique seu e-mail",
    payment: "Pagamento seguro",
  };

  const descriptions: Record<Step, string> = {
    email: "Informe seu e-mail para receber o código de verificação e liberar o download do pacote completo.",
    code: `Digite o código de 5 dígitos enviado para ${email || "seu e-mail"}.`,
    payment: "Confirme o pagamento para iniciar o download dos arquivos STL.",
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="w-[min(92vw,460px)]"
      contentClassName="flex flex-col p-7"
    >
      <div className="mb-1">
        <h2 className="text-[22px] font-medium tracking-tight">{titles[step]}</h2>
        <p className="mt-2 min-h-[72px] text-[15px] leading-6 text-muted transition-opacity duration-300">
          {descriptions[step]}
        </p>
      </div>

      <div className="flex min-h-[520px] flex-col">
        <StepIllustration step={step} />

        <div className="mt-5 flex flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col transition-opacity duration-300",
              loading ? "pointer-events-none opacity-60" : "opacity-100",
            )}
          >
            {step === "email" ? (
              <form className="flex flex-1 flex-col space-y-4" onSubmit={handleSendCode}>
                <div className="space-y-2">
                  <label htmlFor="checkout-email" className="text-[13px] font-medium text-muted">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      id="checkout-email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                {error ? <p className="text-[12px] leading-4 text-accent">{error}</p> : null}
                <div className="mt-auto space-y-4">
                  <Button type="submit" size="lg" className="w-full" disabled={loading || !email.trim()}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Continuar
                  </Button>
                  <SecurityFooter />
                </div>
              </form>
            ) : null}

            {step === "code" ? (
              <form className="flex flex-1 flex-col space-y-4" onSubmit={handleVerifyCode}>
                <OtpInput value={codeDigits} onChange={setCodeDigits} disabled={loading} />
                {devCodeHint ? (
                  <p className="rounded-[10px] bg-background px-3 py-2 text-center text-[12px] text-muted">
                    Modo dev: código <span className="font-mono font-semibold text-foreground">{devCodeHint}</span>
                  </p>
                ) : null}
                {error ? <p className="text-center text-[12px] leading-4 text-accent">{error}</p> : null}
                <div className="mt-auto space-y-4">
                  <Button type="submit" size="lg" className="w-full" disabled={loading || code.length < 5}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Verificar código
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-[13px] text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                    onClick={handleResendCode}
                    disabled={loading}
                  >
                    Reenviar código
                  </button>
                  <SecurityFooter />
                </div>
              </form>
            ) : null}

            {step === "payment" ? (
              <form className="flex flex-1 flex-col space-y-4" onSubmit={handlePayment}>
                <div className="flex items-center justify-between rounded-[14px] border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Download className="size-4 text-muted" />
                    <span className="text-[14px] text-muted">Pacote STL completo</span>
                  </div>
                  <span className="text-[20px] font-semibold">{formatPrice(priceCents)}</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="card-name" className="text-[13px] font-medium text-muted">
                      Nome no cartão
                    </label>
                    <Input
                      id="card-name"
                      placeholder="Como impresso no cartão"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="card-number" className="text-[13px] font-medium text-muted">
                      Número do cartão
                    </label>
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                      <Input
                        id="card-number"
                        inputMode="numeric"
                        placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 19))}
                        className="pl-10"
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label htmlFor="card-expiry" className="text-[13px] font-medium text-muted">
                        Validade
                      </label>
                      <Input
                        id="card-expiry"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value.replace(/[^\d/]/g, "").slice(0, 5))}
                        disabled={loading}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="card-cvv" className="text-[13px] font-medium text-muted">
                        CVV
                      </label>
                      <Input
                        id="card-cvv"
                        inputMode="numeric"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>
                {error ? <p className="text-[12px] leading-4 text-accent">{error}</p> : null}
                <div className="mt-auto space-y-4">
                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                    Pagar e baixar
                  </Button>
                  <SecurityFooter />
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
