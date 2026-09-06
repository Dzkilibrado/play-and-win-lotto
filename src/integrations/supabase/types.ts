export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      draw_numbers: {
        Row: {
          draw_id: string
          id: string
          number: number
          position: number
        }
        Insert: {
          draw_id: string
          id?: string
          number: number
          position?: number
        }
        Update: {
          draw_id?: string
          id?: string
          number?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "draw_numbers_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_prizes: {
        Row: {
          draw_id: string
          hits: number
          id: string
          prize_per_winner: number | null
          tier: string
          winners: number | null
        }
        Insert: {
          draw_id: string
          hits: number
          id?: string
          prize_per_winner?: number | null
          tier: string
          winners?: number | null
        }
        Update: {
          draw_id?: string
          hits?: number
          id?: string
          prize_per_winner?: number | null
          tier?: string
          winners?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draw_prizes_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          id: string
          key: string
          label: string
          status: Database["public"]["Enums"]["feature_status"]
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          label: string
          status?: Database["public"]["Enums"]["feature_status"]
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          label?: string
          status?: Database["public"]["Enums"]["feature_status"]
          updated_at?: string
        }
        Relationships: []
      }
      game_analysis: {
        Row: {
          column_distribution: Json | null
          computed_at: string
          even_count: number | null
          fibonacci_count: number | null
          game_id: string
          id: string
          max_sequence: number | null
          odd_count: number | null
          prime_count: number | null
          repeated_from_last: number | null
          row_distribution: Json | null
          sum_total: number | null
        }
        Insert: {
          column_distribution?: Json | null
          computed_at?: string
          even_count?: number | null
          fibonacci_count?: number | null
          game_id: string
          id?: string
          max_sequence?: number | null
          odd_count?: number | null
          prime_count?: number | null
          repeated_from_last?: number | null
          row_distribution?: Json | null
          sum_total?: number | null
        }
        Update: {
          column_distribution?: Json | null
          computed_at?: string
          even_count?: number | null
          fibonacci_count?: number | null
          game_id?: string
          id?: string
          max_sequence?: number | null
          odd_count?: number | null
          prime_count?: number | null
          repeated_from_last?: number | null
          row_distribution?: Json | null
          sum_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_analysis_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "generated_games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_numbers: {
        Row: {
          game_id: string
          id: string
          number: number
          position: number
        }
        Insert: {
          game_id: string
          id?: string
          number: number
          position?: number
        }
        Update: {
          game_id?: string
          id?: string
          number?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_numbers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "generated_games"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_games: {
        Row: {
          contest_number: number | null
          cost: number | null
          created_at: string
          draw_id: string | null
          hits: number | null
          id: string
          lottery_id: string
          notes: string | null
          numbers_count: number
          pool_id: string | null
          prize_amount: number | null
          source: string
          status: Database["public"]["Enums"]["game_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contest_number?: number | null
          cost?: number | null
          created_at?: string
          draw_id?: string | null
          hits?: number | null
          id?: string
          lottery_id: string
          notes?: string | null
          numbers_count: number
          pool_id?: string | null
          prize_amount?: number | null
          source?: string
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contest_number?: number | null
          cost?: number | null
          created_at?: string
          draw_id?: string | null
          hits?: number | null
          id?: string
          lottery_id?: string
          notes?: string | null
          numbers_count?: number
          pool_id?: string | null
          prize_amount?: number | null
          source?: string
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_games_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_games_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_games_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      lotteries: {
        Row: {
          base_selectable: number
          color_key: string
          created_at: string
          id: string
          is_active: boolean
          max_selectable: number
          min_selectable: number
          name: string
          short_name: string
          slug: string
          sort_order: number
          universe_max: number
          universe_min: number
          updated_at: string
        }
        Insert: {
          base_selectable: number
          color_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_selectable: number
          min_selectable: number
          name: string
          short_name: string
          slug: string
          sort_order?: number
          universe_max: number
          universe_min: number
          updated_at?: string
        }
        Update: {
          base_selectable?: number
          color_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_selectable?: number
          min_selectable?: number
          name?: string
          short_name?: string
          slug?: string
          sort_order?: number
          universe_max?: number
          universe_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      lottery_draws: {
        Row: {
          contest_number: number
          created_at: string
          draw_date: string | null
          draw_location: string | null
          estimated_next_prize: number | null
          id: string
          imported_at: string | null
          is_accumulated: boolean | null
          lottery_id: string
          main_prize: number | null
          next_contest_number: number | null
          next_draw_date: string | null
          revenue: number | null
          source: string | null
          source_updated_at: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          contest_number: number
          created_at?: string
          draw_date?: string | null
          draw_location?: string | null
          estimated_next_prize?: number | null
          id?: string
          imported_at?: string | null
          is_accumulated?: boolean | null
          lottery_id: string
          main_prize?: number | null
          next_contest_number?: number | null
          next_draw_date?: string | null
          revenue?: number | null
          source?: string | null
          source_updated_at?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          contest_number?: number
          created_at?: string
          draw_date?: string | null
          draw_location?: string | null
          estimated_next_prize?: number | null
          id?: string
          imported_at?: string | null
          is_accumulated?: boolean | null
          lottery_id?: string
          main_prize?: number | null
          next_contest_number?: number | null
          next_draw_date?: string | null
          revenue?: number | null
          source?: string | null
          source_updated_at?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_draws_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_prices: {
        Row: {
          combination_count: number
          created_at: string
          id: string
          is_active: boolean
          lottery_id: string
          numbers_selected: number
          price: number
          source: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          combination_count: number
          created_at?: string
          id?: string
          is_active?: boolean
          lottery_id: string
          numbers_selected: number
          price: number
          source?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          combination_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          lottery_id?: string
          numbers_selected?: number
          price?: number
          source?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_prices_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_prize_tiers: {
        Row: {
          hits: number
          id: string
          label: string
          lottery_id: string
          sort_order: number
        }
        Insert: {
          hits: number
          id?: string
          label: string
          lottery_id: string
          sort_order?: number
        }
        Update: {
          hits?: number
          id?: string
          label?: string
          lottery_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lottery_prize_tiers_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_sync_errors: {
        Row: {
          contest_number: number | null
          created_at: string
          error_type: string
          id: string
          job_id: string | null
          lottery_id: string
          message: string
          payload_summary: string | null
          resolved_at: string | null
        }
        Insert: {
          contest_number?: number | null
          created_at?: string
          error_type: string
          id?: string
          job_id?: string | null
          lottery_id: string
          message: string
          payload_summary?: string | null
          resolved_at?: string | null
        }
        Update: {
          contest_number?: number | null
          created_at?: string
          error_type?: string
          id?: string
          job_id?: string | null
          lottery_id?: string
          message?: string
          payload_summary?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_sync_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "lottery_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_sync_errors_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_sync_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          current_contest: number | null
          end_contest: number | null
          failed: number
          finished_at: string | null
          id: string
          inserted: number
          last_activity_at: string | null
          last_error: string | null
          locked_at: string | null
          lottery_id: string
          processed: number
          start_contest: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          type: Database["public"]["Enums"]["sync_job_type"]
          updated: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_contest?: number | null
          end_contest?: number | null
          failed?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          last_activity_at?: string | null
          last_error?: string | null
          locked_at?: string | null
          lottery_id: string
          processed?: number
          start_contest?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          type: Database["public"]["Enums"]["sync_job_type"]
          updated?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_contest?: number | null
          end_contest?: number | null
          failed?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          last_activity_at?: string | null
          last_error?: string | null
          locked_at?: string | null
          lottery_id?: string
          processed?: number
          start_contest?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          type?: Database["public"]["Enums"]["sync_job_type"]
          updated?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_sync_jobs_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pool_documents: {
        Row: {
          created_at: string
          file_size: number | null
          game_id: string | null
          id: string
          kind: string
          mime_type: string | null
          notes: string | null
          participant_id: string | null
          pool_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          game_id?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          notes?: string | null
          participant_id?: string | null
          pool_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number | null
          game_id?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          notes?: string | null
          participant_id?: string | null
          pool_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_documents_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "generated_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_documents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "pool_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_documents_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_games: {
        Row: {
          created_at: string
          game_id: string
          id: string
          pool_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          pool_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "generated_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_games_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_participants: {
        Row: {
          amount_due: number
          created_at: string
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          pool_id: string
          quotas: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_due?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pool_id: string
          quotas?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_due?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pool_id?: string
          quotas?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_participants_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          participant_id: string
          pool_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          participant_id: string
          pool_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          participant_id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_payments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "pool_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_payments_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          contest_id: string | null
          contest_number: number | null
          created_at: string
          draw_date: string | null
          id: string
          lottery_id: string
          name: string
          notes: string | null
          owner_id: string
          payment_deadline: string | null
          quota_value: number
          status: Database["public"]["Enums"]["pool_status"]
          total_quotas: number
          updated_at: string
        }
        Insert: {
          contest_id?: string | null
          contest_number?: number | null
          created_at?: string
          draw_date?: string | null
          id?: string
          lottery_id: string
          name: string
          notes?: string | null
          owner_id: string
          payment_deadline?: string | null
          quota_value?: number
          status?: Database["public"]["Enums"]["pool_status"]
          total_quotas?: number
          updated_at?: string
        }
        Update: {
          contest_id?: string | null
          contest_number?: number | null
          created_at?: string
          draw_date?: string | null
          id?: string
          lottery_id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          payment_deadline?: string | null
          quota_value?: number
          status?: Database["public"]["Enums"]["pool_status"]
          total_quotas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          theme_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_game: { Args: { _game_id: string }; Returns: boolean }
      claim_sync_job_batch: {
        Args: { _batch_size: number; _job_id: string; _stale_after?: string }
        Returns: {
          claim_end: number
          claim_start: number
          is_final: boolean
          job_id: string
          lottery_id: string
          resumed: boolean
        }[]
      }
      complete_sync_job_batch: {
        Args: {
          _failed: number
          _inserted: number
          _is_final: boolean
          _job_id: string
          _last_error?: string
          _processed: number
          _updated: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          current_contest: number | null
          end_contest: number | null
          failed: number
          finished_at: string | null
          id: string
          inserted: number
          last_activity_at: string | null
          last_error: string | null
          locked_at: string | null
          lottery_id: string
          processed: number
          start_contest: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          type: Database["public"]["Enums"]["sync_job_type"]
          updated: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lottery_sync_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pool_member: { Args: { _pool_id: string }; Returns: boolean }
      is_pool_owner: { Args: { _pool_id: string }; Returns: boolean }
      owns_game: { Args: { _game_id: string }; Returns: boolean }
      persist_official_draw: {
        Args: {
          _contest_number: number
          _draw: Json
          _lottery_id: string
          _numbers: Json
          _prizes: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "USER" | "ADMIN"
      feature_status: "ACTIVE" | "BETA" | "MAINTENANCE" | "DISABLED"
      game_status:
        | "PLANNED"
        | "BET"
        | "RECEIPTED"
        | "AWAITING_DRAW"
        | "CHECKED"
        | "PRIZED"
        | "NOT_PRIZED"
      payment_status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"
      pool_status:
        | "FORMING"
        | "OPEN"
        | "CLOSED"
        | "AWAITING_DRAW"
        | "CHECKED"
        | "PRIZED"
        | "FINISHED"
      sync_job_status:
        | "pending"
        | "running"
        | "completed"
        | "completed_with_errors"
        | "failed"
      sync_job_type: "LATEST" | "RECENT" | "HISTORICAL" | "REPROCESS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["USER", "ADMIN"],
      feature_status: ["ACTIVE", "BETA", "MAINTENANCE", "DISABLED"],
      game_status: [
        "PLANNED",
        "BET",
        "RECEIPTED",
        "AWAITING_DRAW",
        "CHECKED",
        "PRIZED",
        "NOT_PRIZED",
      ],
      payment_status: ["PENDING", "PARTIAL", "PAID", "OVERDUE"],
      pool_status: [
        "FORMING",
        "OPEN",
        "CLOSED",
        "AWAITING_DRAW",
        "CHECKED",
        "PRIZED",
        "FINISHED",
      ],
      sync_job_status: [
        "pending",
        "running",
        "completed",
        "completed_with_errors",
        "failed",
      ],
      sync_job_type: ["LATEST", "RECENT", "HISTORICAL", "REPROCESS"],
    },
  },
} as const
