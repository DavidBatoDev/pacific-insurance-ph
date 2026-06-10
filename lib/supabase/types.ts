/**
 * Database types for the Supabase Postgres schema.
 *
 * PLACEHOLDER — this file is hand-written for now and only models the minimal
 * `clients` table used by the example repository. Replace its contents with the
 * real generated output once the hosted project + schema exist:
 *
 *   npx supabase login
 *   npx supabase gen types typescript \
 *     --project-id <project-ref> --schema public > lib/supabase/types.ts
 *
 * The generated `Database` type is what makes `supabase-js` queries type-safe.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
