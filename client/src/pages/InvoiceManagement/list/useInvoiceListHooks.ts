import { useLanguage } from "../../../contexts/language/language-provider";
import { useNavigate, useLocation } from "react-router-dom";

export function useInvoiceListHooks() {
  const { t } = useLanguage();

  const navigate = useNavigate();
  const location = useLocation();

  return { t, navigate, location };
}
