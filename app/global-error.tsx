"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f5f5f2",
          color: "#111111",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: "32rem",
            margin: "0 auto",
            padding: "3rem 1.25rem",
          }}
        >
          <section
            style={{
              border: "1px solid #e6e6e0",
              borderRadius: "12px",
              background: "#ffffff",
              padding: "2rem",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#b42318",
              }}
            >
              Error
            </p>
            <h1
              style={{
                margin: "0.5rem 0 0",
                fontSize: "1.5rem",
                fontWeight: 600,
              }}
            >
              Northline could not load
            </h1>
            <p style={{ margin: "1rem 0 0", lineHeight: 1.6, color: "#5c5c57" }}>
              An unexpected application error occurred. Nothing was charged.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                marginTop: "1.75rem",
                height: "2.75rem",
                padding: "0 1.25rem",
                border: 0,
                borderRadius: "8px",
                background: "#1e4a86",
                color: "#ffffff",
                fontSize: "0.9375rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
