"use client";

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center">
        <h1 className="text-4xl font-bold text-green-600 mb-4">
          Payment Successful
        </h1>

        <p className="text-gray-600">
          Your transaction has been completed successfully.
        </p>

        <button
          onClick={() => window.location.href = "/payment"}
          className="mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg"
        >
          New Payment
        </button>
      </div>
    </div>
  );
}