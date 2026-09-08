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
      game_check_errors: {
        Row: {
          created_at: string
          draw_id: string | null
          error_type: string
          game_id: string | null
          id: string
          job_id: string | null
          message: string
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          draw_id?: string | null
          error_type: string
          game_id?: string | null
          id?: string
          job_id?: string | null
          message: string
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          draw_id?: string | null
          error_type?: string
          game_id?: string | null
          id?: string
          job_id?: string | null
          message?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_check_errors_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_check_errors_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "generated_games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_check_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          draw_id: string
          failed: number
          finished_at: string | null
          id: string
          last_activity_at: string | null
          last_error: string | null
          last_game_id: string | null
          locked_at: string | null
          prized: number
          processed: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draw_id: string
          failed?: number
          finished_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_game_id?: string | null
          locked_at?: string | null
          prized?: number
          processed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draw_id?: string
          failed?: number
          finished_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_game_id?: string | null
          locked_at?: string | null
          prized?: number
          processed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_check_jobs_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      game_check_results: {
        Row: {
          amount_pending: boolean
          calculation_version: number
          checked_at: string
          contest_number: number
          created_at: string
          draw_id: string
          game_id: string
          hits: number
          id: string
          is_prized: boolean
          matched_numbers: number[]
          prize_label: string | null
          prize_tier_hits: number | null
          source_updated_at: string | null
          total_prize: number | null
          updated_at: string
        }
        Insert: {
          amount_pending?: boolean
          calculation_version?: number
          checked_at?: string
          contest_number: number
          created_at?: string
          draw_id: string
          game_id: string
          hits: number
          id?: string
          is_prized?: boolean
          matched_numbers?: number[]
          prize_label?: string | null
          prize_tier_hits?: number | null
          source_updated_at?: string | null
          total_prize?: number | null
          updated_at?: string
        }
        Update: {
          amount_pending?: boolean
          calculation_version?: number
          checked_at?: string
          contest_number?: number
          created_at?: string
          draw_id?: string
          game_id?: string
          hits?: number
          id?: string
          is_prized?: boolean
          matched_numbers?: number[]
          prize_label?: string | null
          prize_tier_hits?: number | null
          source_updated_at?: string | null
          total_prize?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_check_results_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_check_results_game_id_fkey"
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
      game_prize_breakdown: {
        Row: {
          check_result_id: string
          created_at: string
          draw_prize_id: string | null
          hits_required: number
          id: string
          prize_per_combination: number | null
          tier: string
          total_for_tier: number | null
          winning_combinations: number
        }
        Insert: {
          check_result_id: string
          created_at?: string
          draw_prize_id?: string | null
          hits_required: number
          id?: string
          prize_per_combination?: number | null
          tier: string
          total_for_tier?: number | null
          winning_combinations: number
        }
        Update: {
          check_result_id?: string
          created_at?: string
          draw_prize_id?: string | null
          hits_required?: number
          id?: string
          prize_per_combination?: number | null
          tier?: string
          total_for_tier?: number | null
          winning_combinations?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_prize_breakdown_check_result_id_fkey"
            columns: ["check_result_id"]
            isOneToOne: false
            referencedRelation: "game_check_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_prize_breakdown_draw_prize_id_fkey"
            columns: ["draw_prize_id"]
            isOneToOne: false
            referencedRelation: "draw_prizes"
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
          generation_constraints: Json | null
          generation_rules_version: number | null
          hits: number | null
          id: string
          image_path: string | null
          lottery_id: string
          notes: string | null
          numbers_count: number
          pool_id: string | null
          prize_amount: number | null
          sequence_number: number | null
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
          generation_constraints?: Json | null
          generation_rules_version?: number | null
          hits?: number | null
          id?: string
          image_path?: string | null
          lottery_id: string
          notes?: string | null
          numbers_count: number
          pool_id?: string | null
          prize_amount?: number | null
          sequence_number?: number | null
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
          generation_constraints?: Json | null
          generation_rules_version?: number | null
          hits?: number | null
          id?: string
          image_path?: string | null
          lottery_id?: string
          notes?: string | null
          numbers_count?: number
          pool_id?: string | null
          prize_amount?: number | null
          sequence_number?: number | null
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
      pool_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          pool_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          pool_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_events_pool_id_fkey"
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
          adjustment_reason: string | null
          amount_adjustment: number
          amount_due: number
          cancelled_at: string | null
          created_at: string
          eligible_for_prize_share: boolean
          id: string
          ineligible_reason: string | null
          name: string
          notes: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          pool_id: string
          quotas: number
          status: Database["public"]["Enums"]["participant_status"]
          total_paid: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adjustment_reason?: string | null
          amount_adjustment?: number
          amount_due?: number
          cancelled_at?: string | null
          created_at?: string
          eligible_for_prize_share?: boolean
          id?: string
          ineligible_reason?: string | null
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pool_id: string
          quotas?: number
          status?: Database["public"]["Enums"]["participant_status"]
          total_paid?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adjustment_reason?: string | null
          amount_adjustment?: number
          amount_due?: number
          cancelled_at?: string | null
          created_at?: string
          eligible_for_prize_share?: boolean
          id?: string
          ineligible_reason?: string | null
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          pool_id?: string
          quotas?: number
          status?: Database["public"]["Enums"]["participant_status"]
          total_paid?: number
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
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          method_description: string | null
          notes: string | null
          paid_at: string | null
          participant_id: string
          pool_id: string
        }
        Insert: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          method_description?: string | null
          notes?: string | null
          paid_at?: string | null
          participant_id: string
          pool_id: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          method_description?: string | null
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
      pool_prize_distributions: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          calculation_version: number
          confirmed_at: string | null
          created_at: string
          id: string
          pool_id: string
          rateable_prize: number
          rounding_remainder: number
          source_hash: string
          status: Database["public"]["Enums"]["distribution_status"]
          total_eligible_quotas: number
          total_prize: number
          updated_at: string
          value_per_quota: number
          version: number
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_version?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          pool_id: string
          rateable_prize?: number
          rounding_remainder?: number
          source_hash: string
          status?: Database["public"]["Enums"]["distribution_status"]
          total_eligible_quotas?: number
          total_prize?: number
          updated_at?: string
          value_per_quota?: number
          version: number
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          calculation_version?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          pool_id?: string
          rateable_prize?: number
          rounding_remainder?: number
          source_hash?: string
          status?: Database["public"]["Enums"]["distribution_status"]
          total_eligible_quotas?: number
          total_prize?: number
          updated_at?: string
          value_per_quota?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_prize_distributions_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_prize_participants: {
        Row: {
          created_at: string
          distribution_id: string
          eligible_quotas: number
          id: string
          participant_id: string
          payment_status_at_calc: Database["public"]["Enums"]["payment_status"]
          rounding_adjustment: number
          share_amount: number
          status: string
        }
        Insert: {
          created_at?: string
          distribution_id: string
          eligible_quotas: number
          id?: string
          participant_id: string
          payment_status_at_calc: Database["public"]["Enums"]["payment_status"]
          rounding_adjustment?: number
          share_amount: number
          status?: string
        }
        Update: {
          created_at?: string
          distribution_id?: string
          eligible_quotas?: number
          id?: string
          participant_id?: string
          payment_status_at_calc?: Database["public"]["Enums"]["payment_status"]
          rounding_adjustment?: number
          share_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_prize_participants_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "pool_prize_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_prize_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "pool_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          contest_id: string | null
          contest_number: number | null
          contest_number_planned: number | null
          created_at: string
          draw_date: string | null
          draw_date_planned: string | null
          id: string
          is_public: boolean
          lottery_id: string
          name: string
          notes: string | null
          owner_id: string
          payment_deadline: string | null
          public_token: string | null
          quota_value: number
          reopened_at: string | null
          status: Database["public"]["Enums"]["pool_status"]
          total_quotas: number | null
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contest_id?: string | null
          contest_number?: number | null
          contest_number_planned?: number | null
          created_at?: string
          draw_date?: string | null
          draw_date_planned?: string | null
          id?: string
          is_public?: boolean
          lottery_id: string
          name: string
          notes?: string | null
          owner_id: string
          payment_deadline?: string | null
          public_token?: string | null
          quota_value?: number
          reopened_at?: string | null
          status?: Database["public"]["Enums"]["pool_status"]
          total_quotas?: number | null
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          contest_id?: string | null
          contest_number?: number | null
          contest_number_planned?: number | null
          created_at?: string
          draw_date?: string | null
          draw_date_planned?: string | null
          id?: string
          is_public?: boolean
          lottery_id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          payment_deadline?: string | null
          public_token?: string | null
          quota_value?: number
          reopened_at?: string | null
          status?: Database["public"]["Enums"]["pool_status"]
          total_quotas?: number | null
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
      user_preferences: {
        Row: {
          created_at: string
          favorite_lottery_id: string | null
          followed_lottery_ids: string[] | null
          home_blocks: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_lottery_id?: string | null
          followed_lottery_ids?: string[] | null
          home_blocks?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_lottery_id?: string | null
          followed_lottery_ids?: string[] | null
          home_blocks?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_favorite_lottery_id_fkey"
            columns: ["favorite_lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
        ]
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
      apply_game_check: {
        Args: { _draw_id: string; _game_id: string; _payload: Json }
        Returns: string
      }
      can_read_game: { Args: { _game_id: string }; Returns: boolean }
      claim_check_job: {
        Args: { _job_id: string; _stale_after?: string }
        Returns: boolean
      }
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
      log_pool_event: {
        Args: {
          _description: string
          _event_type: string
          _metadata?: Json
          _pool_id: string
        }
        Returns: undefined
      }
      lottery_combination_stats: {
        Args: { _lottery_slug: string; _numbers: number[]; _window?: number }
        Returns: Json
      }
      lottery_number_statistics: {
        Args: { _lottery_slug: string; _max_contest?: number; _window?: number }
        Returns: Json
      }
      mark_games_awaiting_check: { Args: { _draw_id: string }; Returns: number }
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
      pool_add_participant: {
        Args: {
          _adjustment?: number
          _adjustment_reason?: string
          _method?: string
          _method_description?: string
          _name: string
          _notes?: string
          _paid_at?: string
          _payment_amount?: number
          _payment_mode?: string
          _phone?: string
          _pool_id: string
          _quotas?: number
        }
        Returns: string
      }
      pool_attach_game: {
        Args: { _game_id: string; _pool_id: string }
        Returns: string
      }
      pool_calculate_distribution: {
        Args: { _pool_id: string }
        Returns: string
      }
      pool_cancel_participant: {
        Args: { _participant_id: string; _reason?: string }
        Returns: undefined
      }
      pool_cancel_payment: {
        Args: { _payment_id: string; _reason?: string }
        Returns: undefined
      }
      pool_confirm_distribution: {
        Args: { _distribution_id: string }
        Returns: undefined
      }
      pool_detach_game: {
        Args: { _game_id: string; _pool_id: string }
        Returns: undefined
      }
      pool_outdate_distributions: {
        Args: { _pool_id: string; _reason?: string }
        Returns: undefined
      }
      pool_prize_total: { Args: { _pool_id: string }; Returns: number }
      pool_public_summary: { Args: { _token: string }; Returns: Json }
      pool_register_payment:
        | {
            Args: {
              _allow_overpay?: boolean
              _amount: number
              _method?: string
              _notes?: string
              _paid_at?: string
              _participant_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _allow_overpay?: boolean
              _amount: number
              _method?: string
              _method_description?: string
              _notes?: string
              _paid_at?: string
              _participant_id: string
            }
            Returns: string
          }
      pool_set_participant_eligibility: {
        Args: { _eligible: boolean; _participant_id: string; _reason?: string }
        Returns: undefined
      }
      pool_set_public: {
        Args: { _enabled: boolean; _pool_id: string }
        Returns: string
      }
      pool_set_status: {
        Args: {
          _pool_id: string
          _reason?: string
          _status: Database["public"]["Enums"]["pool_status"]
        }
        Returns: Database["public"]["Enums"]["pool_status"]
      }
      pool_update_details: {
        Args: { _patch: Json; _pool_id: string }
        Returns: undefined
      }
      pool_update_participant: {
        Args: { _participant_id: string; _patch: Json }
        Returns: undefined
      }
      recalc_participant_payment: {
        Args: { _participant_id: string }
        Returns: undefined
      }
      search_draws: {
        Args: {
          _contest?: number
          _date_from?: string
          _date_to?: string
          _lottery_slug?: string
          _numbers?: number[]
          _page?: number
          _page_size?: number
          _situation?: string
          _sort?: string
        }
        Returns: Json
      }
      set_manual_game_status: {
        Args: {
          _game_id: string
          _status: Database["public"]["Enums"]["game_status"]
        }
        Returns: Database["public"]["Enums"]["game_status"]
      }
    }
    Enums: {
      app_role: "USER" | "ADMIN"
      distribution_status: "CALCULATED" | "CONFIRMED" | "OUTDATED"
      feature_status: "ACTIVE" | "BETA" | "MAINTENANCE" | "DISABLED"
      game_status:
        | "PLANNED"
        | "BET"
        | "RECEIPTED"
        | "AWAITING_DRAW"
        | "AWAITING_CHECK"
        | "CHECKED"
        | "PRIZED"
        | "NOT_PRIZED"
      participant_status: "ACTIVE" | "CANCELLED"
      payment_status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED"
      pool_status:
        | "FORMING"
        | "OPEN"
        | "CLOSED"
        | "AWAITING_DRAW"
        | "AWAITING_CHECK"
        | "CHECKED"
        | "PRIZED"
        | "FINISHED"
        | "CANCELLED"
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
      distribution_status: ["CALCULATED", "CONFIRMED", "OUTDATED"],
      feature_status: ["ACTIVE", "BETA", "MAINTENANCE", "DISABLED"],
      game_status: [
        "PLANNED",
        "BET",
        "RECEIPTED",
        "AWAITING_DRAW",
        "AWAITING_CHECK",
        "CHECKED",
        "PRIZED",
        "NOT_PRIZED",
      ],
      participant_status: ["ACTIVE", "CANCELLED"],
      payment_status: ["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"],
      pool_status: [
        "FORMING",
        "OPEN",
        "CLOSED",
        "AWAITING_DRAW",
        "AWAITING_CHECK",
        "CHECKED",
        "PRIZED",
        "FINISHED",
        "CANCELLED",
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
