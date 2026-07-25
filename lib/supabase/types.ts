// Generated via mcp__supabase__generate_typescript_types — do not edit by hand.
// Regenerate after applying a migration.

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
      activity_timeline: {
        Row: {
          activity_type: string
          actor_id: string | null
          client_visible: boolean
          created_at: string
          id: string
          metadata: Json | null
          scope_id: string
          scope_type: string
          summary: string
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          client_visible?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          scope_id: string
          scope_type: string
          summary: string
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          client_visible?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          scope_id?: string
          scope_type?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_timeline_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      add_ons: {
        Row: {
          created_at: string
          description: string | null
          eligibility_rule: string | null
          id: string
          name: string
          plan_option_id: string | null
          premium_rule: string | null
          product_version_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          eligibility_rule?: string | null
          id?: string
          name: string
          plan_option_id?: string | null
          premium_rule?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          eligibility_rule?: string | null
          id?: string
          name?: string
          plan_option_id?: string | null
          premium_rule?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_ons_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_ons_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_type: string
          assigned_user_id: string | null
          client_id: string
          created_at: string
          date_started: string | null
          date_submitted: string | null
          id: string
          notes: string | null
          pacific_cross_contact_id: string | null
          payment_proof_sent_date: string | null
          payment_received_date: string | null
          plan_option_id: string | null
          policy_id: string | null
          policy_issued_date: string | null
          product_version_id: string | null
          proposal_received_date: string | null
          proposal_sent_date: string | null
          reference_no: string | null
          status: string
          updated_at: string
          wizard_state: Json | null
        }
        Insert: {
          application_type?: string
          assigned_user_id?: string | null
          client_id: string
          created_at?: string
          date_started?: string | null
          date_submitted?: string | null
          id?: string
          notes?: string | null
          pacific_cross_contact_id?: string | null
          payment_proof_sent_date?: string | null
          payment_received_date?: string | null
          plan_option_id?: string | null
          policy_id?: string | null
          policy_issued_date?: string | null
          product_version_id?: string | null
          proposal_received_date?: string | null
          proposal_sent_date?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          wizard_state?: Json | null
        }
        Update: {
          application_type?: string
          assigned_user_id?: string | null
          client_id?: string
          created_at?: string
          date_started?: string | null
          date_submitted?: string | null
          id?: string
          notes?: string | null
          pacific_cross_contact_id?: string | null
          payment_proof_sent_date?: string | null
          payment_received_date?: string | null
          plan_option_id?: string | null
          policy_id?: string | null
          policy_issued_date?: string | null
          product_version_id?: string | null
          proposal_received_date?: string | null
          proposal_sent_date?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          wizard_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_pacific_cross_contact_id_fkey"
            columns: ["pacific_cross_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          previous_value: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount_approved: number | null
          amount_claimed: number | null
          claim_submitted_date: string | null
          claim_type: string | null
          client_id: string
          compliance_due_date: string | null
          compliance_required: boolean
          created_at: string
          currency: string | null
          first_layer_exhausted: boolean | null
          flexishield_payable_amount: number | null
          hmo_mbl_amount: number | null
          id: string
          incident_date: string | null
          notes: string | null
          outcome: string | null
          pacific_cross_contact_id: string | null
          policy_id: string | null
          reference_no: string | null
          remaining_eligible_expenses: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_approved?: number | null
          amount_claimed?: number | null
          claim_submitted_date?: string | null
          claim_type?: string | null
          client_id: string
          compliance_due_date?: string | null
          compliance_required?: boolean
          created_at?: string
          currency?: string | null
          first_layer_exhausted?: boolean | null
          flexishield_payable_amount?: number | null
          hmo_mbl_amount?: number | null
          id?: string
          incident_date?: string | null
          notes?: string | null
          outcome?: string | null
          pacific_cross_contact_id?: string | null
          policy_id?: string | null
          reference_no?: string | null
          remaining_eligible_expenses?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_approved?: number | null
          amount_claimed?: number | null
          claim_submitted_date?: string | null
          claim_type?: string | null
          client_id?: string
          compliance_due_date?: string | null
          compliance_required?: boolean
          created_at?: string
          currency?: string | null
          first_layer_exhausted?: boolean | null
          flexishield_payable_amount?: number | null
          hmo_mbl_amount?: number | null
          id?: string
          incident_date?: string | null
          notes?: string | null
          outcome?: string | null
          pacific_cross_contact_id?: string | null
          policy_id?: string | null
          reference_no?: string | null
          remaining_eligible_expenses?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_pacific_cross_contact_id_fkey"
            columns: ["pacific_cross_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          assigned_user_id: string | null
          client_type: string
          coverage_tier: string | null
          created_at: string
          date_of_birth: string | null
          do_not_contact: boolean
          early_payer: boolean
          email: string | null
          est_premium: number | null
          expected_close_date: string | null
          family_size: number | null
          first_name: string
          id: string
          last_name: string
          lead_source: string | null
          lead_stage: string | null
          lead_status: string | null
          lifecycle_stage: string
          mobile_number: string | null
          next_follow_up_date: string | null
          notes: string | null
          preferred_channel: string | null
          product_interest: string | null
          proposal_status: string | null
          reference_no: string | null
          status: string
          updated_at: string
          vip_status: boolean
        }
        Insert: {
          address?: string | null
          assigned_user_id?: string | null
          client_type?: string
          coverage_tier?: string | null
          created_at?: string
          date_of_birth?: string | null
          do_not_contact?: boolean
          early_payer?: boolean
          email?: string | null
          est_premium?: number | null
          expected_close_date?: string | null
          family_size?: number | null
          first_name: string
          id?: string
          last_name: string
          lead_source?: string | null
          lead_stage?: string | null
          lead_status?: string | null
          lifecycle_stage?: string
          mobile_number?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          preferred_channel?: string | null
          product_interest?: string | null
          proposal_status?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          vip_status?: boolean
        }
        Update: {
          address?: string | null
          assigned_user_id?: string | null
          client_type?: string
          coverage_tier?: string | null
          created_at?: string
          date_of_birth?: string | null
          do_not_contact?: boolean
          early_payer?: boolean
          email?: string | null
          est_premium?: number | null
          expected_close_date?: string | null
          family_size?: number | null
          first_name?: string
          id?: string
          last_name?: string
          lead_source?: string | null
          lead_stage?: string | null
          lead_status?: string | null
          lifecycle_stage?: string
          mobile_number?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          preferred_channel?: string | null
          product_interest?: string | null
          proposal_status?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          vip_status?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string
          currency: string | null
          estimated_amount: number | null
          follow_up_date: string | null
          id: string
          notes: string | null
          or_number: string | null
          pacific_cross_contact_id: string | null
          paid_date: string | null
          payment_id: string | null
          policy_id: string | null
          received_date: string | null
          updated_at: string
          voucher_status: string
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          estimated_amount?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          pacific_cross_contact_id?: string | null
          paid_date?: string | null
          payment_id?: string | null
          policy_id?: string | null
          received_date?: string | null
          updated_at?: string
          voucher_status?: string
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          estimated_amount?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          pacific_cross_contact_id?: string | null
          paid_date?: string | null
          payment_id?: string | null
          policy_id?: string | null
          received_date?: string | null
          updated_at?: string
          voucher_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_pacific_cross_contact_id_fkey"
            columns: ["pacific_cross_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          application_id: string | null
          channel: string | null
          claim_id: string | null
          client_id: string | null
          created_at: string
          delivery_status: string | null
          direction: string | null
          email_thread_id: string | null
          external_contact_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          policy_id: string | null
          reference_no: string | null
          related_user_id: string | null
          renewal_id: string | null
          subject: string | null
          summary: string | null
          travel_request_id: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          channel?: string | null
          claim_id?: string | null
          client_id?: string | null
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          email_thread_id?: string | null
          external_contact_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          policy_id?: string | null
          reference_no?: string | null
          related_user_id?: string | null
          renewal_id?: string | null
          subject?: string | null
          summary?: string | null
          travel_request_id?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          channel?: string | null
          claim_id?: string | null
          client_id?: string | null
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          email_thread_id?: string | null
          external_contact_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          policy_id?: string | null
          reference_no?: string | null
          related_user_id?: string | null
          renewal_id?: string | null
          subject?: string | null
          summary?: string | null
          travel_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          mobile_number: string | null
          notes: string | null
          policy_id: string | null
          primary_client_id: string
          relationship: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          mobile_number?: string | null
          notes?: string | null
          policy_id?: string | null
          primary_client_id: string
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          mobile_number?: string | null
          notes?: string | null
          policy_id?: string | null
          primary_client_id?: string
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependents_primary_client_id_fkey"
            columns: ["primary_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_rules: {
        Row: {
          applies_to: string | null
          created_at: string
          discount_type: string | null
          discount_value: number | null
          eligibility_rule: string | null
          id: string
          name: string
          plan_option_id: string | null
          product_version_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applies_to?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          eligibility_rule?: string | null
          id?: string
          name: string
          plan_option_id?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applies_to?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          eligibility_rule?: string | null
          id?: string
          name?: string
          plan_option_id?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_rules_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_rules_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_library: {
        Row: {
          created_at: string
          document_name: string
          document_type: string | null
          effective_date: string | null
          expiry_date: string | null
          file_path: string | null
          id: string
          notes: string | null
          product_version_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          product_version_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_library_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string | null
          claim_id: string | null
          client_id: string | null
          created_at: string
          document_type: string | null
          file_path: string | null
          id: string
          name: string
          notes: string | null
          policy_id: string | null
          reference_no: string | null
          renewal_id: string | null
          status: string
          travel_request_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
          visibility: string
        }
        Insert: {
          application_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          id?: string
          name: string
          notes?: string | null
          policy_id?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          application_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          id?: string
          name?: string
          notes?: string | null
          policy_id?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          product_version_id: string | null
          status: string
          subject: string | null
          template_name: string
          updated_at: string
          workflow_step_id: string | null
          workflow_template_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          product_version_id?: string | null
          status?: string
          subject?: string | null
          template_name: string
          updated_at?: string
          workflow_step_id?: string | null
          workflow_template_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          product_version_id?: string | null
          status?: string
          subject?: string | null
          template_name?: string
          updated_at?: string
          workflow_step_id?: string | null
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      external_contacts: {
        Row: {
          contact_type: string | null
          created_at: string
          department: string | null
          effective_date: string | null
          email: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          organization: string | null
          phone: string | null
          replacement_contact_id: string | null
          role: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_type?: string | null
          created_at?: string
          department?: string | null
          effective_date?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          replacement_contact_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_type?: string | null
          created_at?: string
          department?: string | null
          effective_date?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          replacement_contact_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_contacts_replacement_contact_id_fkey"
            columns: ["replacement_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_coverage: {
        Row: {
          client_id: string
          coverage_type: string | null
          created_at: string
          currency: string | null
          effective_date: string | null
          expiry_date: string | null
          id: string
          maximum_benefit_limit: number | null
          notes: string | null
          plan_name: string | null
          policy_id: string | null
          proof_document_id: string | null
          provider_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          coverage_type?: string | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          maximum_benefit_limit?: number | null
          notes?: string | null
          plan_name?: string | null
          policy_id?: string | null
          proof_document_id?: string | null
          provider_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          coverage_type?: string | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          maximum_benefit_limit?: number | null
          notes?: string | null
          plan_name?: string | null
          policy_id?: string | null
          proof_document_id?: string | null
          provider_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_coverage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_coverage_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_coverage_proof_document_id_fkey"
            columns: ["proof_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      group_accounts: {
        Row: {
          address: string | null
          assigned_user_id: string | null
          billing_cycle: string
          created_at: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          name: string
          notes: string | null
          policy_id: string | null
          premium_amount: number | null
          primary_contact_id: string | null
          product_version_id: string | null
          reference_no: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_user_id?: string | null
          billing_cycle?: string
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          name: string
          notes?: string | null
          policy_id?: string | null
          premium_amount?: number | null
          primary_contact_id?: string | null
          product_version_id?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_user_id?: string | null
          billing_cycle?: string
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          policy_id?: string | null
          premium_amount?: number | null
          primary_contact_id?: string | null
          product_version_id?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_accounts_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_accounts_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_accounts_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_accounts_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          client_id: string | null
          coverage_tier: string
          created_at: string
          ecard_status: string
          full_name: string
          group_id: string
          id: string
          join_date: string | null
          notes: string | null
          relationship: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          coverage_tier?: string
          created_at?: string
          ecard_status?: string
          full_name: string
          group_id: string
          id?: string
          join_date?: string | null
          notes?: string | null
          relationship?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          coverage_tier?: string
          created_at?: string
          ecard_status?: string
          full_name?: string
          group_id?: string
          id?: string
          join_date?: string | null
          notes?: string | null
          relationship?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string
          id: string
          portal_url: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          portal_url?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          portal_url?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          status: string
          template_name: string
          updated_at: string
          workflow_step_id: string | null
          workflow_template_id: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          id?: string
          status?: string
          template_name: string
          updated_at?: string
          workflow_step_id?: string | null
          workflow_template_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          status?: string
          template_name?: string
          updated_at?: string
          workflow_step_id?: string | null
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_workflow_step_id_fkey"
            columns: ["workflow_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_channels: {
        Row: {
          account_name: string
          account_number: string
          active: boolean
          channel_type: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          active?: boolean
          channel_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          active?: boolean
          channel_type?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          application_id: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          or_number: string | null
          or_received_date: string | null
          payment_date: string | null
          payment_method: string | null
          policy_id: string | null
          proof_document_id: string | null
          reference_no: string | null
          renewal_id: string | null
          sent_to_pacific_cross: boolean
          sent_to_pacific_cross_date: string | null
          status: string
          travel_request_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          application_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          or_received_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          policy_id?: string | null
          proof_document_id?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          sent_to_pacific_cross?: boolean
          sent_to_pacific_cross_date?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          application_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          or_received_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          policy_id?: string | null
          proof_document_id?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          sent_to_pacific_cross?: boolean
          sent_to_pacific_cross_date?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_proof_document_id_fkey"
            columns: ["proof_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_options: {
        Row: {
          coverage_currency: string | null
          coverage_description: string | null
          coverage_tier: string | null
          created_at: string
          deductible_range: string | null
          id: string
          maximum_coverage: number | null
          plan_family: string | null
          plan_name: string
          product_version_id: string
          status: string
          updated_at: string
        }
        Insert: {
          coverage_currency?: string | null
          coverage_description?: string | null
          coverage_tier?: string | null
          created_at?: string
          deductible_range?: string | null
          id?: string
          maximum_coverage?: number | null
          plan_family?: string | null
          plan_name: string
          product_version_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          coverage_currency?: string | null
          coverage_description?: string | null
          coverage_tier?: string | null
          created_at?: string
          deductible_range?: string | null
          id?: string
          maximum_coverage?: number | null
          plan_family?: string | null
          plan_name?: string
          product_version_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_options_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          assigned_user_id: string | null
          client_id: string
          created_at: string
          currency: string | null
          effective_date: string | null
          expiry_date: string | null
          first_layer_coverage_id: string | null
          id: string
          notes: string | null
          or_number: string | null
          pacific_cross_contact_id: string | null
          payment_mode: string | null
          plan_option_id: string | null
          policy_number: string | null
          premium_amount: number | null
          product_id: string | null
          product_version_id: string | null
          reference_no: string | null
          renewal_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          client_id: string
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          first_layer_coverage_id?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          pacific_cross_contact_id?: string | null
          payment_mode?: string | null
          plan_option_id?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          product_id?: string | null
          product_version_id?: string | null
          reference_no?: string | null
          renewal_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          client_id?: string
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          first_layer_coverage_id?: string | null
          id?: string
          notes?: string | null
          or_number?: string | null
          pacific_cross_contact_id?: string | null
          payment_mode?: string | null
          plan_option_id?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          product_id?: string | null
          product_version_id?: string | null
          reference_no?: string | null
          renewal_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_first_layer_coverage_id_fkey"
            columns: ["first_layer_coverage_id"]
            isOneToOne: false
            referencedRelation: "external_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_pacific_cross_contact_id_fkey"
            columns: ["pacific_cross_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_tables: {
        Row: {
          age_band: string | null
          base_premium: number | null
          created_at: string
          currency: string | null
          effective_date: string | null
          id: string
          payment_mode: string | null
          plan_option_id: string | null
          product_version_id: string
          status: string
          updated_at: string
        }
        Insert: {
          age_band?: string | null
          base_premium?: number | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          id?: string
          payment_mode?: string | null
          plan_option_id?: string | null
          product_version_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          age_band?: string | null
          base_premium?: number | null
          created_at?: string
          currency?: string | null
          effective_date?: string | null
          id?: string
          payment_mode?: string | null
          plan_option_id?: string | null
          product_version_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_tables_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_tables_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          created_at: string
          effective_date: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          product_id: string
          status: string
          updated_at: string
          version_name: string
        }
        Insert: {
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          status?: string
          updated_at?: string
          version_name: string
        }
        Update: {
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          provider: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reference_counters: {
        Row: {
          counter: number
          entity: string
          year: number
        }
        Insert: {
          counter?: number
          entity: string
          year: number
        }
        Update: {
          counter?: number
          entity?: string
          year?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_client_id: string | null
          created_at: string
          id: string
          notes: string | null
          referral_date: string | null
          referred_person_contact: string | null
          referred_person_name: string | null
          referring_client_id: string | null
          status: string
          thank_you_activity_id: string | null
          updated_at: string
        }
        Insert: {
          converted_client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          referral_date?: string | null
          referred_person_contact?: string | null
          referred_person_name?: string | null
          referring_client_id?: string | null
          status?: string
          thank_you_activity_id?: string | null
          updated_at?: string
        }
        Update: {
          converted_client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          referral_date?: string | null
          referred_person_contact?: string | null
          referred_person_name?: string | null
          referring_client_id?: string | null
          status?: string
          thank_you_activity_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_client_id_fkey"
            columns: ["referring_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_thank_you_activity_id_fkey"
            columns: ["thank_you_activity_id"]
            isOneToOne: false
            referencedRelation: "relationship_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_activities: {
        Row: {
          action_type: string | null
          activity_date: string | null
          assigned_user_id: string | null
          client_id: string
          cost: number | null
          created_at: string
          event_type_id: string | null
          id: string
          notes: string | null
          policy_id: string | null
          reference_no: string | null
          status: string
          updated_at: string
          vendor_contact_id: string | null
        }
        Insert: {
          action_type?: string | null
          activity_date?: string | null
          assigned_user_id?: string | null
          client_id: string
          cost?: number | null
          created_at?: string
          event_type_id?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          vendor_contact_id?: string | null
        }
        Update: {
          action_type?: string | null
          activity_date?: string | null
          assigned_user_id?: string | null
          client_id?: string
          cost?: number | null
          created_at?: string
          event_type_id?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          reference_no?: string | null
          status?: string
          updated_at?: string
          vendor_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_activities_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_activities_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "relationship_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_activities_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_activities_vendor_contact_id_fkey"
            columns: ["vendor_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_event_types: {
        Row: {
          created_at: string
          default_action: string | null
          default_timing: string | null
          description: string | null
          event_name: string
          id: string
          status: string
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_action?: string | null
          default_timing?: string | null
          description?: string | null
          event_name: string
          id?: string
          status?: string
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_action?: string | null
          default_timing?: string | null
          description?: string | null
          event_name?: string
          id?: string
          status?: string
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      renewals: {
        Row: {
          client_id: string
          created_at: string
          early_payment_flag: boolean
          grace_period_end_date: string | null
          id: string
          notes: string | null
          policy_expiry_date: string | null
          policy_id: string
          reference_no: string | null
          renewal_completed_date: string | null
          renewal_due_date: string | null
          renewal_notice_date: string | null
          renewal_payment_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          early_payment_flag?: boolean
          grace_period_end_date?: string | null
          id?: string
          notes?: string | null
          policy_expiry_date?: string | null
          policy_id: string
          reference_no?: string | null
          renewal_completed_date?: string | null
          renewal_due_date?: string | null
          renewal_notice_date?: string | null
          renewal_payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          early_payment_flag?: boolean
          grace_period_end_date?: string | null
          id?: string
          notes?: string | null
          policy_expiry_date?: string | null
          policy_id?: string
          reference_no?: string | null
          renewal_completed_date?: string | null
          renewal_due_date?: string | null
          renewal_notice_date?: string | null
          renewal_payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      required_document_items: {
        Row: {
          applies_to: string | null
          created_at: string
          document_name: string
          id: string
          is_required: boolean
          notes: string | null
          requirement_template_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_to?: string | null
          created_at?: string
          document_name: string
          id?: string
          is_required?: boolean
          notes?: string | null
          requirement_template_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_to?: string | null
          created_at?: string
          document_name?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          requirement_template_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "required_document_items_requirement_template_id_fkey"
            columns: ["requirement_template_id"]
            isOneToOne: false
            referencedRelation: "required_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      required_document_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_version_id: string | null
          status: string
          template_name: string
          updated_at: string
          workflow_template_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_version_id?: string | null
          status?: string
          template_name: string
          updated_at?: string
          workflow_template_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_version_id?: string | null
          status?: string
          template_name?: string
          updated_at?: string
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "required_document_templates_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "required_document_templates_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          application_id: string | null
          assigned_user_id: string | null
          claim_id: string | null
          client_id: string | null
          completed_date: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          policy_id: string | null
          priority: string | null
          reference_no: string | null
          renewal_id: string | null
          status: string
          task_type: string | null
          title: string
          travel_request_id: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_user_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          completed_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          priority?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          status?: string
          task_type?: string | null
          title: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_user_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          completed_date?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          priority?: string | null
          reference_no?: string | null
          renewal_id?: string | null
          status?: string
          task_type?: string | null
          title?: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_requests: {
        Row: {
          assigned_user_id: string | null
          client_id: string
          created_at: string
          currency: string | null
          departure_date: string | null
          destination: string | null
          id: string
          notes: string | null
          payment_destination: string | null
          plan_option_id: string | null
          policy_number: string | null
          product_version_id: string | null
          quoted_premium: number | null
          reference_no: string | null
          return_date: string | null
          status: string
          traveler_count: number | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          client_id: string
          created_at?: string
          currency?: string | null
          departure_date?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          payment_destination?: string | null
          plan_option_id?: string | null
          policy_number?: string | null
          product_version_id?: string | null
          quoted_premium?: number | null
          reference_no?: string | null
          return_date?: string | null
          status?: string
          traveler_count?: number | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          client_id?: string
          created_at?: string
          currency?: string | null
          departure_date?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          payment_destination?: string | null
          plan_option_id?: string | null
          policy_number?: string | null
          product_version_id?: string | null
          quoted_premium?: number | null
          reference_no?: string | null
          return_date?: string | null
          status?: string
          traveler_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_requests_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_requests_plan_option_id_fkey"
            columns: ["plan_option_id"]
            isOneToOne: false
            referencedRelation: "plan_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_requests_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          reference_no: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          last_login_at?: string | null
          reference_no?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          reference_no?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_instances: {
        Row: {
          application_id: string | null
          assigned_user_id: string | null
          claim_id: string | null
          client_id: string | null
          completed_date: string | null
          created_at: string
          current_status: string | null
          current_step_id: string | null
          id: string
          notes: string | null
          policy_id: string | null
          renewal_id: string | null
          start_date: string | null
          updated_at: string
          workflow_template_id: string
        }
        Insert: {
          application_id?: string | null
          assigned_user_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          completed_date?: string | null
          created_at?: string
          current_status?: string | null
          current_step_id?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          renewal_id?: string | null
          start_date?: string | null
          updated_at?: string
          workflow_template_id: string
        }
        Update: {
          application_id?: string | null
          assigned_user_id?: string | null
          claim_id?: string | null
          client_id?: string | null
          completed_date?: string | null
          created_at?: string
          current_status?: string | null
          current_step_id?: string | null
          id?: string
          notes?: string | null
          policy_id?: string | null
          renewal_id?: string | null
          start_date?: string | null
          updated_at?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          created_at: string
          default_assigned_role: string | null
          default_due_days: number | null
          description: string | null
          id: string
          required_document_rule: string | null
          status: string
          step_name: string
          step_order: number
          updated_at: string
          workflow_template_id: string
        }
        Insert: {
          created_at?: string
          default_assigned_role?: string | null
          default_due_days?: number | null
          description?: string | null
          id?: string
          required_document_rule?: string | null
          status?: string
          step_name: string
          step_order?: number
          updated_at?: string
          workflow_template_id: string
        }
        Update: {
          created_at?: string
          default_assigned_role?: string | null
          default_due_days?: number | null
          description?: string | null
          id?: string
          required_document_rule?: string | null
          status?: string
          step_name?: string
          step_order?: number
          updated_at?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          product_category: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          product_category?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          product_category?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_reference: { Args: { prefix: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
