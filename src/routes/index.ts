import { Router } from "express";
import userRouter from "./user.route.ts";
import loginRouter from "./login.route.ts";

const router: Router = Router();

router.use("/users", userRouter);
router.use("/auth/login", loginRouter);

export default router;
