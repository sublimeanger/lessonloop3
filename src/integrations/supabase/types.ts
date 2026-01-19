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
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
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
          created_at: string
          description: string
          id: string
          invoice_id: string
          linked_lesson_id: string | null
          org_id: string
          quantity: number
          student_id: string | null
          unit_price_minor: number
        }
        Insert: {
          amount_minor: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          linked_lesson_id?: string | null
          org_id: string
          quantity?: number
          student_id?: string | null
          unit_price_minor: number
        }
        Update: {
          amount_minor?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          linked_lesson_id?: string | null
          org_id?: string
          quantity?: number
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
      message_log: {
        Row: {
          body: string
          created_at: string
          error_message: string | null
          id: string
          message_type: string
          org_id: string
          recipient_email: string
          recipient_name: string | null
          related_id: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_type: string
          org_id: string
          recipient_email: string
          recipient_name?: string | null
          related_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_type?: string
          org_id?: string
          recipient_email?: string
          recipient_name?: string | null
          related_id?: string | null
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
          billing_approach: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures: boolean
          country_code: string
          created_at: string
          created_by: string
          currency_code: string
          default_lesson_length_mins: number
          id: string
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          timezone: string
          vat_enabled: boolean
          vat_rate: number
          vat_registration_number: string | null
        }
        Insert: {
          billing_approach?: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures?: boolean
          country_code?: string
          created_at?: string
          created_by: string
          currency_code?: string
          default_lesson_length_mins?: number
          id?: string
          name: string
          org_type?: Database["public"]["Enums"]["org_type"]
          timezone?: string
          vat_enabled?: boolean
          vat_rate?: number
          vat_registration_number?: string | null
        }
        Update: {
          billing_approach?: Database["public"]["Enums"]["billing_approach"]
          block_scheduling_on_closures?: boolean
          country_code?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          default_lesson_length_mins?: number
          id?: string
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          timezone?: string
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
      profiles: {
        Row: {
          created_at: string
          current_org_id: string | null
          email: string | null
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
      recurrence_rules: {
        Row: {
          created_at: string
          days_of_week: number[]
          end_date: string | null
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
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          location_id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id?: string
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
      student_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          is_primary_payer: boolean
          org_id: string
          relationship: Database["public"]["Enums"]["relationship_type"]
          student_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          is_primary_payer?: boolean
          org_id: string
          relationship?: Database["public"]["Enums"]["relationship_type"]
          student_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary_payer?: boolean
          org_id?: string
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
      students: {
        Row: {
          created_at: string
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
      [_ in never]: never
    }
    Functions: {
      can_edit_lesson: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      generate_invoice_number: { Args: { _org_id: string }; Returns: string }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
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
      payment_method: "card" | "bank_transfer" | "cash" | "other"
      payment_provider: "stripe" | "manual"
      recurrence_pattern: "weekly"
      relationship_type: "mother" | "father" | "guardian" | "other"
      student_status: "active" | "inactive"
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
      payment_method: ["card", "bank_transfer", "cash", "other"],
      payment_provider: ["stripe", "manual"],
      recurrence_pattern: ["weekly"],
      relationship_type: ["mother", "father", "guardian", "other"],
      student_status: ["active", "inactive"],
    },
  },
} as const
