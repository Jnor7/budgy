export const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
export const money = (amount: number, currency = "EUR") => {
  const intlCurrency = currency === "FCFA" || currency === "CFA" ? "XAF" : currency;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: intlCurrency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
  }
};
export const shortDate = (value: string | Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value));
export const fullDate = (value: string | Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
export const monthLabel = (date: Date) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date).replace(/^./, (letter) => letter.toUpperCase());
export const toDateInput = (value: string | Date) => {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`).toISOString();
