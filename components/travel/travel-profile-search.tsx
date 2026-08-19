"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { V2Avatar } from "@/components/ui/v2";
import type { DirectoryProfile } from "@/types/domain";

export function TravelProfileSearch({
  value,
  onChange,
  onSelect,
  search,
  statusFor,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (profile: DirectoryProfile) => void;
  search: (query: string) => Promise<DirectoryProfile[]>;
  statusFor: (profile: DirectoryProfile) => string | undefined;
}) {
  const [results, setResults] = useState<DirectoryProfile[]>([]);
  const [searchingQuery, setSearchingQuery] = useState("");
  const [completedQuery, setCompletedQuery] = useState("");
  const sequence = useRef(0);
  const query = value.trim();

  useEffect(() => {
    const currentSequence = ++sequence.current;
    if (query.length < 2) return;
    const timer = window.setTimeout(() => {
      setSearchingQuery(query);
      void search(query)
        .then((profiles) => {
          if (sequence.current !== currentSequence) return;
          setResults(profiles.slice(0, 6));
          setCompletedQuery(query);
        })
        .catch(() => {
          if (sequence.current !== currentSequence) return;
          setResults([]);
          setCompletedQuery(query);
        })
        .finally(() => {
          if (sequence.current === currentSequence) setSearchingQuery("");
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="travel-profile-search">
      <label className="field">
        <span>Pseudo Budgy</span>
        <span className="travel-profile-search-input">
          <Search size={16} />
          <input
            className="input"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Rechercher un pseudo"
          />
        </span>
      </label>
      <div className="travel-profile-search-state" aria-live="polite">
        {!query ? (
          "Recherchez un ami par son pseudo."
        ) : query.length === 1 ? (
          "Saisissez au moins 2 caractères."
        ) : searchingQuery === query ? (
          <>
            <LoaderCircle className="is-spinning" size={15} /> Recherche…
          </>
        ) : completedQuery === query && results.length === 0 ? (
          "Aucun utilisateur trouvé."
        ) : null}
      </div>
      {completedQuery === query && results.length > 0 ? (
        <div
          className="travel-profile-results"
          role="listbox"
          aria-label="Utilisateurs trouvés"
        >
          {results.map((profile) => {
            const status = statusFor(profile);
            return (
              <button
                type="button"
                role="option"
                aria-selected={value === profile.username}
                disabled={Boolean(status)}
                onClick={() => onSelect(profile)}
                key={profile.userId}
              >
                <V2Avatar name={profile.username} url={profile.avatarUrl} />
                <span>
                  <strong>{profile.username}</strong>
                  <small>@{profile.username}</small>
                </span>
                {status ? <em>{status}</em> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
