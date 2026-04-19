import { getSupabaseClient } from "./supabase";

export type CreatePaymentIntentInput = {
  amount: number;
  currency?: string;
  roomId: string;
  receiverId: string;
  locale?: string;
  accessToken: string;
};

export type CreatePaymentIntentResult = {
  paymentId: string;
  clientSecret: string;
  currency: string;
};

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) throw new Error("VITE_SUPABASE_URL is missing");
  const fnUrl = `${baseUrl}/functions/v1/create-payment-intent`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      roomId: input.roomId,
      receiverId: input.receiverId,
      locale: input.locale,
    }),
  });
  const body = (await res.json()) as Partial<CreatePaymentIntentResult> & { error?: string };
  if (!res.ok || !body.clientSecret || !body.paymentId || !body.currency) {
    throw new Error(body.error ?? "Failed to create payment intent");
  }
  return { paymentId: body.paymentId, clientSecret: body.clientSecret, currency: body.currency };
}

export async function markPaymentFailed(paymentId: string, token: string) {
  const supabase = getSupabaseClient(token);
  if (!supabase) return;
  await supabase.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", paymentId);
}
