"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useBudgyData } from "@/lib/data/data-provider";
import { allAirportCountries, searchAirportCountries, type AirportCountry } from "@/lib/airports/countries";
import { countryCodeToFlag } from "@/lib/travel/destinations";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr-FR")
  .trim();

export function CountrySelector({ value, countryCode, onInput, onSelect }: {
  value: string;
  countryCode: string;
  onInput: (value: string) => void;
  onSelect: (country: AirportCountry) => void;
}) {
  const { loadAirportCountries } = useBudgyData();
  const [countries, setCountries] = useState(allAirportCountries);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!loadAirportCountries) return;
    let active = true;
    void loadAirportCountries().then((items) => {
      if (active && items.length > 0) setCountries(items);
    });
    return () => { active = false; };
  }, [loadAirportCountries]);

  const results = useMemo(() => searchAirportCountries(countries, value, 12), [countries, value]);
  const showResults = open && value.trim().length >= 1;

  const closeAndResolveExact = () => {
    const exact = countries.find((country) => normalize(country.name) === normalize(value) || country.code.toLocaleLowerCase("fr-FR") === value.trim().toLocaleLowerCase("fr-FR"));
    if (exact) onSelect(exact);
    setOpen(false);
  };

  return <div className="travel-country-selector" ref={wrapper} onBlur={(event) => {
    if (!wrapper.current?.contains(event.relatedTarget as Node | null)) closeAndResolveExact();
  }}>
    <span className="travel-country-input">
      <Search size={16} aria-hidden="true" />
      <input
        className="input"
        role="combobox"
        aria-label="Pays"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showResults}
        autoComplete="off"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => { onInput(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Rechercher un pays"
      />
    </span>
    {showResults ? <div className="travel-country-results" id={listId} role="listbox" aria-label="Pays disponibles">
      {results.length > 0 ? results.map((country) => <button
        type="button"
        role="option"
        aria-selected={country.code === countryCode}
        key={country.code}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => { onSelect(country); setOpen(false); }}
      >
        <span>{countryCodeToFlag(country.code)}</span>
        <strong>{country.name}</strong>
      </button>) : <p>Aucun pays trouvé.</p>}
    </div> : null}
  </div>;
}
