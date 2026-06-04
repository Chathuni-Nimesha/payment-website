"use client";

import { useState } from "react";
import { FaCcVisa, FaCcMastercard } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function PaymentPage() {
  const router = useRouter();
  
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");


  const currencies = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "LKR", name: "Sri Lankan Rupee" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "AED", name: "UAE Dirham" },
    { code: "INR", name: "Indian Rupee" },
  ];

  const handlePay = () => {
    if (!amount) {
      alert("Please enter an amount");
      return;
    }

    if (!cardNumber) {
      alert("Please enter your card number");
      return;
    }
    if (!expiry) {
      alert("Please enter card expiry date");
      return;

    }
    if (!cvv) {
      alert("Please enter CVV");
      return;
    }
    
  

    console.log({
      currency,
      amount,
      cardNumber,
      expiry,
      cvv
    });
    router.push("/success");


  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white p-8 rounded-xl shadow-xl w-[500px]">
        <div className="flex items-center justify-between mb-4"> 
          <h2 className="text-3xl font-bold">
            Secure Payment 
            </h2> 
            <div className="flex gap-2 text-4xl">
              <FaCcVisa />
              <FaCcMastercard />
            </div>
        </div>
        

        <div className="mb-6">
          <p className="text-gray-500 mb-4">
            Powered by Visa & Mastercard 

          </p>

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border p-3 rounded-lg mb-4"
          >
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>

          <p className="text-gray-500 mb-2">
            Transaction Amount
          </p>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Enter Amount (${currency})`}
            className="w-full border-b p-3 text-2xl outline-none"
          />
        </div>

        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="1234 5678 9012 3456"
          className="w-full border-b p-3 mb-5 outline-none"
        />

        <div className="flex gap-4">
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM/YY"
            className="w-1/2 border-b p-3 outline-none"
          />

          <input
            type="text"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="CVV"
            className="w-1/2 border-b p-3 outline-none"
          />
        </div>

        <button
          onClick={handlePay}
          className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg transition"
        >
          Pay
        </button>
      </div>
    </div>
  );
}