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
      current_budgy_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      ensure_current_budgy_user: {
        Args: Record<string, never>;
        Returns: string;
      };
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
      list_airport_country_codes: {
        Args: Record<string, never>;
        Returns: { country_code: string }[];
      };
      update_trip_cover: {
        Args: {
          p_trip_id: string;
          p_cover_image_url: string;
          p_cover_image_provider: string;
          p_cover_image_id: string;
          p_cover_photographer: string;
          p_cover_photographer_url: string;
          p_cover_attribution: string;
        };
        Returns: {
          id: string;
          cover_image_url: string;
          cover_image_provider: string;
          cover_image_id: string;
          cover_photographer: string;
          cover_photographer_url: string;
          cover_attribution: string;
          cover_updated_at: string;
        }[];
      };
      find_travel_user: {
        Args: { p_handle: string };
        Returns: { user_id: string; username: string; avatar_url: string }[];
      };
      search_travel_profiles: {
        Args: { p_query: string; p_limit?: number };
        Returns: { user_id: string; username: string; avatar_url: string }[];
      };
      send_travel_friend_request: { Args: { p_handle: string }; Returns: Json };
      respond_travel_friend_request: { Args: { p_request_id: string; p_accept: boolean }; Returns: Json };
      remove_travel_friend: { Args: { p_friend_id: string }; Returns: undefined };
      save_business_transaction: {
        Args: {
          p_transaction_id: string | null; p_business_id: string; p_title: string; p_kind: string;
          p_date: string; p_contact_id: string | null; p_discount: number; p_note: string;
          p_original_amount: number; p_original_currency: string; p_exchange_rate: number;
          p_reporting_currency: string; p_lines: Json;
        };
        Returns: string;
      };
      cancel_business_transaction: { Args: { p_transaction_id: string }; Returns: undefined };
      record_business_payment: {
        Args: { p_transaction_id: string; p_amount: number; p_currency: string; p_exchange_rate: number; p_date: string; p_method: string; p_note: string };
        Returns: string;
      };
      adjust_business_stock: {
        Args: { p_item_id: string; p_new_quantity: number; p_movement_type: string; p_reason: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

