import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useLanguage } from "../../contexts/language/language-provider";
import { useTimesheetsList } from "./hooks/useTimesheetsList";
import { Pagination } from "../../components/Pagination";
import { timesheetPaginationLabels } from "./functions/timesheetPaginationLabels";
import { TimesheetListTable } from "./components/TimesheetListTable";
import "../../styles/pages/InvoiceManagement.css";
import "../../styles/pages/BulkTimesheetManagement.css";

export function TimesheetList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const list = useTimesheetsList(t);
  const paginationLabels = timesheetPaginationLabels(t, list.pagination);

  return (
    <div className="page-container timesheet-list-page">
      <AppHeader
        title={t("bulkTimesheetManagement.listTitle")}
        actions={
          <div className="timesheet-list-header-actions">
            <button
              type="button"
              className="button primary button-icon"
              onClick={() => navigate("/bulk-timesheet-management")}
            >
              <Plus size={16} />
              <span>{t("bulkTimesheetManagement.newBulkTimesheetClient")}</span>
            </button>
            <button
              type="button"
              className="button secondary button-icon"
              onClick={() => navigate("/bulk-timesheet-management/jobseeker")}
            >
              <Plus size={16} />
              <span>
                {t("bulkTimesheetManagement.newBulkTimesheetJobseeker")}
              </span>
            </button>
          </div>
        }
        statusMessage={list.message || list.error}
        statusType={list.error ? "error" : "success"}
      />
      <div className="content-container">
        <div className="card">
          <Pagination
            position="top"
            pagination={list.pagination}
            labels={paginationLabels}
            onLimitChange={list.handleLimitChange}
          />
          <TimesheetListTable
            t={t}
            loading={list.loading}
            timesheets={list.timesheets}
            pagination={list.pagination}
            invoiceNumberFilter={list.invoiceNumberFilter}
            setInvoiceNumberFilter={list.setInvoiceNumberFilter}
            clientFilter={list.clientFilter}
            setClientFilter={list.setClientFilter}
            positionFilter={list.positionFilter}
            setPositionFilter={list.setPositionFilter}
            jobseekerFilter={list.jobseekerFilter}
            setJobseekerFilter={list.setJobseekerFilter}
            billingEmailFilter={list.billingEmailFilter}
            setBillingEmailFilter={list.setBillingEmailFilter}
            dateRangeStart={list.dateRangeStart}
            setDateRangeStart={list.setDateRangeStart}
            dateRangeEnd={list.dateRangeEnd}
            setDateRangeEnd={list.setDateRangeEnd}
            emailSentFilter={list.emailSentFilter}
            setEmailSentFilter={list.setEmailSentFilter}
            sendingJobseekerEmail={list.sendingJobseekerEmail}
            onSendEmail={list.sendEmailToJobseeker}
            onEditTimesheet={list.handleEditTimesheet}
            onDeleteTimesheet={list.handleDeleteTimesheet}
            onViewTimesheet={list.handleViewTimesheet}
          />
          {!list.loading && (
            <Pagination
              position="bottom"
              pagination={list.pagination}
              labels={paginationLabels}
              onPageChange={list.handlePageChange}
              buttonType="button"
            />
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={list.isDeleteModalOpen}
        title={t("bulkTimesheetManagement.deleteModal.title")}
        message={
          t("bulkTimesheetManagement.deleteModal.message", {
            invoiceNumber:
              list.timesheetToDelete?.invoice_number ??
              t("bulkTimesheetManagement.constants.unknown"),
          }) + (list.deleteError ? `\n\nError: ${list.deleteError}` : "")
        }
        confirmText={t("bulkTimesheetManagement.deleteModal.confirmText")}
        cancelText={t("bulkTimesheetManagement.deleteModal.cancel")}
        confirmButtonClass="danger"
        onConfirm={() => void list.handleConfirmDelete()}
        onCancel={list.handleCancelDelete}
      />
    </div>
  );
}
