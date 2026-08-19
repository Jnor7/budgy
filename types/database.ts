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
      search_airports: {
        Args: { p_query: string; p_limit?: number };
        Returns: { id: number; ident: string; iata_code: string | null; icao_code: string | null; name: string; municipality: string; country_code: string; latitude: number | null; longitude: number | null; type: string }[];
      };
      find_travel_user: {
        Args: { p_handle: string };
        Returns: { user_id: string; username: string; avatar_url: string }[];
      };
      send_travel_friend_request: { Args: { p_handle: string }; Returns: Json };
      respond_travel_friend_request: { Args: { p_request_id: string; p_accept: boolean }; Returns: Json };
      remove_travel_friend: { Args: { p_friend_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
