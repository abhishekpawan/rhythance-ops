import { DropdownOption } from "../../../components/CustomDropdown";
import { getPositionDisplayTitle } from "../../../utils/positionDisplay";
import { SALES_TAX_OPTIONS } from "../invoiceTypes";
import { PAYMENT_TERMS } from "../../../constants/formOptions";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { useInvoiceFormState } from "./useInvoiceFormState";

export function createInvoiceOptions(
  ctx: ReturnType<typeof useInvoicePageHooks> &
    ReturnType<typeof useInvoiceFormState>
) {
  const {
    allJobseekers,
    clients,
    positions,
    selectedClient,
    selectedTerms,
    t,
  } = ctx;
  // Combined supplier and PO options with translation
  const COMBINED_OPTIONS = [
    {
      id: "supplier-no",
      type: "supplier",
      value: "Supplier No",
      label: t("invoiceManagement.supplierNo"),
    },
    {
      id: "po-no",
      type: "po",
      value: "PO No",
      label: t("invoiceManagement.poNo"),
    },
  ];

  // Convert data to dropdown options
  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label: client.companyName || t("invoiceManagement.unknownClient"),
    sublabel: client.shortCode || "",
    value: client,
    isInactive: client.isInactive,
  }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || "",
    label: `${getPositionDisplayTitle(position, t("invoiceManagement.unknownPosition"))} - ${position.positionNumber || ""}`,
    sublabel: `Pay Rate: $${(
      Number.parseFloat(position.regularPayRate || "0") || 0
    ).toFixed(
      2
    )} | ${position.positionNumber || ""} | ${position.positionCategory || ""} | ${position.city || ""}, ${position.province || ""}`,
    value: position,
  }));

  const getJobseekerOptions = (): DropdownOption[] => {
    return allJobseekers.map((jobseeker) => ({
      id: jobseeker.candidateId,
      label:
        `${jobseeker.firstName} ${jobseeker.lastName}`.trim() ||
        t("invoiceManagement.unknown"),
      sublabel: jobseeker.email,
      value: jobseeker,
    }));
  };

  const salesTaxOptions: DropdownOption[] = SALES_TAX_OPTIONS.map((tax) => ({
    id: tax,
    label: tax,
    value: tax,
  }));

  const termsOptions: DropdownOption[] = PAYMENT_TERMS.map((term) => ({
    id: term,
    label: term,
    value: term,
  }));

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const selectedTermsOption = selectedTerms
    ? termsOptions.find((opt) => opt.value === selectedTerms)
    : null;

  // Combined supplier/PO dropdown options
  const combinedOptions: DropdownOption[] = COMBINED_OPTIONS.map((item) => ({
    id: item.value,
    label: item.label,
    sublabel:
      item.type === "supplier" ? "Supplier Number" : "Purchase Order Number",
    value: item.value,
  }));

  return {
    COMBINED_OPTIONS,
    clientOptions,
    positionOptions,
    getJobseekerOptions,
    salesTaxOptions,
    termsOptions,
    selectedClientOption,
    selectedTermsOption,
    combinedOptions,
  };
}
