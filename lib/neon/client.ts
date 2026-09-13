"use client";

import { NeonPostgrestClient } from "@neondatabase/neon-js";
import type { Database } from "@/types/database";
import { usesNeon } from "@/lib/neon/config";

let client: NeonPostgrestClient<Database> | null = null;

export function getNeonDataClient() {
  if (!usesNeon) return null;

  if (!client) {
    const dataApiUrl = new URL("/api/data", window.location.origin).toString();

    client = new NeonPostgrestClient<Database>({
      dataApiUrl,
    });
  }

  return client;
}
