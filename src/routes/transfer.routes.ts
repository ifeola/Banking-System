import express from "express";
import type { Router } from "express";
import catchError from "../utils/catchError.ts";
import transfer from "../controller/transfer.controller.ts";

const router: Router = express.Router();

router.post("/", catchError(transfer));

export default router;
