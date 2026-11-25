import type { BulkT } from "./bulkClientTypes";

/** Shown above the jobseeker forms when the chosen position is a subcategory position. */
export function BulkSubcategoryBanner({ t }: { t: BulkT }) {
  return (
    <div
      className="info-banner"
      style={{
        margin: "16px 0",
        padding: "12px 16px",
        backgroundColor: "#ede9fe",
        border: "1px solid #c4b5fd",
        borderRadius: "8px",
        color: "#5b21b6",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontWeight: 600 }}>ℹ</span>
      <span>{t("bulkTimesheetManagement.subcategoryBanner")}</span>
    </div>
  );
}
