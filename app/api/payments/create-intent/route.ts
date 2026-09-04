import { createPaymentIntent } from "@/lib/payments/create-intent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Enter a valid amount, currency, and email." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Enter a valid amount, currency, and email." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const result = await createPaymentIntent({
    amount: payload.amount,
    currency: payload.currency,
    email: payload.email,
    idempotencyKey: payload.idempotencyKey,
  });

  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        fieldErrors: result.fieldErrors,
      },
      { status: result.status },
    );
  }

  return Response.json({
    clientSecret: result.clientSecret,
    reference: result.reference,
    intentStatus: result.intentStatus,
  });
}
