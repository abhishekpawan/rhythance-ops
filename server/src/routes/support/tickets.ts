import { Router } from "express";
import ticketCreateRouter from "./ticketCreate.js";
import ticketListRouter from "./ticketList.js";
import ticketGetRouter from "./ticketGet.js";

const router = Router();

router.use(ticketCreateRouter);
router.use(ticketListRouter);
router.use(ticketGetRouter);

export default router;
