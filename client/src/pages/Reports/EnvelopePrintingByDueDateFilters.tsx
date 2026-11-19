import { Calendar, Building, Repeat } from "lucide-react";
import type { ClientData } from "../../services/api/client";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";

type Props = {
  clientLoading: boolean;
  clientOptions: DropdownOption[];
  selectedClients: ClientData[];
  setSelectedClients: (clients: ClientData[]) => void;
  payCycleOptions: DropdownOption[];
  selectedPayCycles: string[];
  setSelectedPayCycles: (value: string[]) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
};

export function EnvelopePrintingByDueDateFilters({
  clientLoading,
  clientOptions,
  selectedClients,
  setSelectedClients,
  payCycleOptions,
  selectedPayCycles,
  setSelectedPayCycles,
  dueDate,
  setDueDate,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="timesheet-selection-bar">
      <div className="selection-row">
        <div className="selection-section" style={{ flex: "1 1 50%" }}>
          <label className="selection-label">
            {t("reports.filters.clients")}
          </label>
          {clientLoading ? (
            <div className="invoice-dropdown-skeleton">
              <div className="skeleton-dropdown-trigger">
                <div className="skeleton-icon"></div>
                <div className="skeleton-text skeleton-dropdown-text"></div>
                <div className="skeleton-icon skeleton-chevron"></div>
              </div>
            </div>
          ) : (
            <CustomDropdown
              options={clientOptions}
              selectedOptions={
                selectedClients.length > 0
                  ? selectedClients
                      .map(
                        (c) =>
                          clientOptions.find(
                            (o) => o.id === c.id
                          ) as DropdownOption
                      )
                      .filter(Boolean)
                  : []
              }
              onSelect={(opts) => {
                if (Array.isArray(opts))
                  setSelectedClients(opts.map((o) => o.value as ClientData));
                else if (opts && typeof opts === "object")
                  setSelectedClients([opts.value as ClientData]);
                else setSelectedClients([]);
              }}
              placeholder={t("reports.placeholders.selectClients")}
              multiSelect={true}
              showSelectAll={true}
              icon={<Building size={16} />}
              emptyMessage={t("reports.emptyMessages.noClients")}
              maxVisibleTagsOverride={3}
            />
          )}
        </div>
        <div className="selection-section" style={{ flex: "1 1 50%" }}>
          <label className="selection-label">
            {t("reports.filters.payCycle")}
          </label>
          <CustomDropdown
            options={payCycleOptions}
            selectedOptions={
              selectedPayCycles.length > 0
                ? selectedPayCycles
                    .map(
                      (pc) =>
                        payCycleOptions.find(
                          (o) => o.id === pc
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedPayCycles(opts.map((o) => String(o.value)));
              else if (opts && typeof opts === "object")
                setSelectedPayCycles([String(opts.value)]);
              else setSelectedPayCycles([]);
            }}
            placeholder={t("reports.placeholders.selectPayCycle")}
            multiSelect={true}
            showSelectAll={true}
            searchable={false}
            icon={<Repeat size={16} />}
            emptyMessage={t("reports.emptyMessages.noPayCycles")}
            maxVisibleTagsOverride={3}
          />
        </div>
      </div>
      <div className="selection-row">
        <div
          className="selection-section date-input-wrapper"
          style={{ flex: "0 0 50%" }}
        >
          <label
            className="selection-label"
            htmlFor="due-date-input"
            onClick={() => document.getElementById("due-date-input")?.focus()}
          >
            <Calendar size={16} />{" "}
            {t("reports.filters.dueDate") || "Payment Due Date"}
          </label>
          <input
            id="due-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="invoice-date-input"
            style={{ width: "100%" }}
          />
          <p
            className="date-info-text"
            style={{
              marginTop: "8px",
              fontSize: "0.875rem",
              color: "#6b7280",
              fontStyle: "italic",
            }}
          >
            {t("reports.info.singleDateRange") ||
              "Showing timesheets due on this exact date"}
          </p>
        </div>
      </div>
    </div>
  );
}
