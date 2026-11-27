import { supabase } from "./invoice.client.js";

/**
 * Helper to get matching client IDs for client-related filters
 */
export async function getMatchingClientIds(
  searchTerm?: string,
  clientFilter?: string,
  clientEmailFilter?: string
): Promise<{
  searchClientIds?: string[];
  filterClientIds?: string[];
  emailClientIds?: string[];
}> {
  let searchClientIds: string[] | undefined;
  let filterClientIds: string[] | undefined;
  let emailClientIds: string[] | undefined;

  if (searchTerm && searchTerm.trim().length > 0) {
    const term = searchTerm.trim();
    const { data } = await supabase
      .from("clients")
      .select("id")
      .or(
        `company_name.ilike.%${term}%,short_code.ilike.%${term}%,email_address1.ilike.%${term}%`
      );
    searchClientIds = (data || []).map((c) => c.id);
  }

  if (clientFilter && clientFilter.trim().length > 0) {
    const term = clientFilter.trim();
    const { data } = await supabase
      .from("clients")
      .select("id")
      .or(`company_name.ilike.%${term}%,short_code.ilike.%${term}%`);
    filterClientIds = (data || []).map((c) => c.id);
  }

  if (clientEmailFilter && clientEmailFilter.trim().length > 0) {
    const term = clientEmailFilter.trim();
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("email_address1", `%${term}%`);
    emailClientIds = (data || []).map((c) => c.id);
  }

  return { searchClientIds, filterClientIds, emailClientIds };
}

/**
 * Helper function to apply filters to a Supabase query
 */
export function applyInvoiceFilters(
  query: any,
  filters: {
    searchTerm?: string;
    clientFilter?: string;
    clientEmailFilter?: string;
    invoiceNumberFilter?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    emailSentFilter?: string;
    invoiceSentFilter?: string;
    documentGeneratedFilter?: string;
    paymentTermsFilter?: string;
  },
  clientIdsMap?: {
    searchClientIds?: string[];
    filterClientIds?: string[];
    emailClientIds?: string[];
  }
) {
  const {
    searchTerm,
    clientFilter,
    clientEmailFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter,
    paymentTermsFilter,
  } = filters;

  // Global search across multiple fields
  if (searchTerm && searchTerm.trim().length > 0) {
    const searchTermTrimmed = searchTerm.trim();
    const searchClientIds = clientIdsMap?.searchClientIds || [];
    if (searchClientIds.length > 0) {
      query = query.or(
        `invoice_number.ilike.%${searchTermTrimmed}%,client_id.in.(${searchClientIds.join(",")})`
      );
    } else {
      query = query.ilike("invoice_number", `%${searchTermTrimmed}%`);
    }
  }

  // Individual column filters
  if (clientFilter && clientFilter.trim().length > 0) {
    const filterClientIds = clientIdsMap?.filterClientIds || [];
    if (filterClientIds.length > 0) {
      query = query.in("client_id", filterClientIds);
    } else {
      query = query.eq("client_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  if (clientEmailFilter && clientEmailFilter.trim().length > 0) {
    const emailClientIds = clientIdsMap?.emailClientIds || [];
    if (emailClientIds.length > 0) {
      query = query.in("client_id", emailClientIds);
    } else {
      query = query.eq("client_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  if (invoiceNumberFilter && invoiceNumberFilter.trim().length > 0) {
    query = query.ilike("invoice_number", `%${invoiceNumberFilter.trim()}%`);
  }
  if (dateRangeStart && dateRangeStart.trim().length > 0) {
    query = query.gte("invoice_date", dateRangeStart.trim());
  }
  if (dateRangeEnd && dateRangeEnd.trim().length > 0) {
    query = query.lte("invoice_date", dateRangeEnd.trim());
  }
  if (emailSentFilter && emailSentFilter.trim().length > 0) {
    const emailSentBool = emailSentFilter.toLowerCase() === "true";
    query = query.eq("email_sent", emailSentBool);
  }
  if (invoiceSentFilter && invoiceSentFilter.trim().length > 0) {
    const invoiceSentBool = invoiceSentFilter.toLowerCase() === "true";
    query = query.eq("email_sent", invoiceSentBool);
  }
  if (documentGeneratedFilter && documentGeneratedFilter.trim().length > 0) {
    const documentGeneratedBool =
      documentGeneratedFilter.toLowerCase() === "true";
    query = query.eq("document_generated", documentGeneratedBool);
  }
  if (paymentTermsFilter && paymentTermsFilter.trim().length > 0) {
    query = query.contains("invoice_data", {
      paymentTerms: paymentTermsFilter.trim(),
    });
  }

  return query;
}
