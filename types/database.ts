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
      invite_to_trip: {
        Args: { p_trip_id: string; p_handle?: string | null; p_email?: string | null; p_role?: string };
        Returns: Json;
      };
      respond_trip_invitation: {
        Args: { p_invitation_id: string; p_accept: boolean };
        Returns: Json;
      };
      find_budgy_user: {
        Args: { p_handle: string };
        Returns: { user_id: string; username: string; avatar_url: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
