import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.9.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreatePaymentBody = {
  amount?: number;
  currency?: string;
  roomId?: string;
  receiverId?: string;
  locale?: string;
};

function resolveCurrency(rawCurrency: string | undefined, locale: string | undefined) {
  const direct = (rawCurrency ?? "").trim().toUpperCase();
  if (direct === "KRW" || direct === "AUD" || direct === "EUR") return direct;
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("ko")) return "KRW";
  if (l.startsWith("de") || l.startsWith("fr") || l.startsWith("it") || l.startsWith("es")) return "EUR";
  return "AUD";
}

function toMinorUnit(amount: number, currency: string) {
  return currency === "KRW" ? Math.round(amount) : Math.round(amount * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !supabaseAnon || !serviceRole) {
      return new Response(JSON.stringify({ error: "Missing env variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CreatePaymentBody;
    if (!body.amount || body.amount <= 0 || !body.receiverId) {
      return new Response(JSON.stringify({ error: "amount and receiverId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: auth } } });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderId = user.id;
    const currency = resolveCurrency(body.currency, body.locale);
    const service = createClient(supabaseUrl, serviceRole);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: payment, error: paymentErr } = await service
      .from("payments")
      .insert({
        room_id: body.roomId ?? null,
        sender_id: senderId,
        receiver_id: body.receiverId,
        amount: body.amount,
        currency,
        status: "pending",
      })
      .select("id")
      .single();
    if (paymentErr || !payment?.id) throw new Error(paymentErr?.message ?? "Failed to save payment");

    const intent = await stripe.paymentIntents.create({
      amount: toMinorUnit(body.amount, currency),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        payment_id: payment.id,
        room_id: body.roomId ?? "",
        sender_id: senderId,
        receiver_id: body.receiverId,
      },
    });

    await service.from("payments").update({ stripe_payment_intent_id: intent.id }).eq("id", payment.id);

    return new Response(JSON.stringify({ paymentId: payment.id, clientSecret: intent.client_secret, currency }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
