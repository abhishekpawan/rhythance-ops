import { Calendar, Building, List, Repeat } from "lucide-react";
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
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  listNameOptions: DropdownOption[];
  selectedListNames: string[];
  setSelectedListNames: (value: string[]) => void;
  payCycleOptions: DropdownOption[];
  selectedPayCycles: string[];
  setSelectedPayCycles: (value: string[]) => void;
};

export function EnvelopePrintingFilters({
  clientLoading,
  clientOptions,
  selectedClients,
  setSelectedClients,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  listNameOptions,
  selectedListNames,
  setSelectedListNames,
  payCycleOptions,
  selectedPayCycles,
  setSelectedPayCycles,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="timesheet-selection-bar">
      <div className="selection-row">
        <div className="selection-section">
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
              maxVisibleTagsOverride={4}
            />
          )}
        </div>
        <div className="selection-section date-input-wrapper">
          <div className="start-end-date-section">
            <div className="start-date-section">
              <label
                className="selection-label"
                htmlFor="start-date-input"
                onClick={() =>
                  document.getElementById("start-date-input")?.focus()
                }
              >
                <Calendar size={16} /> {t("reports.filters.startDate")}
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
            <div className="end-date-section">
              <label
                className="selection-label"
                htmlFor="end-date-input"
                onClick={() =>
                  document.getElementById("end-date-input")?.focus()
                }
              >
                <Calendar size={16} /> {t("reports.filters.endDate")}
              </label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
          </div>
          <p
            className="date-info-text"
            style={{
              marginTop: "8px",
              fontSize: "0.875rem",
              color: "#6b7280",
              fontStyle: "italic",
            }}
          >
            {t("reports.info.defaultDateRange") ||
              "Default date range: Last 1 month"}
          </p>
        </div>
      </div>
      <div className="selection-row">
        <div className="selection-section">
          <label className="selection-label">
            {t("reports.filters.listName")}
          </label>
          <CustomDropdown
            options={listNameOptions}
            selectedOptions={
              selectedListNames.length > 0
                ? selectedListNames
                    .map(
                      (ln) =>
                        listNameOptions.find(
                          (o) => o.id === ln
                        ) as DropdownOption
                    )
                    .filter(Boolean)
                : []
            }
            onSelect={(opts) => {
              if (Array.isArray(opts))
                setSelectedListNames(opts.map((o) => String(o.value)));
              else if (opts && typeof opts === "object")
                setSelectedListNames([String(opts.value)]);
              else setSelectedListNames([]);
            }}
            placeholder={t("reports.placeholders.selectListName")}
            multiSelect={true}
            showSelectAll={true}
            searchable={true}
            icon={<List size={16} />}
            emptyMessage={t("reports.emptyMessages.noListNames")}
            maxVisibleTagsOverride={5}
          />
        </div>
        <div className="selection-section">
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
    </div>
  );
}
