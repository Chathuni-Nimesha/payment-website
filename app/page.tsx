export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold">
        Secure Payment Gateway
      </h1>

      <p className="mt-4 text-gray-400">
        Accept Visa & Mastercard Payments Worldwide
      </p>

      <a
        href="/payment"
        className="mt-8 bg-blue-600 px-6 py-3 rounded-lg">
        Pay Now
      </a>

    </main>
  );
}