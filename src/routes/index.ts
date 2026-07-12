import { Router } from "express";
import userRouter from "./user.route.ts";
import loginRouter from "./login.route.ts";
import registerRouter from "./register.route.ts";
import { logout, refresh } from "../controller/auth.controller.ts";
import catchError from "../utils/catchError.ts";

const router: Router = Router();

router.use("/users", userRouter);
router.use("/auth/login", loginRouter);
router.use("/auth/register", registerRouter);
router.post("/auth/logout", catchError(logout));
router.post("/auth/refresh", catchError(refresh));

export default router;
