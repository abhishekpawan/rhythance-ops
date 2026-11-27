import { InvoiceLineItem, SupplierPOItem } from "../invoiceTypes";
import { calculateLineItemHours } from "../invoiceCalculations";
import type { useInvoiceFormState } from "./useInvoiceFormState";

export function createLineHandlers(
  ctx: ReturnType<typeof useInvoiceFormState>
) {
  const { lineItems, setLineItems, setSupplierPOItems, supplierPOItems } = ctx;
  // Line item management functions
  const addLineItem = () => {
    const newLineItem: InvoiceLineItem = {
      id: Date.now().toString(),
      position: null,
      jobseeker: null,
      description: "",
      hours: "",
      regularBillRate: "",
      regularPayRate: "",
      premiumPayRate: "0",
      salesTax: "13.00% [ON]", // Default to Ontario
    };
    setLineItems((prev) => [...prev, newLineItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, updates: Partial<InvoiceLineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // Recalculate hours when hours or position changes
        if (updates.hours !== undefined || updates.position !== undefined) {
          const hours = parseFloat(updated.hours) || 0;
          const { regularHours, overtimeHours } = calculateLineItemHours(
            hours,
            updated.position
          );
          updated.totalRegularHours = regularHours;
          updated.totalOvertimeHours = overtimeHours;
        }

        return updated;
      })
    );
  };

  // Supplier/PO management functions
  const addSupplierPOItem = () => {
    const newSupplierPOItem: SupplierPOItem = {
      id: Date.now().toString(),
      selectedOption: "",
      supplierPoNumber: "",
    };
    setSupplierPOItems((prev) => [...prev, newSupplierPOItem]);
  };

  const removeSupplierPOItem = (id: string) => {
    if (supplierPOItems.length > 1) {
      setSupplierPOItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const updateSupplierPOItem = (
    id: string,
    updates: Partial<SupplierPOItem>
  ) => {
    setSupplierPOItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  return {
    addLineItem,
    removeLineItem,
    updateLineItem,
    addSupplierPOItem,
    removeSupplierPOItem,
    updateSupplierPOItem,
  };
}
