export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, {
      Row: Record<string, Json>;
      Insert: Record<string, Json>;
      Update: Record<string, Json>;
      Relationships: [];
    }>;
    Views: Record<string, never>;
    Functions: {
      import_budgy_archive: {
        Args: { p_payload: Json; p_format_version: number; p_checksum?: string | null };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
