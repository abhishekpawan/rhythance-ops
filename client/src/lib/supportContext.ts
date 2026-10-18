import { SupportContext, SupportFailedRequest } from "../types/support";

// Max items for ring buffers
const MAX_ERRORS = 5;
const MAX_FAILED_REQUESTS = 5;
const MAX_ERROR_LENGTH = 300;

const consoleErrorsBuffer: string[] = [];
const failedRequestsBuffer: SupportFailedRequest[] = [];

let isInitialized = false;

/**
 * Truncates and sanitizes an error string to max 300 characters.
 */
function sanitizeErrorString(err: unknown): string {
  if (typeof err === "string") {
    return err.slice(0, MAX_ERROR_LENGTH);
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`.slice(0, MAX_ERROR_LENGTH);
  }
  try {
    return JSON.stringify(err).slice(0, MAX_ERROR_LENGTH);
  } catch {
    return String(err).slice(0, MAX_ERROR_LENGTH);
  }
}

/**
 * Adds a console or window error message to the circular buffer.
 */
export function recordConsoleError(errorMsg: unknown): void {
  const sanitized = sanitizeErrorString(errorMsg);
  if (!sanitized) return;

  if (consoleErrorsBuffer.length >= MAX_ERRORS) {
    consoleErrorsBuffer.shift();
  }
  consoleErrorsBuffer.push(sanitized);
}

/**
 * Records a failed API request into the buffer.
 * Strips query string and hash; never logs bodies, headers, or tokens.
 */
export function recordFailedApiCall(req: {
  method: string;
  path: string;
  status: number;
  time?: string;
}): void {
  const rawPath = req.path || "";
  const cleanPath = rawPath.split("?")[0].split("#")[0].slice(0, 500);

  const entry: SupportFailedRequest = {
    method: (req.method || "GET").toUpperCase().slice(0, 10),
    path: cleanPath,
    status: Number(req.status) || 0,
    time: req.time || new Date().toISOString(),
  };

  if (failedRequestsBuffer.length >= MAX_FAILED_REQUESTS) {
    failedRequestsBuffer.shift();
  }
  failedRequestsBuffer.push(entry);
}

/**
 * Initializes error listeners once on app start.
 */
export function initSupportContextCapture(): void {
  if (isInitialized || typeof window === "undefined") {
    return;
  }
  isInitialized = true;

  // Intercept window error events
  window.addEventListener("error", (event: ErrorEvent) => {
    recordConsoleError(event.message || event.error);
  });

  // Intercept unhandled promise rejections
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    recordConsoleError(event.reason);
  });

  // Intercept console.error calls while preserving original console behavior
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    try {
      const formatted = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? `${a.name}: ${a.message}` : ""))
        .filter(Boolean)
        .join(" ");
      if (formatted) {
        recordConsoleError(formatted);
      }
    } catch {
      // Ignore capture errors
    }
    originalConsoleError.apply(console, args);
  };
}

/**
 * Parses browser and OS from navigator.userAgent.
 * Browser: Chrome/Edge/Firefox/Safari with major version.
 * OS: Windows/macOS/Linux/Android/iOS.
 */
export function parseBrowserAndOs(): { browser: string; os: string } {
  if (typeof navigator === "undefined") {
    return { browser: "Unknown", os: "Unknown" };
  }

  const ua = navigator.userAgent;

  // OS Detection
  let os = "Other";
  if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Win/i.test(ua)) {
    os = "Windows";
  } else if (/Mac/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // Browser Detection
  let browser = "Other";
  const edgeMatch = ua.match(/Edg(?:e)?\/(\d+)/);
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  const safariMatch = ua.match(/Version\/(\d+).*Safari/);

  if (edgeMatch) {
    browser = `Edge ${edgeMatch[1]}`;
  } else if (chromeMatch) {
    browser = `Chrome ${chromeMatch[1]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1]}`;
  } else if (safariMatch) {
    browser = `Safari ${safariMatch[1]}`;
  }

  return { browser, os };
}

/**
 * Builds the technical support context to accompany a ticket.
 */
export function buildSupportContext(
  currentRoute?: string,
  overrideFromPage?: string,
  overrideLanguage?: string
): SupportContext {
  const { browser, os } = parseBrowserAndOs();

  const route =
    currentRoute ||
    (typeof window !== "undefined" ? window.location.pathname : undefined);

  let fromPage: string | undefined = overrideFromPage;
  let language = overrideLanguage || "en";

  if (typeof window !== "undefined") {
    if (!fromPage) {
      fromPage = sessionStorage.getItem("support.lastPage") || undefined;
    }
    if (!overrideLanguage) {
      language =
        localStorage.getItem("app-language") ||
        (navigator.language ? navigator.language.slice(0, 2) : "en");
    }
  }

  const build = typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : "dev";

  return {
    route,
    fromPage,
    language,
    browser,
    os,
    build,
    consoleErrors: [...consoleErrorsBuffer],
    failedRequests: [...failedRequestsBuffer],
  };
}

// Auto-initialize context capture on module load
if (typeof window !== "undefined") {
  initSupportContextCapture();
}
