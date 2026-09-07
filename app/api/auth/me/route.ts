import { jsonWithoutSession } from "@/lib/auth/http";
import { requireApiUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await requireApiUser(request);
  if (!result.ok) {
    return result.response;
  }

  return jsonWithoutSession({ user: result.user });
}
