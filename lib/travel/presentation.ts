export const tripDayCount = (start: string, end: string) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(Math.round(diff / 86_400_000) + 1, 1);
};

export const tripCountdown = (start: string, now = new Date()) => {
  const target = new Date(start);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  if (days > 0) return `J-${days}`;
  if (days === 0) return "Aujourd’hui";
  return "En voyage";
};

export const tripRangeLabel = (start: string, end: string) => {
  const from = new Date(start);
  const to = new Date(end);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
  const month = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
  return sameMonth ? `${day.format(from)} → ${month.format(to)}` : `${month.format(from)} → ${month.format(to)}`;
};

export const itineraryDayLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long",
}).format(new Date(value));

export const timeLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

