import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";
import { transformToFrontendFormat } from "../services/invoice.format.js";
import {
  getMatchingClientIds,
  applyInvoiceFilters,
} from "../services/invoice.filters.js";

export const getInvoices = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user.id;
    const userType = req.user.user_metadata?.user_type;

    // Extract pagination and filter parameters from query
    const {
      page = "1",
      limit = "10",
      searchTerm = "",
      clientFilter = "",
      clientEmailFilter = "",
      invoiceNumberFilter = "",
      dateRangeStart = "",
      dateRangeEnd = "",
      emailSentFilter = "",
      invoiceSentFilter = "",
      documentGeneratedFilter = "",
      paymentTermsFilter = "",
    } = req.query as {
      page?: string;
      limit?: string;
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
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    // Fetch matching client IDs for client-related filters
    const clientIdsMap = await getMatchingClientIds(
      searchTerm,
      clientFilter,
      clientEmailFilter
    );

    // Build the base query with joins for related data
    let baseQuery = supabase.from("invoices").select(`
        *,
        clients!inner(id, company_name, short_code, email_address1, street_address1, city1, province1, postal_code1)
      `);

    // Apply role-based filtering
    if (userType === "jobseeker") {
      baseQuery = baseQuery.eq("created_by_user_id", userId);
    }

    // Apply all filters at database level
    baseQuery = applyInvoiceFilters(
      baseQuery,
      {
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
      },
      clientIdsMap
    );

    // Get total count (unfiltered for user's access level)
    let totalCountQuery = supabase
      .from("invoices")
      .select("*", { count: "exact", head: true });

    if (userType === "jobseeker") {
      totalCountQuery = totalCountQuery.eq("created_by_user_id", userId);
    }

    const { count: totalCount, error: countError } = await totalCountQuery;

    if (countError) {
      console.error("Error getting total count:", countError);
      return res
        .status(500)
        .json({ error: "Failed to get total count of invoices" });
    }

    // Get filtered count
    let filteredCountQuery = supabase.from("invoices").select(
      `
        *,
        clients!inner(id, company_name, short_code, email_address1)
      `,
      { count: "exact", head: true }
    );

    if (userType === "jobseeker") {
      filteredCountQuery = filteredCountQuery.eq("created_by_user_id", userId);
    }

    filteredCountQuery = applyInvoiceFilters(
      filteredCountQuery,
      {
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
      },
      clientIdsMap
    );

    const { count: filteredCount, error: filteredCountError } =
      await filteredCountQuery;

    if (filteredCountError) {
      console.error(
        "Error getting filtered count:",
        JSON.stringify(filteredCountError, null, 2)
      );
      return res.status(500).json({
        error: "Failed to get filtered count of invoices",
        details: filteredCountError.message,
      });
    }

    // Apply pagination and execute main query
    const { data: invoices, error } = await baseQuery
      .range(offset, offset + limitNum - 1)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invoices:", JSON.stringify(error, null, 2));
      return res
        .status(500)
        .json({ error: "Failed to fetch invoices", details: error.message });
    }

    if (!invoices || invoices.length === 0) {
      return res.json({
        invoices: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount || 0,
          totalFiltered: filteredCount || 0,
          totalPages: Math.ceil((filteredCount || 0) / limitNum),
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    // Transform invoices to frontend format
    const formattedInvoices = invoices.map((invoice) => {
      const formatted = transformToFrontendFormat(invoice);

      // Add related data
      formatted.client = invoice.clients;

      // Clean up the joined data from the main object
      delete formatted.clients;

      return formatted;
    });

    // Calculate pagination metadata
    const totalFiltered = filteredCount || 0;
    const totalPages = Math.ceil(totalFiltered / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      invoices: formattedInvoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount || 0,
        totalFiltered,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Unexpected error fetching invoices:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
