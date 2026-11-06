import { z } from "zod";
import { isHybridPaymentMethod } from "../../lib/hybridPayrollSplit";

// Define the form schema types for each step
export const getPersonalInfoSchema = (messages: Record<string, string>) =>
  z
    .object({
      firstName: z.string().min(1, { message: messages.firstNameRequired }),
      lastName: z.string().min(1, { message: messages.lastNameRequired }),
      dob: z.string().min(1, { message: messages.dobRequired }),
      email: z.string().email({ message: messages.emailInvalid }),
      billingEmail: z
        .string()
        .email({ message: messages.emailInvalid })
        .optional()
        .or(z.literal("")),
      mobile: z
        .string()
        .min(1, { message: messages.mobileRequired })
        .regex(/^[0-9+\-()\s]+$/, { message: "Invalid phone number format" }),
      licenseNumber: z.string().optional(),
      passportNumber: z.string().optional(),
      governmentIdType: z.string().optional(),
      sinNumber: z.string().min(1, { message: messages.sinNumberRequired }),
      sinExpiry: z.string().optional(),
      workPermitUci: z.string().optional(),
      workPermitExpiry: z.string().optional(),
      businessNumber: z.string().optional(),
      corporationName: z.string().optional(),
    })
    .refine((data) => data.licenseNumber || data.passportNumber, {
      message: messages.licenseOrPassportRequired,
      path: ["licenseNumber"],
    })
    .refine(
      (data) => {
        // Only require SIN expiry for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.sinExpiry && data.sinExpiry.trim() !== "";
        }
        return true;
      },
      {
        message: messages.sinExpiryRequired,
        path: ["sinExpiry"],
      }
    )
    .refine(
      (data) => {
        // Only require work permit UCI for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.workPermitUci && data.workPermitUci.trim() !== "";
        }
        return true;
      },
      {
        message: messages.workPermitUciRequired,
        path: ["workPermitUci"],
      }
    )
    .refine(
      (data) => {
        // Validate UCI format if provided
        if (data.workPermitUci && data.workPermitUci.trim() !== "") {
          const uciValue = data.workPermitUci.trim();
          // Check if UCI is exactly 8 or 10 digits
          if (!/^\d{8}$|^\d{10}$/.test(uciValue)) {
            return false;
          }
        }
        return true;
      },
      {
        message: messages.workPermitUciInvalid,
        path: ["workPermitUci"],
      }
    )
    .refine(
      (data) => {
        // Only require work permit expiry for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.workPermitExpiry && data.workPermitExpiry.trim() !== "";
        }
        return true;
      },
      {
        message: messages.workPermitExpiryRequired,
        path: ["workPermitExpiry"],
      }
    );

export const getAddressQualificationsSchema = (
  messages: Record<string, string>
) =>
  z.object({
    street: z.string().min(1, { message: messages.streetRequired }),
    city: z.string().min(1, { message: messages.cityRequired }),
    province: z.string().min(1, { message: messages.provinceRequired }),
    postalCode: z.string().min(1, { message: messages.postalCodeRequired }),
    workPreference: z.string().min(10, {
      message: messages.workPreferenceRequired,
    }),
    bio: z
      .string()
      .min(100, {
        message: messages.bioRequired,
      })
      .max(500, { message: messages.bioMaxLength }),
    licenseType: z.string().min(1, { message: messages.licenseTypeRequired }),
    experience: z.string().min(1, { message: messages.experienceRequired }),
    manualDriving: z.enum(["NA", "Yes", "No"]),
    availability: z.enum(["Full-Time", "Part-Time"]),
    weekendAvailability: z.boolean().default(false),
  });

export const getCompensationSchema = () =>
  z
    .object({
      payrateType: z.enum(["Hourly", "Daily", "Monthly"]).optional(),
      billRate: z.string().optional(),
      payRate: z.string().optional(),
      paymentMethod: z.string().optional(),
      hstGst: z.string().optional(),
      cashDeduction: z.string().optional(),
      sinPayrollHoursCap: z.string().optional(),
      overtimeEnabled: z.boolean().default(false),
      overtimeHours: z.string().optional(),
      overtimeBillRate: z.string().optional(),
      overtimePayRate: z.string().optional(),
    })
    .refine(
      (data) => {
        if (!isHybridPaymentMethod(data.paymentMethod)) return true;
        const v = parseFloat((data.sinPayrollHoursCap || "").trim());
        return !Number.isNaN(v) && v > 0;
      },
      { path: ["sinPayrollHoursCap"], message: "SIN payroll hours required" }
    );

// Document Upload Schema
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const getSingleDocumentSchema = (messages: Record<string, string>) =>
  z
    .object({
      documentType: z
        .string()
        .min(1, { message: messages.documentTypeRequired }),
      documentTitle: z.string().optional(),
      documentFile: z
        .instanceof(File, { message: messages.documentFileRequired })
        .refine((file) => file?.size <= MAX_FILE_SIZE, messages.maxFileSize)
        .refine(
          (file) => ALLOWED_FILE_TYPES.includes(file?.type),
          messages.onlyPdfFiles
        )
        .optional(),
      documentNotes: z.string().optional(),
      documentPath: z.string().optional(),
      documentFileName: z.string().optional(),
      id: z.string().optional(),
    })
    .refine(
      (data) => {
        const hasFile = !!data.documentPath || !!data.documentFile;
        return hasFile;
      },
      {
        message: messages.documentFileRequired,
        path: ["documentFile"],
      }
    );

export const getDocumentUploadSchema = (messages: Record<string, string>) =>
  z.object({
    documents: z
      .array(getSingleDocumentSchema(messages))
      .min(1, { message: messages.atLeastOneDocumentRequired }),
  });

// Function to create form schema with translated messages
/**
 * `lightRules` switches to the lighter profile rules (feature flag
 * jobseeker_profile_godspeed_rules): the driver's licence number is required, the
 * SIN number and most address/qualification fields are optional, and the mandatory
 * document is a driver's licence or passport instead of SIN + government ID.
 */
export const createFormSchema = (
  messages: Record<string, string>,
  lightRules = false
) => {
  const optionalText = z.string().optional().or(z.literal(""));

  return z
    .object({
      // Personal info fields
      firstName: z.string().min(1, { message: messages.firstNameRequired }),
      lastName: z.string().min(1, { message: messages.lastNameRequired }),
      dob: z.string().min(1, { message: messages.dobRequired }),
      email: z.string().email({ message: messages.emailInvalid }),
      billingEmail: z
        .string()
        .email({ message: messages.emailInvalid })
        .optional()
        .or(z.literal("")),
      mobile: z
        .string()
        .min(1, { message: messages.mobileRequired })
        .regex(/^[0-9+\-()\s]+$/, { message: "Invalid phone number format" }),
      licenseNumber: lightRules
        ? z.string().min(1, {
            message:
              messages.licenseNumberRequired ||
              "Driver's license number is required",
          })
        : z.string().optional(),
      passportNumber: lightRules ? optionalText : z.string().optional(),
      governmentIdType: lightRules ? optionalText : z.string().optional(),
      sinNumber: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.sinNumberRequired }),
      sinExpiry: lightRules ? optionalText : z.string().optional(),
      workPermitUci: lightRules ? optionalText : z.string().optional(),
      workPermitExpiry: lightRules ? optionalText : z.string().optional(),
      businessNumber: lightRules ? optionalText : z.string().optional(),
      corporationName: lightRules ? optionalText : z.string().optional(),

      // Address & Qualifications fields
      street: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.streetRequired }),
      city: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.cityRequired }),
      province: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.provinceRequired }),
      postalCode: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.postalCodeRequired }),
      workPreference: lightRules
        ? optionalText
        : z.string().min(10, {
            message: messages.workPreferenceRequired,
          }),
      bio: lightRules
        ? z
            .string()
            .max(500, { message: messages.bioMaxLength })
            .optional()
            .or(z.literal(""))
        : z
            .string()
            .min(100, {
              message: messages.bioRequired,
            })
            .max(500, { message: messages.bioMaxLength }),
      licenseType: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.licenseTypeRequired }),
      experience: lightRules
        ? optionalText
        : z.string().min(1, { message: messages.experienceRequired }),
      manualDriving: lightRules
        ? z.enum(["NA", "Yes", "No"]).optional().default("NA")
        : z.enum(["NA", "Yes", "No"]),
      availability: lightRules
        ? z.enum(["Full-Time", "Part-Time"]).optional().or(z.literal(""))
        : z.enum(["Full-Time", "Part-Time"]),
      weekendAvailability: z.boolean().default(false),

      // Compensation fields
      payrateType: z.enum(["Hourly", "Daily", "Monthly"]).optional(),
      billRate: z.string().optional(),
      payRate: z.string().optional(),
      paymentMethod: z.string().optional(),
      hstGst: z.string().optional(),
      cashDeduction: z.string().optional(),
      sinPayrollHoursCap: z.string().optional(),
      overtimeEnabled: z.boolean().default(false),
      overtimeHours: z.string().optional(),
      overtimeBillRate: z.string().optional(),
      overtimePayRate: z.string().optional(),

      // Document upload fields
      documents: z
        .array(getSingleDocumentSchema(messages))
        .min(1, { message: messages.atLeastOneDocumentRequired }),
    })
    .refine(
      (data) => lightRules || !!(data.licenseNumber || data.passportNumber),
      {
        message: messages.licenseOrPassportRequired,
        path: ["licenseNumber"],
      }
    )
    .superRefine((data, ctx) => {
      const hasUploaded = (types: string[]) =>
        data.documents.some(
          (doc) =>
            types.includes(doc.documentType) &&
            (doc.documentFile || doc.documentPath)
        );

      if (lightRules) {
        // Driver's licence or passport (government ID accepted for older profiles)
        if (!hasUploaded(["drivers_license", "passport", "government_id"])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              messages.dlOrPassportDocumentRequired ||
              "Driver's license or passport document is required",
            path: ["documents"],
          });
        }
        return;
      }

      if (!hasUploaded(["sin"])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.documentFileRequired || "SIN document is required",
          path: ["documents"],
        });
      }
      if (!hasUploaded(["government_id"])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            messages.documentFileRequired ||
            "Government ID document is required",
          path: ["documents"],
        });
      }
    })
    .refine(
      (data) => {
        // Only require work permit document for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.trim().startsWith("9")
        ) {
          const hasWorkPermitDoc = data.documents.some(
            (doc) =>
              doc.documentType === "work_permit" &&
              (doc.documentFile || doc.documentPath)
          );
          if (!hasWorkPermitDoc) {
            return false;
          }
        }
        return true;
      },
      {
        message:
          messages.workPermitUciRequired ||
          "Work permit document is required for temporary residents",
        path: ["documents"],
      }
    )
    .refine(
      (data) => {
        // Only require SIN expiry for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.sinExpiry && data.sinExpiry.trim() !== "";
        }
        return true;
      },
      {
        message: messages.sinExpiryRequired,
        path: ["sinExpiry"],
      }
    )
    .refine(
      (data) => {
        // Only require work permit UCI for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.workPermitUci && data.workPermitUci.trim() !== "";
        }
        return true;
      },
      {
        message: messages.workPermitUciRequired,
        path: ["workPermitUci"],
      }
    )
    .refine(
      (data) => {
        // Validate UCI format if provided
        if (data.workPermitUci && data.workPermitUci.trim() !== "") {
          const uciValue = data.workPermitUci.trim();
          // Check if UCI is exactly 8 or 10 digits
          if (!/^\d{8}$|^\d{10}$/.test(uciValue)) {
            return false;
          }
        }
        return true;
      },
      {
        message: messages.workPermitUciInvalid,
        path: ["workPermitUci"],
      }
    )
    .refine(
      (data) => {
        // Only require work permit expiry for temporary residents (SIN starting with '9')
        if (
          data.sinNumber &&
          data.sinNumber.trim() !== "" &&
          data.sinNumber.startsWith("9")
        ) {
          return data.workPermitExpiry && data.workPermitExpiry.trim() !== "";
        }
        return true;
      },
      {
        message: messages.workPermitExpiryRequired,
        path: ["workPermitExpiry"],
      }
    )
    .refine(
      (data) => {
        if (!isHybridPaymentMethod(data.paymentMethod)) return true;
        const v = parseFloat((data.sinPayrollHoursCap || "").trim());
        return !Number.isNaN(v) && v > 0;
      },
      {
        message: "SIN payroll hours required",
        path: ["sinPayrollHoursCap"],
      }
    );
};

// Type inference for form data
export type JobseekerProfileFormData = z.infer<
  ReturnType<typeof createFormSchema>
>;
export type PersonalInfoFormData = z.infer<
  ReturnType<typeof getPersonalInfoSchema>
>;
export type AddressQualificationsFormData = z.infer<
  ReturnType<typeof getAddressQualificationsSchema>
>;
export type CompensationFormData = z.infer<
  ReturnType<typeof getCompensationSchema>
>;
