import { z } from "zod";

export const newTicketSchema = z.object({
  type: z.enum(["bug", "change", "feature"] as const, {
    required_error: "Please select what you need",
  }),
  description: z
    .string()
    .min(10, "Please provide at least 10 characters to describe what happened")
    .max(10000, "Description is too long"),
  urgency: z.enum(["blocked", "annoying", "not_urgent"] as const, {
    required_error: "Please indicate how urgent this is",
  }),
});

export type NewTicketFormData = z.infer<typeof newTicketSchema>;
