import { Router } from "express";
import events from "./calendar/events.js";
import summary from "./calendar/summary.js";

const router = Router();

router.use(events);
router.use(summary);

export default router;
