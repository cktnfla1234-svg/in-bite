import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatFiat, type CurrencyCode } from "@/lib/currency";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

type ChatPaymentSheetProps = {
  open: boolean;
  clientSecret: string | null;
  amount: number;
  currency: CurrencyCode;
  onClose: () => void;
  onPaid: () => void;
};

function PaymentForm({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation("common");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: payErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (payErr) {
      setError(payErr.message ?? t("chat.paymentFailed"));
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onPaid();
      return;
    }
    setError(t("chat.paymentPending"));
    setSubmitting(false);
  };

  return (
    <>
      <PaymentElement />
      {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-2xl border border-[#E4CCB8] bg-white py-3 text-[14px] font-semibold text-[#A0522D]"
        >
          {t("chat.paymentCancel")}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="flex-1 rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? t("chat.paymentProcessing") : t("chat.paymentConfirm")}
        </button>
      </div>
    </>
  );
}

export function ChatPaymentSheet({ open, clientSecret, amount, currency, onClose, onPaid }: ChatPaymentSheetProps) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.language || "en";
  const formatted = useMemo(() => formatFiat(amount, currency, locale), [amount, currency, locale]);
  if (!open || !clientSecret) return null;

  return (
    <motion.div
      key="payment-sheet"
      className="fixed inset-0 z-[74]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button type="button" className="absolute inset-0 bg-black/30" aria-label={t("chat.paymentCancel")} onClick={onClose} />
      <motion.div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[#E6D2BF] bg-[#FFFBF6] p-5 pb-8 shadow-[0_-18px_55px_rgba(0,0,0,0.16)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E3D3C5]" />
        <h2 className="text-[16px] font-bold text-[#7A4B2F]">{t("chat.paymentTitle")}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[#A0522D]/70">
          {t("chat.paymentAmountLabel", { amount: formatted })}
        </p>
        <div className="mt-4 rounded-2xl border border-[#E9D6C6] bg-white p-3">
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm onClose={onClose} onPaid={onPaid} />
          </Elements>
        </div>
      </motion.div>
    </motion.div>
  );
}
