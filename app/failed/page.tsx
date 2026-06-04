export default function FailedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">
          Payment Failed
        </h1>

        <p className="text-gray-600">
          Transaction could not be completed.
        </p>
      </div>
    </div>
  );
}