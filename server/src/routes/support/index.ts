import { Router } from "express";
import attachmentsRouter from "./attachments.js";
import ticketsRouter from "./tickets.js";
import ticketActionsRouter from "./ticketActions.js";

const router = Router();

router.use(attachmentsRouter);
router.use(ticketsRouter);
router.use(ticketActionsRouter);

export default router;
