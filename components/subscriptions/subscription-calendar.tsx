"use client";

import { BellRing, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { calendarDays, sameMonth, subscriptionDayForMonth } from "@/lib/domain/subscription-calendar";
import { eur } from "@/lib/format";
import type { Subscription } from "@/types/domain";

const weekdays = ["L", "M", "M", "J", "V", "S", "D"];

function SubscriptionMark({ item }: { item: Subscription }) {
  const hasLogo = /^(https?:\/\/|\/)/.test(item.systemImage || "");
  return (
    <span
      className="subscription-calendar-logo"
      data-logo={hasLogo ? "image" : "fallback"}
      style={hasLogo ? { backgroundImage: `url("${item.systemImage.replaceAll('"', "%22")}")` } : { backgroundColor: item.colorHex }}
      aria-hidden="true"
    >
      {hasLogo ? null : <BellRing size={11} />}
    </span>
  );
}

export function SubscriptionCalendar({
  subscriptions,
  month,
  onMonthChange,
  onSelect,
}: {
  subscriptions: Subscription[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (subscription: Subscription) => void;
}) {
  const today = new Date();
  const placed = subscriptions.map((item) => ({ item, day: subscriptionDayForMonth(item, month) }));
  const missing = placed.filter(({ day }) => day === null).map(({ item }) => item);
  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

  const move = (offset: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <section className="subscription-calendar" aria-label={`Calendrier ${formatter.format(month)}`}>
      <header className="subscription-calendar-header">
        <button type="button" className="icon-button" aria-label="Mois précédent" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <strong>{formatter.format(month)}</strong>
        <button type="button" className="icon-button" aria-label="Mois suivant" onClick={() => move(1)}><ChevronRight size={18} /></button>
      </header>
      <button type="button" className="subscription-calendar-today" onClick={() => onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))}>
        <RotateCcw size={13} /> Aujourd’hui
      </button>
      <div className="subscription-calendar-weekdays" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="subscription-calendar-grid">
        {calendarDays(month).map((day, index) => {
          if (day === null) return <span className="subscription-calendar-empty" key={`empty-${index}`} aria-hidden="true" />;
          const items = placed.filter((entry) => entry.day === day).map((entry) => entry.item);
          const isToday = sameMonth(month, today) && day === today.getDate();
          return (
            <div className={`subscription-calendar-day ${isToday ? "is-today" : ""}`} key={day}>
              <span className="subscription-calendar-number">{day}</span>
              {items.slice(0, 2).map((item) => (
                <button
                  type="button"
                  className="subscription-calendar-item"
                  title={`${item.title} · ${item.currency && item.currency !== "EUR" ? `${item.amount.toFixed(2)} ${item.currency}` : eur.format(item.amount)}`}
                  aria-label={`Ouvrir ${item.title}`}
                  onClick={() => onSelect(item)}
                  key={item.id}
                >
                  <SubscriptionMark item={item} />
                  <span>{item.title}</span>
                </button>
              ))}
              {items.length > 2 ? <span className="subscription-calendar-more">+{items.length - 2}</span> : null}
            </div>
          );
        })}
      </div>
      {missing.length ? <p className="subscription-calendar-missing"><BellRing size={14} /> Sans date fiable : {missing.map((item) => item.title).join(", ")}</p> : null}
    </section>
  );
}
