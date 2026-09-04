import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const alt = `${brand.name} — ${brand.tagline}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f5f2",
          padding: "72px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#1e4a86",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            N
          </div>
          <div style={{ fontSize: "28px", fontWeight: 600, color: "#111111" }}>
            {brand.name}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 600,
              color: "#111111",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            Checkout for independent businesses
          </div>
          <div
            style={{
              marginTop: "24px",
              fontSize: "24px",
              color: "#5c5c57",
            }}
          >
            Stripe test mode. Card details stay with Stripe.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
