import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../contexts/language/language-provider";

export function useInvoiceViewHooks() {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  return { paramId, searchParams, navigate, t };
}
