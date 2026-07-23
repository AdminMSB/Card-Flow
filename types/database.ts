// Tipos hand-written que espelham supabase/migrations/*.sql.
// Se o schema mudar, atualize este arquivo (ou gere via `supabase gen types typescript`).

export type Role = 'colaborador' | 'gestor' | 'financeiro' | 'admin';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'reconciled';
export type InvoiceStatus = 'mapping' | 'reconciling' | 'closed';
export type MatchStatus = 'unmatched' | 'auto_matched' | 'manually_matched' | 'disputed';

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          manager_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          manager_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          department_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: Role;
          department_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      cost_centers: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cost_centers']['Insert']>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          last_four_digits: string;
          holder_id: string | null;
          department_id: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          last_four_digits: string;
          holder_id?: string | null;
          department_id: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cards']['Insert']>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          card_id: string;
          user_id: string | null;
          requester_name: string | null;
          department_id: string | null;
          purchase_date: string;
          amount_cents: number;
          discount_cents: number;
          surcharge_cents: number;
          merchant_name: string;
          category_id: string | null;
          cost_center_id: string | null;
          description: string | null;
          receipt_path: string | null;
          status: PurchaseStatus;
          approved_by: string | null;
          approved_at: string | null;
          approval_notes: string | null;
          requisition_number: string | null;
          supplier_name: string | null;
          supplier_cnpj: string | null;
          invoice_document_number: string | null;
          purchase_order_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          user_id?: string | null;
          requester_name?: string | null;
          department_id?: string | null;
          purchase_date: string;
          amount_cents: number;
          discount_cents?: number;
          surcharge_cents?: number;
          merchant_name: string;
          category_id?: string | null;
          cost_center_id?: string | null;
          description?: string | null;
          receipt_path?: string | null;
          status?: PurchaseStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          approval_notes?: string | null;
          requisition_number?: string | null;
          supplier_name?: string | null;
          supplier_cnpj?: string | null;
          invoice_document_number?: string | null;
          purchase_order_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>;
        Relationships: [];
      };
      collaborators: {
        Row: {
          id: string;
          full_name: string;
          department_id: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          department_id?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['collaborators']['Insert']>;
        Relationships: [];
      };
      purchase_order_codes: {
        Row: {
          id: string;
          purchase_id: string;
          code: string;
          amount_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          code: string;
          amount_cents?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['purchase_order_codes']['Insert']>;
        Relationships: [];
      };
      purchase_invoice_documents: {
        Row: {
          id: string;
          purchase_id: string;
          document_number: string;
          amount_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          document_number: string;
          amount_cents?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['purchase_invoice_documents']['Insert']>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          card_id: string;
          reference_month: string;
          file_path: string;
          file_name: string;
          column_mapping: Record<string, string> | null;
          status: InvoiceStatus;
          imported_by: string;
          imported_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          card_id: string;
          reference_month: string;
          file_path: string;
          file_name: string;
          column_mapping?: Record<string, string> | null;
          status?: InvoiceStatus;
          imported_by: string;
          imported_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
        Relationships: [];
      };
      invoice_raw_rows: {
        Row: {
          id: string;
          invoice_id: string;
          row_index: number;
          raw_data: Record<string, string>;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          row_index: number;
          raw_data: Record<string, string>;
        };
        Update: Partial<Database['public']['Tables']['invoice_raw_rows']['Insert']>;
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          item_date: string;
          amount_cents: number;
          merchant_raw: string;
          description_raw: string | null;
          matched_purchase_id: string | null;
          match_status: MatchStatus;
          match_confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          item_date: string;
          amount_cents: number;
          merchant_raw: string;
          description_raw?: string | null;
          matched_purchase_id?: string | null;
          match_status?: MatchStatus;
          match_confidence?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>;
        Relationships: [];
      };
      reconciliation_audit_log: {
        Row: {
          id: string;
          invoice_item_id: string;
          action: string;
          performed_by: string | null;
          performed_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          invoice_item_id: string;
          action: string;
          performed_by?: string | null;
          performed_at?: string;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reconciliation_audit_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
