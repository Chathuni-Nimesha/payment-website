import { Button } from "@/components/Button";
import { brand } from "@/lib/brand";

export default function Home() {
  return (
    <main>
      <section className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <p className="text-sm font-medium text-accent">Stripe test mode</p>
        <h1 className="mt-3 max-w-2xl text-[2rem] font-semibold tracking-tight text-foreground sm:text-4xl">
          Checkout that reads as finished work.
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-7 text-muted">
          {brand.name} is a professional payment checkout for invoices,
          retainers, and client work. Amounts are collected through Stripe’s
          Payment Element. This version does not take live charges.
        </p>
        <div className="mt-8 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Button href="/payment" size="lg" className="w-full sm:w-auto">
            Open checkout
          </Button>
          <Button href="/#how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
            How it works
          </Button>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Built to present well
          </h2>
          <div className="mt-8 grid gap-10 md:grid-cols-3">
          <Value
            title="Simple checkout"
            body="A focused amount, currency, and email form. No extra product catalog or account wall."
          />
          <Value
            title="Clear payment status"
            body="Receipts show paid, processing, or unavailable from Stripe — not from the browser redirect."
          />
          <Value
            title="Built for modern businesses"
            body="The layout, copy, and states are meant for client presentation, not a tutorial form."
          />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto w-full min-w-0 max-w-5xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-16"
      >
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          How it works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          <Step
            n="1"
            title="Enter payment details"
            body="Choose a currency, amount, and optional email for the receipt."
          />
          <Step
            n="2"
            title="Complete checkout"
            body="Stripe’s Payment Element collects the payment method. Northline never sees the card number."
          />
          <Step
            n="3"
            title="Receive confirmation"
            body="Status is confirmed with Stripe before a receipt is shown as paid."
          />
        </ol>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            How payments are handled
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Trust
              title="Test mode only"
              body="This build uses Stripe test mode. Live keys are rejected. No production merchant processing is enabled."
            />
            <Trust
              title="Stripe Payment Element"
              body="Card details are entered in Stripe’s Payment Element. Northline does not collect or store card numbers, expiry dates, or CVV."
            />
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-6 text-muted">
            Northline does not claim PCI certification or production security
            certification. Receipt pages retrieve the PaymentIntent from Stripe
            instead of trusting a URL parameter.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full min-w-0 max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Ready to try checkout
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted">
          Open the test-mode checkout. Real Stripe test charges require valid
          test credentials.
        </p>
        <div className="mt-8">
          <Button href="/payment" size="lg" className="w-full sm:w-auto">
            Open checkout
          </Button>
        </div>
      </section>
    </main>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium text-muted">
        {n}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      </div>
    </li>
  );
}

function Trust({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
