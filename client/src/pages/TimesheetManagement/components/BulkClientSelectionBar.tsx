import { Building } from "lucide-react";
import {
  CustomDropdown,
  DropdownOption,
} from "../../../components/CustomDropdown";
import type { ClientData } from "../../../services/api/client";
import { getPositionDisplayTitle } from "../../../utils/positionDisplay";
import type { BulkSelection, BulkT } from "./bulkClientTypes";

interface BulkClientSelectionBarProps {
  t: BulkT;
  clients: BulkSelection["clients"];
  positions: BulkSelection["positions"];
  weekOptions: BulkSelection["weekOptions"];
  selectedClient: BulkSelection["selectedClient"];
  setSelectedClient: BulkSelection["setSelectedClient"];
  clientLoading: BulkSelection["clientLoading"];
  selectedPosition: BulkSelection["selectedPosition"];
  setSelectedPosition: BulkSelection["setSelectedPosition"];
  positionLoading: BulkSelection["positionLoading"];
  selectedWeekStart: BulkSelection["selectedWeekStart"];
  setSelectedWeekStart: BulkSelection["setSelectedWeekStart"];
}

/** The client, position and week pickers. */
export function BulkClientSelectionBar({
  t,
  clients,
  positions,
  weekOptions,
  selectedClient,
  setSelectedClient,
  clientLoading,
  selectedPosition,
  setSelectedPosition,
  positionLoading,
  selectedWeekStart,
  setSelectedWeekStart,
}: BulkClientSelectionBarProps) {
  const clientOptions: DropdownOption[] = clients
    .filter((client) => !client.isInactive)
    .map((client) => ({
      id: client.id!,
      label:
        client.companyName ||
        t("bulkTimesheetManagement.constants.unknownClient"),
      sublabel: client.shortCode || "",
      value: client,
    }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || "",
    label: `${getPositionDisplayTitle(position, t("bulkTimesheetManagement.constants.unknownPosition"))} - ${position.positionNumber || ""}`,
    sublabel: `Pay Rate: $${(
      Number.parseFloat(position.regularPayRate || "0") || 0
    ).toFixed(
      2
    )} | ${position.positionNumber || ""} | ${position.positionCategory || ""} | ${position.city || ""}, ${position.province || ""}`,
    value: position,
  }));

  const weekDropdownOptions: DropdownOption[] = weekOptions.map((week) => ({
    id: week.value,
    label: week.label,
    value: week.value,
  }));

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const handleClientSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    setSelectedClient(option.value as ClientData);
  };

  return (
    <div className="timesheet-selection-bar">
      <div className="selection-section">
        <label className="selection-label">
          <Building size={16} />
          {t("bulkTimesheetManagement.columns.client")}
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
            selectedOption={selectedClientOption}
            onSelect={handleClientSelect}
            placeholder={t("bulkTimesheetManagement.placeholders.selectClient")}
            loading={false}
            icon={<Building size={16} />}
            emptyMessage={t("bulkTimesheetManagement.constants.noClientsFound")}
          />
        )}
      </div>
      <div className="selection-section">
        <label className="selection-label">
          {t("bulkTimesheetManagement.columns.position")}
        </label>
        {positionLoading ? (
          <div className="invoice-dropdown-skeleton">
            <div className="skeleton-dropdown-trigger">
              <div className="skeleton-icon"></div>
              <div className="skeleton-text skeleton-dropdown-text"></div>
              <div className="skeleton-icon skeleton-chevron"></div>
            </div>
          </div>
        ) : (
          <CustomDropdown
            options={positionOptions}
            selectedOption={
              selectedPosition
                ? positionOptions.find((opt) => opt.id === selectedPosition.id)
                : null
            }
            onSelect={(option) => {
              if (Array.isArray(option)) return;
              const selectedPosition = positions.filter(
                (position) => position.id === option.id
              );
              setSelectedPosition(selectedPosition[0]);
            }}
            placeholder={
              selectedClient
                ? t("bulkTimesheetManagement.placeholders.selectPosition")
                : t("bulkTimesheetManagement.placeholders.clientFirst")
            }
            disabled={!selectedClient}
            loading={false}
            icon={null}
            emptyMessage={
              selectedClient
                ? t("bulkTimesheetManagement.constants.noPositionsFound")
                : t("bulkTimesheetManagement.placeholders.positionSelectHelp")
            }
          />
        )}
      </div>
      <div className="selection-section">
        <label className="selection-label">
          {t("bulkTimesheetManagement.columns.weekPeriod")}
        </label>
        <CustomDropdown
          options={weekDropdownOptions}
          selectedOption={
            selectedWeekStart
              ? weekDropdownOptions.find(
                  (opt) => opt.value === selectedWeekStart
                )
              : null
          }
          onSelect={(option) => {
            if (Array.isArray(option)) return;
            setSelectedWeekStart(option.value as string);
          }}
          placeholder={t("bulkTimesheetManagement.placeholders.selectWeek")}
          loading={false}
          icon={null}
          emptyMessage={t("common.noData")}
          searchable={false}
        />
      </div>
    </div>
  );
}
