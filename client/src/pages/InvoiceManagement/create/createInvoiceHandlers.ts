import { generateInvoiceNumber } from "../../../services/api/invoice";
import { DropdownOption } from "../../../components/CustomDropdown";
import { ClientData, getClient } from "../../../services/api/client";
import {
  calculateDueDate,
  calculateLineItemHours,
} from "../invoiceCalculations";
import { PositionData } from "../../../services/api/position";
import { AssignedJobseeker } from "../invoiceTypes";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createLineHandlers } from "./createLineHandlers";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function createInvoiceHandlers(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof createLineHandlers> &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const {
    invoiceDate,
    isEditMode,
    lineItems,
    setClientLoading,
    setDueDate,
    setGenerationError,
    setInvoiceDate,
    setInvoiceNumber,
    setInvoiceNumberLoading,
    setSelectedClient,
    setSelectedTerms,
    t,
    updateLineItem,
    updateSupplierPOItem,
  } = ctx;
  // Function to generate invoice number
  const generateAndSetInvoiceNumber = async () => {
    setInvoiceNumberLoading(true);
    try {
      const newInvoiceNumber = await generateInvoiceNumber();
      setInvoiceNumber(newInvoiceNumber);
    } catch (error) {
      setGenerationError(t("invoiceManagement.generateNumberFailed"));
    } finally {
      setInvoiceNumberLoading(false);
    }
  };

  const handleClientSelect = async (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const basicClient = option.value as ClientData;
    setSelectedClient(basicClient);
    setClientLoading(true);
    setGenerationError("");

    try {
      // Fetch detailed client data using the proper API function
      const detailedClient = await getClient(basicClient.id!);

      setSelectedClient(detailedClient);

      // Auto-select terms from client data if available
      if (detailedClient.terms) {
        setSelectedTerms(detailedClient.terms);
      }

      // Only generate invoice number when not in edit mode
      if (!isEditMode) {
        generateAndSetInvoiceNumber();
      }
    } catch (error) {
      console.error("Error fetching detailed client data:", error);

      // Fallback to basic client data but ensure all required fields are present
      const fallbackClient = {
        id: basicClient.id,
        companyName: basicClient.companyName || "",
        shortCode: basicClient.shortCode || "",
        emailAddress1: basicClient.emailAddress1 || "",
        emailAddress2: basicClient.emailAddress2,
        contactPersonName1: basicClient.contactPersonName1,
        contactPersonName2: basicClient.contactPersonName2,
        mobile1: basicClient.mobile1,
        mobile2: basicClient.mobile2,
        streetAddress1: basicClient.streetAddress1,
        city1: basicClient.city1,
        province1: basicClient.province1,
        postalCode1: basicClient.postalCode1,
        preferredPaymentMethod: basicClient.preferredPaymentMethod,
        payCycle: basicClient.payCycle,
        terms: basicClient.terms || "Net 30",
        currency: basicClient.currency || "CAD",
        clientManager: basicClient.clientManager,
        accountingPerson: basicClient.accountingPerson,
        salesPerson: basicClient.salesPerson,
      };

      setSelectedClient(fallbackClient);

      // Only generate invoice number when not in edit mode
      if (!isEditMode) {
        generateAndSetInvoiceNumber();
      }

      setGenerationError(
        "Warning: Could not fetch complete client details. Some information may be missing."
      );
    } finally {
      setClientLoading(false);
    }
  };

  const handleTermsSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    const terms = option.value as string;
    setSelectedTerms(terms);
    calculateDueDate(invoiceDate, terms, setDueDate);
  };

  const handleInvoiceDateChange = (date: string) => {
    setInvoiceDate(date);
  };

  const handleDueDateChange = (date: string) => {
    setDueDate(date);
  };

  const handleInvoiceDateClick = () => {
    const input = document.getElementById(
      "invoice-date-input"
    ) as HTMLInputElement;
    if (input) {
      input.showPicker?.();
    }
  };

  const handleDueDateClick = () => {
    const input = document.getElementById("due-date-input") as HTMLInputElement;
    if (input) {
      input.showPicker?.();
    }
  };

  const handlePositionSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const position = option.value as PositionData;

    // Get current hours to recalculate with new position
    const currentItem = lineItems.find((item) => item.id === lineItemId);
    const currentHours = parseFloat(currentItem?.hours || "0");

    // Calculate hours breakdown with new position
    const { regularHours, overtimeHours } = calculateLineItemHours(
      currentHours,
      position
    );

    updateLineItem(lineItemId, {
      position,
      jobseeker: null, // Reset jobseeker when position changes
      regularBillRate: position.billRate, // Auto-fill rate from position
      regularPayRate: position.regularPayRate, // Auto-fill rate from position
      totalRegularHours: regularHours,
      totalOvertimeHours: overtimeHours,
    });
  };

  const handleJobseekerSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const jobseeker = option.value as AssignedJobseeker;
    updateLineItem(lineItemId, { jobseeker });
  };

  const handleSalesTaxSelect = (
    lineItemId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const salesTax = option.value as string;
    updateLineItem(lineItemId, { salesTax });
  };

  // Combined option handler
  const handleCombinedOptionSelect = (
    supplierPOId: string,
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const selectedValue = option.value as string;
    updateSupplierPOItem(supplierPOId, { selectedOption: selectedValue });
  };

  const handleSupplierPONumberChange = (
    supplierPOId: string,
    value: string
  ) => {
    updateSupplierPOItem(supplierPOId, { supplierPoNumber: value });
  };

  return {
    generateAndSetInvoiceNumber,
    handleClientSelect,
    handleTermsSelect,
    handleInvoiceDateChange,
    handleDueDateChange,
    handleInvoiceDateClick,
    handleDueDateClick,
    handlePositionSelect,
    handleJobseekerSelect,
    handleSalesTaxSelect,
    handleCombinedOptionSelect,
    handleSupplierPONumberChange,
  };
}
