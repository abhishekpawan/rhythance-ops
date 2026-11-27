import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/language/language-provider";
import { usePortalSettings } from "../../../contexts/PortalSettingsContext";
import { useSearchParams, useNavigate } from "react-router-dom";

export function useInvoicePageHooks() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { values: portalSettings, ready: portalSettingsReady } =
    usePortalSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  return {
    user,
    t,
    portalSettings,
    portalSettingsReady,
    searchParams,
    navigate,
  };
}
