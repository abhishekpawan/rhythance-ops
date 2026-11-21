import { useLanguage } from "../contexts/language/language-provider";
import { Loader } from "./Loader";

/** The full-page spinner shown while the code of a page that was never opened before is still downloading. */
export function PageLoader() {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Loader variant="inline" size="lg" message={t("common.loading")} />
    </div>
  );
}
