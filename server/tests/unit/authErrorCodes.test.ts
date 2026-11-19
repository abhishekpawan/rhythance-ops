// DEV-2 (inbox 20): every `code` the sign-in and phone-code routes can send has a translation in English and
// French, and the client turns a code into the translated text.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_CODES,
  AuthApiError,
  authErrorMessage,
  toAuthApiError,
} from "../../../client/src/services/api/authErrors";

const root = path.resolve(__dirname, "../../..");
const text = (file: string) => readFileSync(path.join(root, file), "utf8");
const locale = (lang: "en" | "fr") =>
  JSON.parse(text(`client/src/contexts/language/locales/${lang}.json`));

const SERVER_FILES = [
  "server/src/routes/authSignIn.ts",
  "server/src/routes/authPhone.ts",
  "server/src/middleware/otpRateLimits.ts",
];
const serverCodes = new Set(
  SERVER_FILES.flatMap((f) =>
    [...text(f).matchAll(/code:\s*"([A-Z0-9_]+)"/g)].map((m) => m[1])
  )
);

describe("error codes", () => {
  it("the server sends codes (the scan finds them)", () => {
    expect(serverCodes.size).toBeGreaterThan(15);
  });

  it("the client knows every code the server can send", () => {
    expect(
      [...serverCodes].filter((c) => !AUTH_ERROR_CODES.includes(c as never))
    ).toEqual([]);
  });

  it("every code has a text in English and in French, and the two differ where the words differ", () => {
    for (const lang of ["en", "fr"] as const) {
      const errors = locale(lang).auth.errors;
      for (const code of AUTH_ERROR_CODES) {
        expect(typeof errors[code], `${lang} ${code}`).toBe("string");
        expect(errors[code].trim().length, `${lang} ${code}`).toBeGreaterThan(
          0
        );
      }
      expect(Object.keys(errors).sort()).toEqual([...AUTH_ERROR_CODES].sort());
    }
    // the sign-in error is the one every screen shows
    expect(locale("fr").auth.errors.INVALID_CREDENTIALS).not.toBe(
      locale("en").auth.errors.INVALID_CREDENTIALS
    );
  });
});

describe("authErrorMessage", () => {
  const t = (lang: "en" | "fr") => (key: string) =>
    key.split(".").reduce((o: any, k) => o?.[k], locale(lang)) ?? key;

  it("shows the translation of the server's code, in the language of the screen", () => {
    const error = new AuthApiError(
      "Invalid login credentials",
      "INVALID_CREDENTIALS",
      401
    );
    expect(authErrorMessage(error, t("en"), "auth.invalidCredentials")).toBe(
      "Invalid email or password"
    );
    expect(authErrorMessage(error, t("fr"), "auth.invalidCredentials")).toBe(
      "Email ou mot de passe invalide"
    );
  });

  it("falls back to the server's text for a code it does not know, then to the screen's own text", () => {
    expect(
      authErrorMessage(
        new AuthApiError("Something new", "NEW_CODE", 400),
        t("fr"),
        "x.y"
      )
    ).toBe("Something new");
    expect(authErrorMessage("nope", t("en"), "auth.invalidCredentials")).toBe(
      "Invalid email or password"
    );
  });

  it("toAuthApiError keeps the code and status of a server answer and passes other errors through", () => {
    // what axios.isAxiosError looks for (the server has no axios of its own)
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 429,
        data: { error: "Too many requests", code: "RATE_LIMITED" },
      },
    };
    const converted = toAuthApiError(axiosError, "fallback") as AuthApiError;
    expect(converted).toBeInstanceOf(AuthApiError);
    expect(converted.code).toBe("RATE_LIMITED");
    expect(converted.status).toBe(429);
    const other = new Error("network down");
    expect(toAuthApiError(other, "fallback")).toBe(other);
  });
});
