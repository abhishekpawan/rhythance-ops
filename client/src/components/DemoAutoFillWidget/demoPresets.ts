import { UseFormSetValue } from "react-hook-form";
import { DemoFieldPreview } from "./DemoAutoFillWidget";

// ============================================================================
// JOB SEEKER DEMO DATA
// ============================================================================

export interface JobseekerDemoData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  mobile: string;
  licenseNumber: string;
  passportNumber: string;
  sinNumber: string;
  billingEmail: string;

  // Step 2: Address
  street: string;
  city: string;
  province: string;
  postalCode: string;

  // Step 3: Qualifications
  workPreference: string;
  bio: string;
  licenseType: string;
  experience: string;
  manualDriving: "Yes" | "No" | "NA";
  availability: "Full-Time" | "Part-Time";
  weekendAvailability: boolean;

  // Step 4: Compensation
  payrateType: "Hourly" | "Daily" | "Monthly";
  billRate: string;
  payRate: string;
  paymentMethod: string;
  hstGst: string;
  cashDeduction: string;
  sinPayrollHoursCap: string;
  overtimeEnabled: boolean;
  overtimeHours: string;
  overtimeBillRate: string;
  overtimePayRate: string;
}

export const JOBSEEKER_PRESETS: Record<string, { name: string; badge: string; data: JobseekerDemoData }> = {
  alex: {
    name: "Alexander (Forklift)",
    badge: "Warehouse & Forklift",
    data: {
      firstName: "Alexander",
      lastName: "Wright",
      dob: "1994-06-15",
      email: `alex.demo.${Math.floor(100 + Math.random() * 900)}@godspeedstaffing.com`,
      mobile: "4165550192",
      licenseNumber: "W1234-56789-01234",
      passportNumber: "AK9876543",
      sinNumber: "130692544", // Valid Luhn Canadian SIN
      billingEmail: "alex.wright.billing@example.com",

      street: "4500 Dixie Road, Unit 12",
      city: "Mississauga",
      province: "Ontario",
      postalCode: "L4W 1V7",

      workPreference: "General labour, warehouse operations, order picking, forklift material handling",
      bio: "Experienced warehouse and logistics associate with over 4 years of proven track record in inventory sorting, RF scanning, forklift operation, and timely dispatching across high-volume distribution centers.",
      licenseType: "Forklifter",
      experience: "3-4 Years",
      manualDriving: "Yes",
      availability: "Full-Time",
      weekendAvailability: true,

      payrateType: "Hourly",
      billRate: "0",
      payRate: "24.50",
      paymentMethod: "SIN-Direct Deposit",
      hstGst: "13",
      cashDeduction: "0",
      sinPayrollHoursCap: "",
      overtimeEnabled: true,
      overtimeHours: "44",
      overtimeBillRate: "0",
      overtimePayRate: "36.75",
    },
  },
  priya: {
    name: "Priya (AZ Driver)",
    badge: "Commercial Transport",
    data: {
      firstName: "Priya",
      lastName: "Sharma",
      dob: "1992-09-22",
      email: `priya.demo.${Math.floor(100 + Math.random() * 900)}@godspeedstaffing.com`,
      mobile: "9055550143",
      licenseNumber: "S9876-54321-09876",
      passportNumber: "ZP8271635",
      sinNumber: "130692544",
      billingEmail: "priya.sharma.billing@example.com",

      street: "8250 Lawson Road, Suite 305",
      city: "Milton",
      province: "Ontario",
      postalCode: "L9T 5C4",

      workPreference: "AZ commercial truck driving, long haul, regional delivery, flatbed, temperature-controlled freight",
      bio: "Dedicated AZ commercial driver with clean CVOR abstract and 5+ years of cross-border and regional hauling experience. Strong safety record, skilled in electronic logbooks and preventative inspections.",
      licenseType: "AZ",
      experience: "5+ Years",
      manualDriving: "Yes",
      availability: "Full-Time",
      weekendAvailability: true,

      payrateType: "Hourly",
      billRate: "0",
      payRate: "32.00",
      paymentMethod: "Corporation-Direct Deposit",
      hstGst: "13",
      cashDeduction: "0",
      sinPayrollHoursCap: "",
      overtimeEnabled: true,
      overtimeHours: "44",
      overtimeBillRate: "0",
      overtimePayRate: "48.00",
    },
  },
};

export function getJobseekerFieldsForStep(
  step: number,
  presetKey: string = "alex"
): DemoFieldPreview[] {
  const preset = JOBSEEKER_PRESETS[presetKey]?.data || JOBSEEKER_PRESETS.alex.data;

  switch (step) {
    case 1:
      return [
        { label: "First Name", value: preset.firstName },
        { label: "Last Name", value: preset.lastName },
        { label: "Date of Birth", value: preset.dob },
        { label: "Email", value: preset.email },
        { label: "Mobile", value: preset.mobile },
        { label: "SIN Number", value: preset.sinNumber },
        { label: "License No.", value: preset.licenseNumber },
        { label: "Passport", value: preset.passportNumber },
      ];
    case 2:
      return [
        { label: "Street Address", value: preset.street },
        { label: "City", value: preset.city },
        { label: "Province", value: preset.province },
        { label: "Postal Code", value: preset.postalCode },
      ];
    case 3:
      return [
        { label: "Work Preference", value: preset.workPreference },
        { label: "License Type", value: preset.licenseType },
        { label: "Experience", value: preset.experience },
        { label: "Manual Driving", value: preset.manualDriving },
        { label: "Availability", value: preset.availability },
        { label: "Weekend Avail.", value: preset.weekendAvailability },
        { label: "Professional Bio", value: `${preset.bio.slice(0, 48)}...` },
      ];
    case 4:
      return [
        { label: "Pay Rate Type", value: preset.payrateType },
        { label: "Pay Rate ($/hr)", value: `$${preset.payRate}` },
        { label: "Payment Method", value: preset.paymentMethod },
        { label: "HST/GST", value: `${preset.hstGst}%` },
        { label: "Overtime Enabled", value: preset.overtimeEnabled },
        { label: "Overtime Threshold", value: `${preset.overtimeHours} hrs` },
        { label: "Overtime Pay Rate", value: `$${preset.overtimePayRate}` },
      ];
    default:
      return [];
  }
}

export function autoFillJobseekerStep(
  step: number,
  setValue: UseFormSetValue<any>,
  presetKey: string = "alex"
) {
  const preset = JOBSEEKER_PRESETS[presetKey]?.data || JOBSEEKER_PRESETS.alex.data;

  switch (step) {
    case 1:
      setValue("firstName", preset.firstName, { shouldValidate: true, shouldDirty: true });
      setValue("lastName", preset.lastName, { shouldValidate: true, shouldDirty: true });
      setValue("dob", preset.dob, { shouldValidate: true, shouldDirty: true });
      setValue("email", preset.email, { shouldValidate: true, shouldDirty: true });
      setValue("mobile", preset.mobile, { shouldValidate: true, shouldDirty: true });
      setValue("sinNumber", preset.sinNumber, { shouldValidate: true, shouldDirty: true });
      setValue("licenseNumber", preset.licenseNumber, { shouldValidate: true, shouldDirty: true });
      setValue("passportNumber", preset.passportNumber, { shouldValidate: true, shouldDirty: true });
      setValue("billingEmail", preset.billingEmail, { shouldValidate: true, shouldDirty: true });
      setValue("businessNumber", "", { shouldValidate: true, shouldDirty: true });
      setValue("corporationName", "", { shouldValidate: true, shouldDirty: true });
      setValue("workPermitUci", "", { shouldValidate: true, shouldDirty: true });
      setValue("workPermitExpiry", "", { shouldValidate: true, shouldDirty: true });
      setValue("sinExpiry", "", { shouldValidate: true, shouldDirty: true });
      break;

    case 2:
      setValue("street", preset.street, { shouldValidate: true, shouldDirty: true });
      setValue("city", preset.city, { shouldValidate: true, shouldDirty: true });
      setValue("province", preset.province, { shouldValidate: true, shouldDirty: true });
      setValue("postalCode", preset.postalCode, { shouldValidate: true, shouldDirty: true });
      break;

    case 3:
      setValue("workPreference", preset.workPreference, { shouldValidate: true, shouldDirty: true });
      setValue("bio", preset.bio, { shouldValidate: true, shouldDirty: true });
      setValue("licenseType", preset.licenseType, { shouldValidate: true, shouldDirty: true });
      setValue("experience", preset.experience, { shouldValidate: true, shouldDirty: true });
      setValue("manualDriving", preset.manualDriving, { shouldValidate: true, shouldDirty: true });
      setValue("availability", preset.availability, { shouldValidate: true, shouldDirty: true });
      setValue("weekendAvailability", preset.weekendAvailability, { shouldValidate: true, shouldDirty: true });
      break;

    case 4:
      setValue("payrateType", preset.payrateType, { shouldValidate: true, shouldDirty: true });
      setValue("billRate", "0", { shouldValidate: true, shouldDirty: true });
      setValue("payRate", preset.payRate, { shouldValidate: true, shouldDirty: true });
      setValue("paymentMethod", preset.paymentMethod, { shouldValidate: true, shouldDirty: true });
      setValue("hstGst", preset.hstGst, { shouldValidate: true, shouldDirty: true });
      setValue("cashDeduction", "0", { shouldValidate: true, shouldDirty: true });
      setValue("sinPayrollHoursCap", "", { shouldValidate: true, shouldDirty: true });
      setValue("overtimeEnabled", preset.overtimeEnabled, { shouldValidate: true, shouldDirty: true });
      setValue("overtimeHours", preset.overtimeHours, { shouldValidate: true, shouldDirty: true });
      setValue("overtimeBillRate", "0", { shouldValidate: true, shouldDirty: true });
      setValue("overtimePayRate", preset.overtimePayRate, { shouldValidate: true, shouldDirty: true });
      break;
  }
}

// ============================================================================
// POSITION DEMO DATA
// ============================================================================

export interface PositionDemoData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  showOnJobPortal: boolean;
  stat: boolean;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  employmentTerm: string;
  employmentType: string;
  positionCategory: string;
  experience: string;
  numberOfPositions: number;
  regularPayRate: string;
  premiumPayRate: string;
  markup: string;
  billRate: string;
  payrateType: string;
  overtimeEnabled: boolean;
  overtimeHours: string;
  overtimeBillRate: string;
  overtimePayRate: string;
  preferredPaymentMethod: string;
  terms: string;
  notes: string;
  documentsRequired: {
    license: boolean;
    sin: boolean;
    resume: boolean;
    cvor?: boolean;
    passport?: boolean;
  };
}

const getTodayFormatted = () => new Date().toISOString().split("T")[0];
const getFutureDateFormatted = (monthsAhead: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().split("T")[0];
};

export const POSITION_PRESETS: Record<string, { name: string; data: PositionDemoData }> = {
  forklift: {
    name: "Forklift Operator (Mississauga)",
    data: {
      title: "Forklift Operator",
      description: "Certified Counterbalance and Raymond Reach forklift operator needed for cross-dock distribution operations. Responsibilities include safe freight staging, truck loading/unloading, and RF inventory scanning.",
      startDate: getTodayFormatted(),
      endDate: getFutureDateFormatted(12),
      showOnJobPortal: true,
      stat: true,
      streetAddress: "6500 Airport Road",
      city: "Mississauga",
      province: "Ontario",
      postalCode: "L4V 1E8",
      employmentTerm: "Permanent",
      employmentType: "Full-time",
      positionCategory: "Forklifter",
      experience: "2-3 Years",
      numberOfPositions: 3,
      regularPayRate: "24.00",
      premiumPayRate: "26.00",
      markup: "25.00",
      billRate: "30.00",
      payrateType: "Hourly",
      overtimeEnabled: true,
      overtimeHours: "44",
      overtimeBillRate: "45.00",
      overtimePayRate: "36.00",
      preferredPaymentMethod: "Direct Deposit",
      terms: "Net 30",
      notes: "Day shift: Mon-Fri 07:00 - 15:30. CSA green triangle safety footwear mandatory. Safety vest provided.",
      documentsRequired: {
        license: true,
        sin: true,
        resume: true,
      },
    },
  },
  generalLabour: {
    name: "General Labour (Brampton)",
    data: {
      title: "General Labour",
      description: "Reliable warehouse packaging and order sorting associates needed for dynamic logistics facility. Light packaging, labeling, pallet wrapping, and quality checks.",
      startDate: getTodayFormatted(),
      endDate: getFutureDateFormatted(6),
      showOnJobPortal: true,
      stat: true,
      streetAddress: "1200 Steeles Avenue East",
      city: "Brampton",
      province: "Ontario",
      postalCode: "L6T 1A1",
      employmentTerm: "Temporary",
      employmentType: "Full-time",
      positionCategory: "Warehouse",
      experience: "1-2 Years",
      numberOfPositions: 5,
      regularPayRate: "18.50",
      premiumPayRate: "20.00",
      markup: "27.03",
      billRate: "23.50",
      payrateType: "Hourly",
      overtimeEnabled: true,
      overtimeHours: "44",
      overtimeBillRate: "35.25",
      overtimePayRate: "27.75",
      preferredPaymentMethod: "Direct Deposit",
      terms: "Net 15",
      notes: "Afternoon shift: 15:30 - 23:30. Light lifting up to 30 lbs. Friendly team atmosphere.",
      documentsRequired: {
        license: false,
        sin: true,
        resume: true,
      },
    },
  },
};

export function getPositionPreviewFields(presetKey: string = "forklift"): DemoFieldPreview[] {
  const p = POSITION_PRESETS[presetKey]?.data || POSITION_PRESETS.forklift.data;
  return [
    { label: "Job Title", value: p.title },
    { label: "Category", value: p.positionCategory },
    { label: "No. of Positions", value: p.numberOfPositions },
    { label: "Term & Type", value: `${p.employmentTerm} • ${p.employmentType}` },
    { label: "Location", value: `${p.city}, ${p.province}` },
    { label: "Pay Rate", value: `$${p.regularPayRate}/hr` },
    { label: "Bill Rate", value: `$${p.billRate}/hr` },
    { label: "Markup", value: `${p.markup}%` },
    { label: "Overtime", value: `${p.overtimeHours}h cap • $${p.overtimePayRate}/hr` },
    { label: "Start Date", value: p.startDate },
    { label: "End Date", value: p.endDate },
    { label: "Portal Visible", value: p.showOnJobPortal },
  ];
}

// ============================================================================
// CLIENT DEMO DATA
// ============================================================================

export interface ClientDemoData {
  companyName: string;
  billingName: string;
  shortCode: string;
  website: string;
  currency: "CAD" | "USD";
  workProvince: string;
  wsibCode: string;
  contactPersonName1: string;
  emailAddress1: string;
  mobile1: string;
  contactPersonName2: string;
  emailAddress2: string;
  mobile2: string;
  invoiceCC2: boolean;
  dispatchDeptEmail: string;
  invoiceCCDispatch: boolean;
  accountsDeptEmail: string;
  invoiceCCAccounts: boolean;
  invoiceLanguage: "English" | "French";
  streetAddress1: string;
  city1: string;
  province1: string;
  postalCode1: string;
  preferredPaymentMethod: string;
  terms: string;
  payCycle: string;
  creditLimit: string;
  notes: string;
}

export const CLIENT_PRESETS: Record<string, { name: string; data: ClientDemoData }> = {
  apex: {
    name: "Apex Global Logistics",
    data: {
      companyName: "Apex Global Logistics Inc.",
      billingName: "Apex Global Logistics Inc.",
      shortCode: `APX${Math.floor(1 + Math.random() * 9)}`,
      website: "https://apexlogistics.ca",
      currency: "CAD",
      workProvince: "ON",
      wsibCode: "G1",
      contactPersonName1: "Michael Vance",
      emailAddress1: "operations@apexlogistics.ca",
      mobile1: "+1 (905) 555-0188",
      contactPersonName2: "Sarah Jenkins",
      emailAddress2: "accounting@apexlogistics.ca",
      mobile2: "+1 (905) 555-0189",
      invoiceCC2: true,
      dispatchDeptEmail: "dispatch@apexlogistics.ca",
      invoiceCCDispatch: true,
      accountsDeptEmail: "invoices@apexlogistics.ca",
      invoiceCCAccounts: true,
      invoiceLanguage: "English",
      streetAddress1: "2500 Derry Road East",
      city1: "Mississauga",
      province1: "ON",
      postalCode1: "L5S 1Y6",
      preferredPaymentMethod: "Direct Deposit",
      terms: "Net 30",
      payCycle: "1 Week Hold - Weekly Pay",
      creditLimit: "50000",
      notes: "Key enterprise client. Weekly invoice schedule with consolidated job order reporting.",
    },
  },
  northline: {
    name: "Northline Cold Storage",
    data: {
      companyName: "Northline Cold Storage Solutions Ltd.",
      billingName: "Northline Cold Storage Solutions Ltd.",
      shortCode: `NCS${Math.floor(1 + Math.random() * 9)}`,
      website: "https://northlinecold.ca",
      currency: "CAD",
      workProvince: "ON",
      wsibCode: "W2",
      contactPersonName1: "David Tremblay",
      emailAddress1: "d.tremblay@northlinecold.ca",
      mobile1: "+1 (416) 555-0144",
      contactPersonName2: "Elena Rostova",
      emailAddress2: "payables@northlinecold.ca",
      mobile2: "+1 (416) 555-0145",
      invoiceCC2: true,
      dispatchDeptEmail: "dispatch@northlinecold.ca",
      invoiceCCDispatch: true,
      accountsDeptEmail: "billing@northlinecold.ca",
      invoiceCCAccounts: true,
      invoiceLanguage: "English",
      streetAddress1: "7400 Bramalea Road",
      city1: "Brampton",
      province1: "ON",
      postalCode1: "L6T 5S3",
      preferredPaymentMethod: "Direct Deposit",
      terms: "Net 15",
      payCycle: "2 Week Hold - Biweekly Pay",
      creditLimit: "75000",
      notes: "Refrigerated and cold-chain facility. Thermal PPE equipment provided on site.",
    },
  },
};

export function getClientPreviewFields(presetKey: string = "apex"): DemoFieldPreview[] {
  const c = CLIENT_PRESETS[presetKey]?.data || CLIENT_PRESETS.apex.data;
  return [
    { label: "Company Name", value: c.companyName },
    { label: "Short Code", value: c.shortCode },
    { label: "Work Province", value: c.workProvince },
    { label: "WSIB Code", value: c.wsibCode },
    { label: "Primary Contact", value: c.contactPersonName1 },
    { label: "Contact Email", value: c.emailAddress1 },
    { label: "Contact Phone", value: c.mobile1 },
    { label: "Address", value: `${c.streetAddress1}, ${c.city1}` },
    { label: "Currency", value: c.currency },
    { label: "Payment Terms", value: c.terms },
    { label: "Pay Cycle", value: c.payCycle },
    { label: "Credit Limit", value: `$${c.creditLimit}` },
  ];
}
