import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/language/language-provider";
import { pagesFor, startPrefetch } from "../routes/prefetchPages";
import { Loader } from "./Loader";

// What the app shows while pages are on their way (they are loaded on demand, routes/lazyPages.ts). App.tsx runs
// navigation as a React transition (<Router future={{ v7_startTransition: true }}>), so moving to a page that is
// not downloaded yet keeps the open page on screen; only a first visit shows PageLoader.

/** The full-page spinner shown while the code of a page that was never opened before is still downloading. */
export function PageLoader() {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Loader variant="inline" size="lg" message={t("common.loading")} />
    </div>
  );
}

/** Renders nothing. Once a person is signed in and a page is on screen, fetches the other pages they can open. */
export function PagePrefetch() {
  const { user, isAuthenticated, isLoading, isSuperAdmin } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    // the dev server compiles a module when it is asked for: fetching every page ahead would only slow it down
    if (import.meta.env.DEV || isLoading || !isAuthenticated) return;
    return startPrefetch(pagesFor(user, isSuperAdmin));
    // the list depends on who is signed in, not on the user object, which is replaced when the session refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAuthenticated, isLoading, isSuperAdmin]);
  return null;
}
