import { Router } from "express";
import { login } from "../controller/auth.controller.ts";
import catchError from "../utils/catchError.ts";

const router = Router();

router.post("/", catchError(login));

export default login;
