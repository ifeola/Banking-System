import { Router } from "express";
import user from "../controller/transfer.controller.ts";

const router: Router = Router();

router.get("/", user);

export default router;
