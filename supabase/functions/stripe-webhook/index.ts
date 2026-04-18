import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.9.0?target=denonext";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRole) {
    return new Response("Missing env vars", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe signature", { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature error: ${err instanceof Error ? err.message : "unknown"}`, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata?.payment_id;
    if (paymentId) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, room_id, sender_id, receiver_id")
        .eq("id", paymentId)
        .maybeSingle();

      if (payment) {
        await supabase
          .from("payments")
          .update({ status: "success", stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        if (payment.room_id) {
          await supabase.from("messages").insert({
            room_id: payment.room_id,
            sender_id: payment.receiver_id,
            receiver_id: payment.sender_id,
            content: "결제 완료",
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata?.payment_id;
    if (paymentId) {
      await supabase
        .from("payments")
        .update({ status: "failed", stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() })
        .eq("id", paymentId);
    }
  }

  return new Response("ok", { status: 200 });
});
