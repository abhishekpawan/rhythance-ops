import "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    stack: { dbUrl: string; apiUrl: string; anonKey: string; serviceKey: string; jwtSecret: string };
    serverUrl: string;
    outboundLog: string;
    serverWorkDir: string;
    fixedClockServerUrl: string;
  }
}
