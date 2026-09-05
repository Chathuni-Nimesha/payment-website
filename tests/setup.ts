import { vi } from "vitest";

vi.mock("server-only", () => ({}));

process.env.STRIPE_SECRET_KEY = "";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";
