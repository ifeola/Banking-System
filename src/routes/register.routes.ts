import express from "express";
import type { Router } from "express";
import { register } from "../controller/auth.controller.ts";
import catchError from "../utils/catchError.ts";

const router: Router = express.Router();

router.post("/", catchError(register));

export default router;
