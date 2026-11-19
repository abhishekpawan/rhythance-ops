import { Router } from "express";
import ticketMessagesRouter from "./ticketMessages.js";
import ticketConfirmRouter from "./ticketConfirm.js";
import ticketReopenRouter from "./ticketReopen.js";
import ticketPatchRouter from "./ticketPatch.js";

const router = Router();

router.use(ticketMessagesRouter);
router.use(ticketConfirmRouter);
router.use(ticketReopenRouter);
router.use(ticketPatchRouter);

export default router;
