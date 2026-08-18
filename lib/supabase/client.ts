"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { isSupabaseConfigured,supabaseAnonKey,supabaseUrl } from "./config";
let client:ReturnType<typeof createBrowserClient<Database>>|null=null;
export function getSupabaseBrowserClient(){if(!isSupabaseConfigured||!supabaseUrl||!supabaseAnonKey)return null;if(!client)client=createBrowserClient<Database>(supabaseUrl,supabaseAnonKey);return client;}
