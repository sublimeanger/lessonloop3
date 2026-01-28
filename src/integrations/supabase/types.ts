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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_action_proposals: {
        Row: {
          conversation_id: string | null
          created_at: string
          executed_at: string | null
          id: string
          org_id: string
          proposal: Json
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          org_id: string
          proposal: Json
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          org_id?: string
          proposal?: Json
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_proposals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          org_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interaction_metrics: {
        Row: {
          action_executed: boolean | null
          action_proposed: boolean | null
          conversation_id: string | null
          created_at: string
          feedback: string | null
          id: string
          message_id: string | null
          org_id: string
          response_time_ms: number | null
          user_id: string
        }
        Insert: {
          action_executed?: boolean | null
          action_proposed?: boolean | null
          conversation_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          message_id?: string | null
          org_id: string
          response_time_ms?: number | null
          user_id: string
        }
        Update: {
          action_executed?: boolean | null
          action_proposed?: boolean | null
          conversation_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          message_id?: string | null
          org_id?: string
          response_time_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interaction_metrics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_metrics_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          cancellation_reason: string | null
          id: string
          lesson_id: string
          org_id: string
          recorded_at: string
          recorded_by: string
          student_id: string
        }
        Insert: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          cancellation_reason?: string | null
          id?: string
          lesson_id: string
          org_id: string
          recorded_at?: string
          recorded_by: string
          student_id: string
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          cancellation_reason?: string | null
          id?: string
          lesson_id?: string
          org_id?: string
          recorded_at?: string
          recorded_by?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time_local: string
          id: string
          org_id: string
          start_time_local: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time_local: string
          id?: string
          org_id: string
          start_time_local: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time_local?: string
          id?: string
          org_id?: string
          start_time_local?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_templates: {
        Row: {
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          is_available: boolean
          org_id: string
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          is_available?: boolean
          org_id: string
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          is_available?: boolean
          org_id?: string
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          org_id: string
          run_type: Database["public"]["Enums"]["billing_run_type"]
          start_date: string
          status: Database["public"]["Enums"]["billing_run_status"]
          summary: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          org_id: string
          run_type?: Database["public"]["Enums"]["billing_run_type"]
          start_date: string
          status?: Database["public"]["Enums"]["billing_run_status"]
          summary?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          org_id?: string
          run_type?: Database["public"]["Enums"]["billing_run_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["billing_run_status"]
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_dates: {
        Row: {
          applies_to_all_locations: boolean
          created_at: string
          created_by: string
          date: string
          id: string
          location_id: string | null
          org_id: string
          reason: string
        }
        Insert: {
          applies_to_all_locations?: boolean
          created_at?: string
          created_by: string
          date: string
          id?: string
          location_id?: string | null
          org_id: string
          reason: string
        }
        Update: {
          applies_to_all_locations?: boolean
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          location_id?: string | null
          org_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "closure_dates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_dates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          org_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_minor: number
          calculation_notes: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          linked_lesson_id: string | null
          org_id: string
          quantity: number
          source_rate_card_id: string | null
          student_id: string | null
          unit_price_minor: number
        }
        Insert: {
          amount_minor: number
          calculation_notes?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          linked_lesson_id?: string | null
          org_id: string
          quantity?: number
          source_rate_card_id?: string | null
          student_id?: string | null
          unit_price_minor: number
        }
        Update: {
          amount_minor?: number
          calculation_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          linked_lesson_id?: string | null
          org_id?: string
          quantity?: number
          source_rate_card_id?: string | null
          student_id?: string | null
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_linked_lesson_id_fkey"
            columns: ["linked_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_source_rate_card_id_fkey"
            columns: ["source_rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          credit_applied_minor: number
          currency_code: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          org_id: string
          payer_guardian_id: string | null
          payer_student_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          credit_applied_minor?: number
          currency_code?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          org_id: string
          payer_guardian_id?: string | null
          payer_student_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          credit_applied_minor?: number
          currency_code?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          payer_guardian_id?: string | null
          payer_student_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payer_guardian_id_fkey"
            columns: ["payer_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payer_student_id_fkey"
            columns: ["payer_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_participants: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          org_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          org_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          org_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_participants_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_participants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          end_at: string
          id: string
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          location_id: string | null
          notes_private: string | null
          notes_shared: string | null
          online_meeting_url: string | null
          org_id: string
          recurrence_id: string | null
          room_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          teacher_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          end_at: string
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          location_id?: string | null
          notes_private?: string | null
          notes_shared?: string | null
          online_meeting_url?: string | null
          org_id: string
          recurrence_id?: string | null
          room_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          teacher_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          end_at?: string
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          location_id?: string | null
          notes_private?: string | null
          notes_shared?: string | null
          online_meeting_url?: string | null
          org_id?: string
          recurrence_id?: string | null
          room_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          teacher_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrence_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          id: string
          is_primary: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          name: string
          notes: string | null
          org_id: string
          parent_reschedule_policy_override: string | null
          postcode: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          name: string
          notes?: string | null
          org_id: string
          parent_reschedule_policy_override?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          name?: string
          notes?: string | null
          org_id?: string
          parent_reschedule_policy_override?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      make_up_credits: {
        Row: {
          created_at: string
          created_by: string | null
          credit_value_minor: number
          expires_at: string | null
          id: string
          issued_at: string
          issued_for_lesson_id: string | null
          notes: string | null
          org_id: string
          redeemed_at: string | null
          redeemed_lesson_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_value_minor?: number
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_for_lesson_id?: string | null
          notes?: string | null
          org_id: string
          redeemed_at?: string | null
          redeemed_lesson_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_value_minor?: number
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_for_lesson_id?: string | null
          notes?: string | null
          org_id?: string
          redeemed_at?: string | null
          redeemed_lesson_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "make_up_credits_issued_for_lesson_id_fkey"
            columns: ["issued_for_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_credits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_credits_redeemed_lesson_id_fkey"
            columns: ["redeemed_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          body: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          message_type: string
          org_id: string
          read_at: string | null
          recipient_email: string
          recipient_id: string | null
          recipient_name: string | null
          recipient_type: string | null
          related_id: string | null
          sender_user_id: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_type: string
          org_id: string
          read_at?: string | null
          recipient_email: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string | null
          related_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_type?: string
          org_id?: string
          read_at?: string | null
          recipient_email?: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string | null
          related_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_requests: {
        Row: {
          admin_response: string | null
          created_at: string
          guardian_id: string
          id: string
          lesson_id: string | null
          message: string
          org_id: string
          request_type: string
          responded_at: string | null
          responded_by: string | null
          status: string
          student_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          guardian_id: string
          id?: string
          lesson_id?: string | null
          message: string
          org_id: string
          request_type: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          student_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          guardian_id?: string
          id?: string
          lesson_id?: string | null
          message?: string
          org_id?: string
          request_type?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          student_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_requests_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          name: string
          org_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_invoice_reminders: boolean
          email_lesson_reminders: boolean
          email_marketing: boolean
          email_payment_receipts: boolean
          id: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_invoice_reminders?: boolean
          email_lesson_reminders?: boolean
          email_marketing?: boolean
          email_payment_receipts?: boolean
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_invoice_reminders?: boolean
          email_lesson_reminders?: boolean
          email_marketing?: boolean
          email_payment_receipts?: boolean
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address: string | null
          auto_pause_lessons_after_days: number | null
          billing_approach: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures: boolean
          buffer_minutes_between_locations: number | null
          cancellation_notice_hours: number
          country_code: string
          created_at: string
          created_by: string
          currency_code: string
          default_lesson_length_mins: number
          default_payment_terms_days: number | null
          id: string
          invoice_footer_note: string | null
          invoice_from_address_line1: string | null
          invoice_from_address_line2: string | null
          invoice_from_city: string | null
          invoice_from_country: string | null
          invoice_from_name: string | null
          invoice_from_postcode: string | null
          logo_url: string | null
          max_students: number
          max_teachers: number
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          overdue_reminder_days: number[] | null
          parent_reschedule_policy: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          timezone: string
          trial_ends_at: string | null
          vat_enabled: boolean
          vat_rate: number
          vat_registration_number: string | null
        }
        Insert: {
          address?: string | null
          auto_pause_lessons_after_days?: number | null
          billing_approach?: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures?: boolean
          buffer_minutes_between_locations?: number | null
          cancellation_notice_hours?: number
          country_code?: string
          created_at?: string
          created_by: string
          currency_code?: string
          default_lesson_length_mins?: number
          default_payment_terms_days?: number | null
          id?: string
          invoice_footer_note?: string | null
          invoice_from_address_line1?: string | null
          invoice_from_address_line2?: string | null
          invoice_from_city?: string | null
          invoice_from_country?: string | null
          invoice_from_name?: string | null
          invoice_from_postcode?: string | null
          logo_url?: string | null
          max_students?: number
          max_teachers?: number
          name: string
          org_type?: Database["public"]["Enums"]["org_type"]
          overdue_reminder_days?: number[] | null
          parent_reschedule_policy?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string | null
          vat_enabled?: boolean
          vat_rate?: number
          vat_registration_number?: string | null
        }
        Update: {
          address?: string | null
          auto_pause_lessons_after_days?: number | null
          billing_approach?: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures?: boolean
          buffer_minutes_between_locations?: number | null
          cancellation_notice_hours?: number
          country_code?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          default_lesson_length_mins?: number
          default_payment_terms_days?: number | null
          id?: string
          invoice_footer_note?: string | null
          invoice_from_address_line1?: string | null
          invoice_from_address_line2?: string | null
          invoice_from_city?: string | null
          invoice_from_country?: string | null
          invoice_from_name?: string | null
          invoice_from_postcode?: string | null
          logo_url?: string | null
          max_students?: number
          max_teachers?: number
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          overdue_reminder_days?: number[] | null
          parent_reschedule_policy?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string | null
          vat_enabled?: boolean
          vat_rate?: number
          vat_registration_number?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          paid_at: string
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          org_id: string
          paid_at?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          org_id?: string
          paid_at?: string
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_assignments: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          org_id: string
          start_date: string
          status: string
          student_id: string
          target_days_per_week: number | null
          target_minutes_per_day: number | null
          teacher_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          org_id: string
          start_date?: string
          status?: string
          student_id: string
          target_days_per_week?: number | null
          target_minutes_per_day?: number | null
          teacher_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          org_id?: string
          start_date?: string
          status?: string
          student_id?: string
          target_days_per_week?: number | null
          target_minutes_per_day?: number | null
          teacher_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_logs: {
        Row: {
          assignment_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          logged_by_user_id: string
          notes: string | null
          org_id: string
          practice_date: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          student_id: string
          teacher_feedback: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          logged_by_user_id: string
          notes?: string | null
          org_id: string
          practice_date?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          student_id: string
          teacher_feedback?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          logged_by_user_id?: string
          notes?: string | null
          org_id?: string
          practice_date?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          student_id?: string
          teacher_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "practice_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_streaks: {
        Row: {
          current_streak: number
          id: string
          last_practice_date: string | null
          longest_streak: number
          org_id: string
          streak_started_at: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_practice_date?: string | null
          longest_streak?: number
          org_id: string
          streak_started_at?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_practice_date?: string | null
          longest_streak?: number
          org_id?: string
          streak_started_at?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_streaks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          current_org_id: string | null
          email: string | null
          first_run_completed: boolean | null
          first_run_path: string | null
          full_name: string | null
          has_completed_onboarding: boolean
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          first_run_completed?: boolean | null
          first_run_path?: string | null
          full_name?: string | null
          has_completed_onboarding?: boolean
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          first_run_completed?: boolean | null
          first_run_path?: string | null
          full_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_org_id_fkey"
            columns: ["current_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          created_at: string
          currency_code: string
          duration_mins: number
          id: string
          is_default: boolean
          name: string
          org_id: string
          rate_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          duration_mins?: number
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          rate_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          duration_mins?: number
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          rate_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          created_at: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      recurrence_rules: {
        Row: {
          created_at: string
          days_of_week: number[]
          end_date: string | null
          exception_dates: string[] | null
          id: string
          interval_weeks: number
          org_id: string
          pattern_type: Database["public"]["Enums"]["recurrence_pattern"]
          start_date: string
          timezone: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          exception_dates?: string[] | null
          id?: string
          interval_weeks?: number
          org_id: string
          pattern_type?: Database["public"]["Enums"]["recurrence_pattern"]
          start_date: string
          timezone?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          exception_dates?: string[] | null
          id?: string
          interval_weeks?: number
          org_id?: string
          pattern_type?: Database["public"]["Enums"]["recurrence_pattern"]
          start_date?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_shares: {
        Row: {
          id: string
          org_id: string
          resource_id: string
          shared_at: string
          shared_by: string
          student_id: string
        }
        Insert: {
          id?: string
          org_id: string
          resource_id: string
          shared_at?: string
          shared_by: string
          student_id: string
        }
        Update: {
          id?: string
          org_id?: string
          resource_id?: string
          shared_at?: string
          shared_by?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_shares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_shares_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_shares_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id: string
          org_id: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id?: string
          org_id: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          location_id: string
          max_capacity: number | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id: string
          max_capacity?: number | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id?: string
          max_capacity?: number | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency_code: string
          expires_at: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          org_id: string
          payer_email: string | null
          payer_user_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          expires_at?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          org_id: string
          payer_email?: string | null
          payer_user_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          expires_at?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          org_id?: string
          payer_email?: string | null
          payer_user_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_checkout_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          is_primary_payer: boolean
          org_id: string
          receives_billing: boolean | null
          receives_practice: boolean | null
          receives_schedule: boolean | null
          relationship: Database["public"]["Enums"]["relationship_type"]
          student_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          is_primary_payer?: boolean
          org_id: string
          receives_billing?: boolean | null
          receives_practice?: boolean | null
          receives_schedule?: boolean | null
          relationship?: Database["public"]["Enums"]["relationship_type"]
          student_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary_payer?: boolean
          org_id?: string
          receives_billing?: boolean | null
          receives_practice?: boolean | null
          receives_schedule?: boolean | null
          relationship?: Database["public"]["Enums"]["relationship_type"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teacher_assignments: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          org_id: string
          student_id: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id: string
          student_id: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          student_id?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          default_location_id: string | null
          default_rate_card_id: string | null
          default_teacher_user_id: string | null
          deleted_at: string | null
          dob: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          org_id: string
          phone: string | null
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_location_id?: string | null
          default_rate_card_id?: string | null
          default_teacher_user_id?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_location_id?: string | null
          default_rate_card_id?: string | null
          default_teacher_user_id?: string | null
          deleted_at?: string | null
          dob?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_default_rate_card_id_fkey"
            columns: ["default_rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          bio: string | null
          created_at: string
          default_lesson_length_mins: number
          display_name: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          instruments: string[]
          org_id: string
          pay_rate_type: Database["public"]["Enums"]["pay_rate_type"] | null
          pay_rate_value: number | null
          payroll_notes: string | null
          teaching_address: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          default_lesson_length_mins?: number
          display_name?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          instruments?: string[]
          org_id: string
          pay_rate_type?: Database["public"]["Enums"]["pay_rate_type"] | null
          pay_rate_value?: number | null
          payroll_notes?: string | null
          teaching_address?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          default_lesson_length_mins?: number
          display_name?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          instruments?: string[]
          org_id?: string
          pay_rate_type?: Database["public"]["Enums"]["pay_rate_type"] | null
          pay_rate_value?: number | null
          payroll_notes?: string | null
          teaching_address?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_blocks: {
        Row: {
          created_at: string
          end_at: string
          id: string
          org_id: string
          reason: string | null
          start_at: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          org_id: string
          reason?: string | null
          start_at: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          start_at?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_blocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
          role: Database["public"]["Enums"]["app_role"]
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
      teacher_profiles_public: {
        Row: {
          bio: string | null
          created_at: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          id: string | null
          instruments: string[] | null
          org_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string | null
          instruments?: string[] | null
          org_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          id?: string | null
          instruments?: string[] | null
          org_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymise_guardian: { Args: { guardian_id: string }; Returns: undefined }
      anonymise_student: { Args: { student_id: string }; Returns: undefined }
      can_edit_lesson: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests: number
          _user_id: string
          _window_minutes: number
        }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      generate_invoice_number: { Args: { _org_id: string }; Returns: string }
      get_guardian_ids_for_user: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_student_ids_for_parent: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_teacher: {
        Args: { _org_id: string; _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_invoice_payer: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      is_lesson_teacher: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_finance_team: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_scheduler: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_staff: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      reset_stale_streaks: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "teacher" | "finance" | "parent"
      attendance_status:
        | "present"
        | "absent"
        | "late"
        | "cancelled_by_teacher"
        | "cancelled_by_student"
      billing_approach: "monthly" | "termly" | "custom"
      billing_run_status: "pending" | "completed" | "failed"
      billing_run_type: "monthly" | "term" | "custom"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      employment_type: "employee" | "contractor"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      lesson_status: "scheduled" | "completed" | "cancelled"
      lesson_type: "private" | "group"
      location_type: "school" | "studio" | "home" | "online"
      membership_status: "active" | "invited" | "disabled"
      org_type: "solo_teacher" | "studio" | "academy" | "agency"
      pay_rate_type: "per_lesson" | "hourly" | "percentage"
      payment_method: "card" | "bank_transfer" | "cash" | "other"
      payment_provider: "stripe" | "manual"
      recurrence_pattern: "weekly"
      relationship_type: "mother" | "father" | "guardian" | "other"
      student_status: "active" | "inactive"
      subscription_plan:
        | "trial"
        | "solo_teacher"
        | "academy"
        | "agency"
        | "custom"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "paused"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "teacher", "finance", "parent"],
      attendance_status: [
        "present",
        "absent",
        "late",
        "cancelled_by_teacher",
        "cancelled_by_student",
      ],
      billing_approach: ["monthly", "termly", "custom"],
      billing_run_status: ["pending", "completed", "failed"],
      billing_run_type: ["monthly", "term", "custom"],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      employment_type: ["employee", "contractor"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      lesson_status: ["scheduled", "completed", "cancelled"],
      lesson_type: ["private", "group"],
      location_type: ["school", "studio", "home", "online"],
      membership_status: ["active", "invited", "disabled"],
      org_type: ["solo_teacher", "studio", "academy", "agency"],
      pay_rate_type: ["per_lesson", "hourly", "percentage"],
      payment_method: ["card", "bank_transfer", "cash", "other"],
      payment_provider: ["stripe", "manual"],
      recurrence_pattern: ["weekly"],
      relationship_type: ["mother", "father", "guardian", "other"],
      student_status: ["active", "inactive"],
      subscription_plan: [
        "trial",
        "solo_teacher",
        "academy",
        "agency",
        "custom",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "paused",
      ],
    },
  },
} as const
