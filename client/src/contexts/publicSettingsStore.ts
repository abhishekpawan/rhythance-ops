/**
 * The portal's public settings (brand name, legal text, switcher list, ...) kept
 * outside React so that the translation function can use them too. The last
 * values are remembered in this browser so the page can render with the right
 * brand straight away on later visits.
 */
const STORAGE_KEY = "portal-public-settings";

type Listener = () => void;

function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // storage blocked or corrupted: start empty
  }
  return {};
}

let values: Record<string, string> = readCache();
let loaded = Object.keys(values).length > 0;
const listeners = new Set<Listener>();

export function getPublicSettings(): Record<string, string> {
  return values;
}

/** True once values exist, either remembered from before or just fetched. */
export function hasPublicSettings(): boolean {
  return loaded;
}

export function setPublicSettings(next: Record<string, string>): void {
  values = next;
  loaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: keep working without the cache
  }
  listeners.forEach((listener) => listener());
}

export function subscribePublicSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replaces {{brandName}} in a translated text. */
export function applyBrandTokens(text: string): string {
  if (!text.includes("{{brand")) return text;
  return text.replace(/\{\{brandName\}\}/g, values["branding.brandName"] ?? "");
}
