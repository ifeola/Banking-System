import { Router } from "express";
import userRouter from "./user.routes.ts";
import loginRouter from "./login.routes.ts";
import registerRouter from "./register.routes.ts";
import { logout, refresh } from "../controller/auth.controller.ts";
import catchError from "../utils/catchError.ts";
import transferRouter from "./transfer.routes.ts";

const router: Router = Router();

router.use("/users", userRouter);
router.use("/auth/login", loginRouter);
router.use("/auth/register", registerRouter);
router.post("/transfer", transferRouter);
router.post("/auth/logout", catchError(logout));
router.post("/auth/refresh", catchError(refresh));

export default router;
