import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Mail, AlertCircle, Download } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import { useLanguage } from "../../contexts/language/language-provider";
import { supabase } from "../../lib/supabaseClient";
import {
  getTimesheet,
  sendTimesheetEmails,
} from "../../services/api/timesheet";
import type { TimesheetWithJoins } from "../../services/types/timesheet";
import { TimesheetViewMainCards } from "./components/TimesheetViewMainCards";
import { TimesheetViewSideCards } from "./components/TimesheetViewSideCards";
import "../../styles/pages/TimesheetView.css";

export function TimesheetView() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const timesheetId = paramId || searchParams.get("id");

  const [timesheet, setTimesheet] = useState<TimesheetWithJoins | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Signed document URL state
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimesheetDetails = async () => {
      if (!timesheetId) {
        setError("Timesheet ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getTimesheet(timesheetId);
        setTimesheet(data);

        // Fetch PDF signed URL if document path exists
        if (data.document) {
          fetchSignedPdfUrl(data.document);
        }
      } catch (err) {
        console.error("Error fetching timesheet details:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load timesheet details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTimesheetDetails();
  }, [timesheetId]);

  const fetchSignedPdfUrl = async (path: string) => {
    try {
      const cleanPath = path.replace(/&#x2F;/g, "/");
      const { data, error: storageErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(cleanPath, 3600);

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      } else if (storageErr) {
        console.error(
          "Error creating signed URL for timesheet document:",
          storageErr
        );
      }
    } catch (err) {
      console.error("Error fetching signed URL:", err);
    }
  };

  const handleSendEmail = async () => {
    if (!timesheetId || !timesheet) return;
    try {
      setIsSendingEmail(true);
      setError(null);
      const res = await sendTimesheetEmails(timesheetId);
      setStatusMessage(res.message || "Email sent successfully.");
      setTimesheet((prev) => (prev ? { ...prev, email_sent: true } : prev));
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error("Error sending timesheet email:", err);
      setError(err instanceof Error ? err.message : "Failed to send email.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadPdf = () => {
    if (pdfSignedUrl) {
      window.open(pdfSignedUrl, "_blank");
    }
  };

  const handleEdit = () => {
    if (!timesheet) return;
    const profileId = timesheet.jobseeker_profiles?.id ?? "";
    const clientId = timesheet.positions?.client ?? "";
    const positionId = timesheet.positions?.id ?? "";
    const weekStart = timesheet.week_start_date ?? "";

    const params = new URLSearchParams();
    if (profileId) params.set("profileId", profileId);
    if (clientId) params.set("clientId", clientId);
    if (positionId) params.set("positionId", positionId);
    if (weekStart) params.set("weekStart", weekStart);

    if (timesheet.is_bulk) {
      navigate(`/bulk-timesheet-management/jobseeker?${params.toString()}`);
    } else {
      navigate(`/timesheet-management?${params.toString()}`);
    }
  };

  if (loading) {
    return (
      <div className="timesheet-view-page-container">
        <AppHeader title={t("timesheetForm.viewTitle") || "View Timesheet"} />
        <div className="timesheet-view-loading-container">
          <Loader
            variant="inline"
            size="lg"
            message={t("common.loading") || "Loading..."}
          />
        </div>
      </div>
    );
  }

  if (error || !timesheet) {
    return (
      <div className="timesheet-view-page-container">
        <AppHeader title={t("timesheetForm.viewTitle") || "View Timesheet"} />
        <div className="timesheet-view-content">
          <div
            className="timesheet-view-card"
            style={{ textAlign: "center", padding: "40px 20px" }}
          >
            <AlertCircle
              size={48}
              color="#ef4444"
              style={{ marginBottom: "16px" }}
            />
            <h3>{error || "Timesheet not found"}</h3>
            <button
              className="button secondary"
              style={{ marginTop: "16px" }}
              onClick={() => navigate("/timesheet-management/list")}
            >
              <ArrowLeft size={16} /> Back to Timesheet List
            </button>
          </div>
        </div>
      </div>
    );
  }

  const profile = timesheet.jobseeker_profiles;
  const position = timesheet.positions;

  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Unknown Jobseeker";

  const dailyHoursList = Array.isArray(timesheet.daily_hours)
    ? timesheet.daily_hours
    : [];

  const positionLocation = [position?.city, position?.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="timesheet-view-page-container">
      <AppHeader
        title={`View Timesheet #${timesheet.invoice_number || timesheet.id}`}
        statusMessage={statusMessage || error}
        statusType={error ? "error" : "success"}
        actions={
          <div className="timesheet-view-actions-group">
            <button
              className="button secondary"
              onClick={() => navigate("/timesheet-management/list")}
            >
              <ArrowLeft size={16} /> Back to List
            </button>
            {pdfSignedUrl && (
              <button className="button secondary" onClick={handleDownloadPdf}>
                <Download size={16} /> Download PDF
              </button>
            )}
            <button
              className="button secondary"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
            >
              <Mail size={16} />{" "}
              {isSendingEmail
                ? "Sending..."
                : timesheet.email_sent
                  ? "Resend Email"
                  : "Send Email"}
            </button>
            <button className="button primary" onClick={handleEdit}>
              <Pencil size={16} /> Edit Timesheet
            </button>
          </div>
        }
      />

      <div className="timesheet-view-content">
        <div className="timesheet-view-grid">
          {/* Main Content Column */}
          <div className="timesheet-view-left-col">
            <TimesheetViewMainCards
              timesheet={timesheet}
              dailyHoursList={dailyHoursList}
            />
          </div>

          {/* Sidebar / Meta Column */}
          <div className="timesheet-view-right-col">
            <TimesheetViewSideCards
              timesheet={timesheet}
              profile={profile}
              position={position}
              fullName={fullName}
              positionLocation={positionLocation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
