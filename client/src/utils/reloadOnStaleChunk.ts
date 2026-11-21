// After a deploy, a tab that was opened before it still holds the old index.html. When the person opens a page
// that was not loaded yet, the browser asks for a file (a page's code) that the new deploy no longer has, and the
// page would stay blank. Vite reports that as `vite:preloadError`: reload once, which fetches the new index.html
// and with it the new file names.
//
// It can never loop: a flag in sessionStorage says "this tab has reloaded for this", and it is cleared only after
// the page has been running for a while without the error coming back. A second error inside that time (the file
// is really gone, not just renamed) is left to show as an error instead of reloading again.

const FLAG = "reloaded-for-missing-chunk";
const CLEAR_AFTER_MS = 10_000;

export function reloadOnStaleChunk(
  target: Pick<Window, "addEventListener"> = window,
  reload: () => void = () => window.location.reload()
) {
  target.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(FLAG)) return; // already reloaded once: let the error show
    sessionStorage.setItem(FLAG, "1");
    event.preventDefault();
    reload();
  });
  // this page loaded: forget the flag once it has stayed up
  window.setTimeout(() => sessionStorage.removeItem(FLAG), CLEAR_AFTER_MS);
}
