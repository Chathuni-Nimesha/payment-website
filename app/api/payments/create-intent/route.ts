import { createPaymentIntent } from "@/lib/payments/create-intent";
import {
  limitCreateIntentByIdentity,
  limitCreateIntentByIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ipLimit = await limitCreateIntentByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

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
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const identityLimit = await limitCreateIntentByIdentity(request, email);
  if (!identityLimit.ok) {
    return identityLimit.response;
  }

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
