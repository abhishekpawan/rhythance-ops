import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import { useLanguage } from "../../contexts/language/language-provider";
import { Info, Users } from "lucide-react";
import { mapAssignmentToJobseeker } from "./functions/mapAssignmentToJobseeker";
import "../../styles/pages/BulkTimesheetManagement.css";
import "../../styles/pages/TimesheetManagement.css";
import { useTimesheetFormTranslation } from "./hooks/useTimesheetFormTranslation";
import { useBulkTimesheetSelection } from "./hooks/useBulkTimesheetSelection";
import { useBulkJobseekerWeekPrefetch } from "./hooks/useBulkJobseekerWeekPrefetch";
import { useBulkTimesheetForms } from "./hooks/useBulkTimesheetForms";
import { useBulkTimesheetSubmit } from "./hooks/useBulkTimesheetSubmit";
import { BulkActionSection } from "./components/BulkActionSection";
import { BulkClientHeader } from "./components/BulkClientHeader";
import { BulkClientSelectionBar } from "./components/BulkClientSelectionBar";
import { BulkFinalSummary } from "./components/BulkFinalSummary";
import { BulkGeneratingOverlay } from "./components/BulkGeneratingOverlay";
import { BulkRowCard } from "./components/BulkRowCard";
import { BulkSubcategoryBanner } from "./components/BulkSubcategoryBanner";

export function BulkTimesheetManagement() {
  const { t } = useLanguage();
  const tf = useTimesheetFormTranslation();

  const selection = useBulkTimesheetSelection();
  const {
    clients,
    selectedClient,
    setSelectedClient,
    clientLoading,
    positions,
    selectedPosition,
    setSelectedPosition,
    positionLoading,
    clientPosition,
    weekOptions,
    selectedWeekStart,
    setSelectedWeekStart,
    assignedJobseekers,
    assignmentsLoading,
    resetSelection,
  } = selection;

  const prefetchEnabled = Boolean(
    selectedClient &&
    selectedPosition &&
    selectedWeekStart &&
    assignedJobseekers.length > 0
  );

  const { hoursLoading, getMatchingForAssignment } =
    useBulkJobseekerWeekPrefetch({
      assignments: assignedJobseekers,
      weekStartDate: selectedWeekStart,
      positionId: selectedPosition?.id,
      enabled: prefetchEnabled,
    });

  const {
    rows,
    updateEntry,
    updateBonus,
    updateDeduction,
    updateNotes,
    removeJobseeker,
    updateJobseekerEmailSent,
    updateAllJobseekersEmailSent,
    clearRows,
    payrollCtxForRow,
  } = useBulkTimesheetForms({
    assignments: assignedJobseekers,
    selectedWeekStart,
    clientPosition,
    hoursLoading,
    getMatchingForAssignment,
  });

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
    onSuccessReset: () => {
      resetSelection();
      clearRows();
      setSendEmail(false);
    },
  });

  useEffect(() => {
    if (rows.length > 0) {
      setSendEmail(rows.every((row) => row.emailSent));
    }
  }, [rows]);

  const handleGenerateBulk = () => {
    if (
      !selectedClient ||
      !clientPosition ||
      !selectedWeekStart ||
      rows.length === 0
    ) {
      setGenerationError(t("bulkTimesheetManagement.messages.cannotGenerate"));
      return;
    }
    const submitRows = rows
      .map((row) => {
        const jobseeker = mapAssignmentToJobseeker(row.assignment);
        const profile = row.assignment.jobseekerProfile;
        const progressLabel =
          `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
          "Unknown";
        if (!jobseeker) return null;
        return {
          form: row.form,
          emailSent: row.emailSent,
          clientPosition,
          jobseeker,
          progressLabel,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    void generateBulkTimesheets(submitRows, selectedWeekStart);
  };

  const showJobseekerForms =
    selectedClient &&
    selectedPosition &&
    selectedWeekStart &&
    assignedJobseekers.length > 0 &&
    !hoursLoading &&
    rows.length > 0;

  const currentPos = clientPosition || selectedPosition;
  const isPosSubcat = !!currentPos?.isSubcategory;
  const isPosMiles =
    isPosSubcat &&
    String(currentPos?.subcategoryPosition || "")
      .toLowerCase()
      .startsWith("miles");
  const rawSubcat = currentPos?.subcategoryPosition;
  const posSubcatLabel = Array.isArray(rawSubcat)
    ? rawSubcat[0] || "Units"
    : rawSubcat
      ? String(rawSubcat)
      : "Units";
  const posColUnitHeader = isPosMiles
    ? "MILES"
    : isPosSubcat
      ? "QTY / UNITS"
      : tf("colHours");
  const posRateSuffix = isPosMiles ? "/mi" : isPosSubcat ? "/unit" : "";

  return (
    <div className="bulk-timesheet-page-container timesheet-page-container">
      {/* Full-screen loader overlay */}
      {isGenerating && (
        <BulkGeneratingOverlay
          t={t}
          generationMessage={generationMessage}
          currentInvoiceNumber={currentInvoiceNumber}
        />
      )}

      <AppHeader
        title={t("bulkTimesheetManagement.title")}
        hideHamburgerMenu={false}
        statusMessage={
          generationError || (!isGenerating ? generationMessage : "")
        }
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />
      <div className="timesheet-content-container">
        <p className="bulk-timesheet-selection-hint" role="note">
          <Info size={16} aria-hidden />
          {t("bulkTimesheetManagement.selectionHint")}
        </p>

        <BulkClientSelectionBar
          t={t}
          clients={clients}
          positions={positions}
          weekOptions={weekOptions}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          clientLoading={clientLoading}
          selectedPosition={selectedPosition}
          setSelectedPosition={setSelectedPosition}
          positionLoading={positionLoading}
          selectedWeekStart={selectedWeekStart}
          setSelectedWeekStart={setSelectedWeekStart}
        />

        {/* Move client info header below selection bar, as a separate section */}
        {selectedClient && (
          <BulkClientHeader
            t={t}
            selectedClient={selectedClient}
            selectedPosition={selectedPosition}
            selectedWeekStart={selectedWeekStart}
          />
        )}

        {/* Subcategory position info banner */}
        {selectedPosition?.isSubcategory && <BulkSubcategoryBanner t={t} />}

        {selectedClient &&
          selectedPosition &&
          !positionLoading &&
          !assignmentsLoading &&
          assignedJobseekers.length === 0 && (
            <div className="timesheet-card empty-state-card">
              <div className="timesheet-empty-state">
                <Users size={48} />
                <h3>{t("bulkTimesheetManagement.empty.noJobseekersTitle")}</h3>
                <p>{t("bulkTimesheetManagement.empty.noJobseekersBody")}</p>
              </div>
            </div>
          )}

        {prefetchEnabled && hoursLoading && (
          <div className="bulk-timesheet-forms-container">
            <Loader
              variant="inline"
              message={t("bulkTimesheetManagement.messages.loadingForms")}
            />
          </div>
        )}

        {/* Timesheet input for each jobseeker */}
        {showJobseekerForms && (
          <div className="bulk-timesheet-forms-container">
            {rows.map((row) => (
              <BulkRowCard
                key={row.assignment.id}
                t={t}
                tf={tf}
                row={row}
                rowsCount={rows.length}
                selectedPosition={selectedPosition}
                clientPosition={clientPosition}
                posColUnitHeader={posColUnitHeader}
                payrollCtxForRow={payrollCtxForRow}
                removeJobseeker={removeJobseeker}
                updateEntry={updateEntry}
                updateBonus={updateBonus}
                updateDeduction={updateDeduction}
                updateNotes={updateNotes}
                updateJobseekerEmailSent={updateJobseekerEmailSent}
              />
            ))}

            {/* Separate Final Summary Table */}
            <BulkFinalSummary
              t={t}
              rows={rows}
              selectedPosition={selectedPosition}
              isPosMiles={isPosMiles}
              isPosSubcat={isPosSubcat}
              posSubcatLabel={posSubcatLabel}
              posColUnitHeader={posColUnitHeader}
              posRateSuffix={posRateSuffix}
            />

            <BulkActionSection
              t={t}
              rows={rows}
              isGenerating={isGenerating}
              sendEmail={sendEmail}
              setSendEmail={setSendEmail}
              updateAllJobseekersEmailSent={updateAllJobseekersEmailSent}
              handleGenerateBulk={handleGenerateBulk}
            />
          </div>
        )}
      </div>
    </div>
  );
}
