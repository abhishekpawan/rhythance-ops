import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/BulkTimesheetManagement.css";
import "../../styles/pages/TimesheetManagement.css";
import { useBulkJobseekerTimesheetSelection } from "./hooks/useBulkJobseekerTimesheetSelection";
import { useBulkJobseekerPositionForms } from "./hooks/useBulkJobseekerPositionForms";
import { useBulkJobseekerPositionOptions } from "./hooks/useBulkJobseekerPositionOptions";
import { useBulkJobseekerGenerate } from "./hooks/useBulkJobseekerGenerate";
import { useJobseekerWeekTimesheets } from "./hooks/useJobseekerWeekTimesheets";
import { useBulkTimesheetSubmit } from "./hooks/useBulkTimesheetSubmit";
import { useTimesheetFormTranslation } from "./hooks/useTimesheetFormTranslation";
import { BulkJobseekerActionSection } from "./components/BulkJobseekerActionSection";
import { BulkJobseekerGeneratingOverlay } from "./components/BulkJobseekerGeneratingOverlay";
import { BulkJobseekerGrandSummary } from "./components/BulkJobseekerGrandSummary";
import { BulkJobseekerPositionRows } from "./components/BulkJobseekerPositionRows";
import { BulkJobseekerProfileStrip } from "./components/BulkJobseekerProfileStrip";
import { BulkJobseekerSelectionBar } from "./components/BulkJobseekerSelectionBar";

export function BulkTimesheetJobseekerManagement() {
  const { t } = useLanguage();

  const tf = useTimesheetFormTranslation();

  const selection = useBulkJobseekerTimesheetSelection();

  const {
    selectedJobseeker,

    setSelectedJobseeker,

    jobseekerLoading,

    selectedClient,

    setSelectedClient,

    clientLoading,

    assignablePositions,

    positionLoading,

    selectedWeekStart,

    setSelectedWeekStart,

    jobseekerOptions,

    clientOptions,

    weekDropdownOptions,

    selectedJobseekerOption,

    selectedClientOption,

    selectedWeekOption,

    resetSelection,
  } = selection;

  const prefetchEnabled = Boolean(
    selectedJobseeker?.userId && selectedWeekStart && selectedClient
  );

  const { weekTimesheets, loading: weekTsLoading } = useJobseekerWeekTimesheets(
    {
      jobseekerUserId: prefetchEnabled ? selectedJobseeker!.userId : undefined,

      weekStartDate: prefetchEnabled ? selectedWeekStart : undefined,

      enabled: prefetchEnabled,
    }
  );

  const forms = useBulkJobseekerPositionForms({
    jobseeker: selectedJobseeker,

    selectedClientId: selectedClient?.id ?? null,

    selectedWeekStart,

    hoursLoading: weekTsLoading,

    weekTimesheetsForJobseeker: weekTimesheets,

    assignablePositions,

    positionLoading,
  });

  const {
    rows,

    setRowPosition,

    addRow,

    removeRow,

    updateRowEntry,

    updateRowBonus,

    updateRowDeduction,

    updateRowNotes,

    updateRowEmailSent,

    updateAllRowsEmailSent,

    clearRowsAndDraft,

    payrollCtxForRow,
  } = forms;

  const [sendEmail, setSendEmail] = useState(false);

  const {
    isGenerating,

    generationMessage,

    generationError,

    currentInvoiceNumber,

    generateBulkTimesheets,

    setGenerationError,
  } = useBulkTimesheetSubmit({
    t,

    translationNamespace: "bulkJobseekerTimesheetManagement",

    onSuccessReset: () => {
      resetSelection();

      clearRowsAndDraft();

      setSendEmail(false);
    },
  });

  useEffect(() => {
    const rowsWithForm = rows.filter((row) => row.form);

    if (rowsWithForm.length === 0) {
      return;
    }

    setSendEmail(rowsWithForm.every((row) => row.emailSent));
  }, [rows]);

  const { unknownPositionFallback, positionDropdownOptionsForRow } =
    useBulkJobseekerPositionOptions(t, rows, assignablePositions);

  const handleGenerate = useBulkJobseekerGenerate({
    t,
    rows,
    selectedJobseeker,
    selectedClient,
    selectedWeekStart,
    unknownPositionFallback,
    setGenerationError,
    generateBulkTimesheets,
  });

  const workbenchReady =
    selectedJobseeker && selectedClient && selectedWeekStart && !weekTsLoading;

  return (
    <div className="bulk-timesheet-page-container bulk-jobseeker-bulk-page timesheet-page-container">
      {isGenerating ? (
        <BulkJobseekerGeneratingOverlay
          t={t}
          generationMessage={generationMessage}
          currentInvoiceNumber={currentInvoiceNumber}
        />
      ) : null}

      <AppHeader
        title={t("bulkJobseekerTimesheetManagement.title")}
        hideHamburgerMenu={false}
        statusMessage={
          generationError || (!isGenerating ? generationMessage : "")
        }
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />

      <div className="timesheet-content-container">
        <BulkJobseekerSelectionBar
          tf={tf}
          selectedJobseeker={selectedJobseeker}
          setSelectedJobseeker={setSelectedJobseeker}
          jobseekerLoading={jobseekerLoading}
          jobseekerOptions={jobseekerOptions}
          selectedJobseekerOption={selectedJobseekerOption}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          clientLoading={clientLoading}
          clientOptions={clientOptions}
          selectedClientOption={selectedClientOption}
          setSelectedWeekStart={setSelectedWeekStart}
          weekDropdownOptions={weekDropdownOptions}
          selectedWeekOption={selectedWeekOption}
        />

        {selectedJobseeker ? (
          <BulkJobseekerProfileStrip
            t={t}
            selectedJobseeker={selectedJobseeker}
            showAddRow={Boolean(
              workbenchReady &&
              !(selectedClient && assignablePositions.length === 0)
            )}
            addRow={addRow}
          />
        ) : null}

        {prefetchEnabled && weekTsLoading ? (
          <div className="bulk-timesheet-forms-container">
            <Loader
              variant="inline"
              message={t(
                "bulkJobseekerTimesheetManagement.messages.loadingWeekData"
              )}
            />
          </div>
        ) : null}

        {selectedJobseeker &&
          selectedClient &&
          !positionLoading &&
          assignablePositions.length === 0 && (
            <div className="timesheet-card empty-state-card">
              <div className="timesheet-empty-state">
                <FileText size={48} />

                <h3>{tf("empty.noPositionsTitle")}</h3>

                <p>
                  {t(
                    "bulkJobseekerTimesheetManagement.empty.noAssignmentsForClient"
                  )}
                </p>
              </div>
            </div>
          )}

        {workbenchReady &&
        !(selectedClient && assignablePositions.length === 0) ? (
          <div className="bulk-timesheet-forms-container bulk-jobseeker-forms">
            <BulkJobseekerPositionRows
              t={t}
              tf={tf}
              rows={rows}
              positionLoading={positionLoading}
              positionDropdownOptionsForRow={positionDropdownOptionsForRow}
              payrollCtxForRow={payrollCtxForRow}
              setRowPosition={setRowPosition}
              removeRow={removeRow}
              updateRowEntry={updateRowEntry}
              updateRowBonus={updateRowBonus}
              updateRowDeduction={updateRowDeduction}
              updateRowNotes={updateRowNotes}
              updateRowEmailSent={updateRowEmailSent}
            />

            {rows.some((r) => r.form) ? (
              <BulkJobseekerGrandSummary t={t} tf={tf} rows={rows} />
            ) : null}

            <BulkJobseekerActionSection
              t={t}
              rows={rows}
              isGenerating={isGenerating}
              sendEmail={sendEmail}
              setSendEmail={setSendEmail}
              updateAllRowsEmailSent={updateAllRowsEmailSent}
              handleGenerate={handleGenerate}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
