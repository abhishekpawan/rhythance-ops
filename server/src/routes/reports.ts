import { Router } from "express";
import timesheetReport from "./reports/timesheetReport.js";
import marginReport from "./reports/marginReport.js";
import invoiceReport from "./reports/invoiceReport.js";
import deductionReport from "./reports/deductionReport.js";
import rateListReport from "./reports/rateListReport.js";
import clientsReport from "./reports/clientsReport.js";
import salesReport from "./reports/salesReport.js";
import envelopePrintingPositionReport from "./reports/envelopePrintingPositionReport.js";
import envelopePrintingByDueDateReport from "./reports/envelopePrintingByDueDateReport.js";

const router = Router();

router.use(timesheetReport);
router.use(marginReport);
router.use(invoiceReport);
router.use(deductionReport);
router.use(rateListReport);
router.use(clientsReport);
router.use(salesReport);
router.use(envelopePrintingPositionReport);
router.use(envelopePrintingByDueDateReport);

export default router;
