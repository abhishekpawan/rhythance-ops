// Types for invoice data (moved out of routes/invoices.ts unchanged)
export interface InvoiceData {
  clientId: string;
  invoiceDate: string;
  invoiceNumber?: string;
  dueDate: string;
  status?: string;
  currency?: string;
  paymentTerms?: string;
  subtotal: number;
  totalTax: number;
  totalHst?: number;
  totalGst?: number;
  totalQst?: number;
  grandTotal: number;
  totalHours: number;
  emailSent?: boolean;
  emailSentDate?: string;
  invoice_sent_to?: string;
  documentGenerated?: boolean;
  documentPath?: string;
  documentFileName?: string;
  documentFileSize?: number;
  documentMimeType?: string;
  documentGeneratedAt?: string;
  notes?: string; // Additional notes or comments
  invoiceData: any; // Complete JSONB object from frontend
}

export interface DbInvoiceData {
  id?: string;
  invoice_number?: string;
  client_id: string;
  invoice_date: string;
  due_date: string;
  status: string;
  currency: string;
  subtotal: number;
  total_tax: number;
  total_hst?: number;
  total_gst?: number;
  total_qst?: number;
  grand_total: number;
  total_hours: number;
  email_sent: boolean;
  email_sent_date?: string;
  invoice_sent_to?: string;
  document_generated: boolean;
  document_path?: string;
  document_file_name?: string;
  document_file_size?: number;
  document_mime_type?: string;
  document_generated_at?: string;
  notes?: string; // Additional notes or comments
  invoice_data: any; // JSONB
  created_at?: string;
  created_by_user_id?: string;
  updated_at?: string;
  updated_by_user_id?: string;
  version?: number;
  version_history?: any[]; // New field for version history
}
