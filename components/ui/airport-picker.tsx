"use client";

import { Check, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/modal";
import { airports, searchAirports, type Airport } from "@/lib/airports/airports";
import { useBudgyData } from "@/lib/data/data-provider";

export function AirportPicker({ open, title, value, onClose, onSelect }: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSelect: (code: string, airport: Airport) => void;
}) {
  const { searchAirportDirectory } = useBudgyData();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ query: string; items: Airport[] }>({ query: "", items: [] });
  const local = useMemo(() => searchAirports(query), [query]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchAirportDirectory(query).then((items) => {
        if (!cancelled) setRemote({ query, items });
      });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, searchAirportDirectory]);

  const results = useMemo(() => {
    // Une fois la base repondue, ses 4 562 aeroports deviennent la source primaire.
    const candidates = remote.query === query ? [...remote.items, ...local] : local;
    return [...new Map(candidates.map((item) => [item.code, item])).values()].slice(0, 24);
  }, [local, query, remote]);
  const selected = results.find((airport) => airport.code === value)
    ?? airports.find((airport) => airport.code === value);

  return <Sheet open={open} title={title} onClose={onClose}>
    <div className="stack">
      <div className="card row">
        <Search className="muted" />
        <input className="input" style={{ border: 0, background: "transparent", padding: 0 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une ville, un code, un pays…" />
      </div>
      {selected ? <div>
        <div className="muted small" style={{ marginBottom: 8 }}>Sélection actuelle</div>
        <div className="card row" style={{ borderColor: "#55cbd3" }}>
          <strong className="cyan" style={{ fontSize: 31 }}>{selected.code}</strong>
          <div className="list-main"><strong>{selected.flag} {selected.city}</strong><div className="muted small">{selected.name}<br />{selected.country}</div></div>
          <span className="status-dot active"><Check size={15} /></span>
        </div>
      </div> : null}
      <div>
        <div className="muted small" style={{ marginBottom: 8 }}>{query ? "Résultats" : "Aéroports populaires"}</div>
        {results.map((airport) => <button className="card list-row" style={{ marginBottom: 9, padding: 14 }} key={`${airport.code}-${airport.name}`} onClick={() => { onSelect(airport.code, airport); setQuery(""); onClose(); }}>
          <div className="list-main">
            <strong>{airport.flag} {airport.city} · {airport.name}</strong>
            <span className="muted small">{airport.city}, {airport.country} · {airport.code}</span>
          </div>
          <ChevronRight className="muted" />
        </button>)}
      </div>
    </div>
  </Sheet>;
}
