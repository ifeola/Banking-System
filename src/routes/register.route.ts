import { Router } from "express";
import type { Router as RouterType } from "express";
import { register } from "../controller/auth.controller.ts";
import catchError from "../utils/catchError.ts";

const router: RouterType = Router();

router.post("/", catchError(register));

export default router;
