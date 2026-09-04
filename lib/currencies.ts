export type Currency = {
  code: string;
  name: string;
  fractionDigits: number;
};

export const currencies = [
  { code: "USD", name: "US Dollar", fractionDigits: 2 },
  { code: "EUR", name: "Euro", fractionDigits: 2 },
  { code: "GBP", name: "British Pound", fractionDigits: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", fractionDigits: 2 },
  { code: "JPY", name: "Japanese Yen", fractionDigits: 0 },
  { code: "AUD", name: "Australian Dollar", fractionDigits: 2 },
  { code: "CAD", name: "Canadian Dollar", fractionDigits: 2 },
  { code: "SGD", name: "Singapore Dollar", fractionDigits: 2 },
  { code: "AED", name: "UAE Dirham", fractionDigits: 2 },
  { code: "INR", name: "Indian Rupee", fractionDigits: 2 },
] as const satisfies readonly Currency[];

export type CurrencyCode = (typeof currencies)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

const currencyByCode = new Map<string, Currency>(
  currencies.map((currency) => [currency.code, currency]),
);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return currencyByCode.has(value);
}

export function getCurrency(code: string): Currency | undefined {
  return currencyByCode.get(code);
}
