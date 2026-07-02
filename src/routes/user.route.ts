import { Router } from "express";
import user from "../controller/user.controller.ts";

const router: Router = Router();

router.get("/", user);

export default router;
