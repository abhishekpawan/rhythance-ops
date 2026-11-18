// Stand-in for twilio in the test server: records the Verify calls, sends no SMS.
// The code "000000" is the only one a check approves.
import { record } from "../record.mjs";

function twilio() {
  return {
    verify: {
      v2: {
        services: () => ({
          verifications: {
            create: async ({ to, channel }) => {
              record({ kind: "sms", to, channel });
              return { status: "pending", to, channel, sid: "VE-test" };
            },
          },
          verificationChecks: {
            create: async ({ to, code }) => {
              record({ kind: "sms-check", to });
              return {
                status: code === "000000" ? "approved" : "pending",
                to,
                valid: code === "000000",
              };
            },
          },
        }),
      },
    },
  };
}

export default twilio;
export { twilio };
