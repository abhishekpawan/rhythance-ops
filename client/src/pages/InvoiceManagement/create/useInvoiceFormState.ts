import { useState } from "react";
import { ClientData } from "../../../services/api/client";
import { PositionData } from "../../../services/api/position";
import {
  AssignedJobseeker,
  InvoiceLineItem,
  SupplierPOItem,
} from "../invoiceTypes";
import { AttachmentFile } from "../../../components/InvoiceAttachments";
import { InvoiceData } from "../../../services/api/invoice";

export function useInvoiceFormState() {
  // Edit / View mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // State for client selection
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // State for invoice number
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);

  // State for position selection
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [positionLoading, setPositionLoading] = useState(false);

  // State for all jobseekers (no longer position-dependent)
  const [allJobseekers, setAllJobseekers] = useState<AssignedJobseeker[]>([]);
  const [jobseekerLoading, setJobseekerLoading] = useState<boolean>(false);

  // State for invoice details
  const [selectedTerms, setSelectedTerms] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  // State for date range to fetch timesheets
  const [timesheetStartDate, setTimesheetStartDate] = useState<string>("");
  const [timesheetEndDate, setTimesheetEndDate] = useState<string>("");
  const [isFetchingTimesheets, setIsFetchingTimesheets] = useState(false);
  const [timesheetFetchMessage, setTimesheetFetchMessage] =
    useState<string>("");

  // State for additional information
  const [messageOnInvoice, setMessageOnInvoice] = useState<string>(
    "We appreciate your business and look forward to helping you again soon."
  );
  const [termsOnInvoice, setTermsOnInvoice] = useState<string>(
    "Interest is payable at 24% annually after the agreed terms."
  );
  const [notes, setNotes] = useState<string>("");

  // State for line items
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // State for supplier/PO items
  const [supplierPOItems, setSupplierPOItems] = useState<SupplierPOItem[]>([]);

  // State for attachments
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // State for invoice generation
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string>("");
  const [generationError, setGenerationError] = useState<string>("");
  // Add state for pdfBlobUrl
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  // Add state for showInvoiceSuccessModal and emailToSend
  const [showInvoiceSuccessModal, setShowInvoiceSuccessModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceData | null>(
    null
  );
  // Add state for loaded invoice in edit/view mode
  const [loadedInvoice, setLoadedInvoice] = useState<InvoiceData | null>(null);
  const [emailToSend, setEmailToSend] = useState<string>("");
  const [emailUpdateMessage, setEmailUpdateMessage] = useState<string>("");

  // Add PDF preview state for modal
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Add state for sending invoice
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [sendInvoiceMessage, setSendInvoiceMessage] = useState<string>("");

  // Add after all useState hooks, before the return statement in InvoiceManagement
  const documentPath =
    createdInvoice?.documentPath || loadedInvoice?.documentPath || "";
  const documentFileName =
    createdInvoice?.documentFileName || loadedInvoice?.documentFileName || "";
  const documentFileSize =
    createdInvoice?.documentFileSize || loadedInvoice?.documentFileSize || 0;

  return {
    isEditMode,
    setIsEditMode,
    isViewMode,
    setIsViewMode,
    editingInvoiceId,
    setEditingInvoiceId,
    clients,
    setClients,
    selectedClient,
    setSelectedClient,
    clientLoading,
    setClientLoading,
    invoiceNumber,
    setInvoiceNumber,
    invoiceNumberLoading,
    setInvoiceNumberLoading,
    positions,
    setPositions,
    positionLoading,
    setPositionLoading,
    allJobseekers,
    setAllJobseekers,
    jobseekerLoading,
    setJobseekerLoading,
    selectedTerms,
    setSelectedTerms,
    invoiceDate,
    setInvoiceDate,
    dueDate,
    setDueDate,
    timesheetStartDate,
    setTimesheetStartDate,
    timesheetEndDate,
    setTimesheetEndDate,
    isFetchingTimesheets,
    setIsFetchingTimesheets,
    timesheetFetchMessage,
    setTimesheetFetchMessage,
    messageOnInvoice,
    setMessageOnInvoice,
    termsOnInvoice,
    setTermsOnInvoice,
    notes,
    setNotes,
    lineItems,
    setLineItems,
    supplierPOItems,
    setSupplierPOItems,
    attachments,
    setAttachments,
    isGeneratingInvoice,
    setIsGeneratingInvoice,
    generationMessage,
    setGenerationMessage,
    generationError,
    setGenerationError,
    pdfBlobUrl,
    setPdfBlobUrl,
    showInvoiceSuccessModal,
    setShowInvoiceSuccessModal,
    createdInvoice,
    setCreatedInvoice,
    loadedInvoice,
    setLoadedInvoice,
    emailToSend,
    setEmailToSend,
    emailUpdateMessage,
    setEmailUpdateMessage,
    pdfPageNumber,
    setPdfPageNumber,
    pdfNumPages,
    setPdfNumPages,
    pdfScale,
    setPdfScale,
    isSendingInvoice,
    setIsSendingInvoice,
    sendInvoiceMessage,
    setSendInvoiceMessage,
    documentPath,
    documentFileName,
    documentFileSize,
  };
}
