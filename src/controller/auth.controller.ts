import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { userSchema, loginSchema } from "../validators/register.ts";
import {
	registerUser,
	loginUser,
	refreshAccessToken,
	logoutUser,
} from "../services/auth.service.ts";
import CustomError from "../utils/CustomError.ts";
import Account from "../services/Account.service.ts";

export const register = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const parsed = userSchema.safeParse(req.body);
	if (!parsed.success) {
		return next(
			new CustomError(
				parsed.error?.issues[0]?.message ?? "Validation error",
				400
			)
		);
	}

	const user = await registerUser(parsed.data);
	const account_number = user.phone.slice(1);
	const account = await Account.create(user.id, account_number, "savings");
	res.status(201).json({
		success: true,
		message: "User registered",
		user: { ...user, ...account },
	});
};

export const login = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success) {
		return next(
			new CustomError(
				parsed.error?.issues[0]?.message ?? "Validation error",
				400
			)
		);
	}

	const result = await loginUser(parsed.data, res);

	res.json({
		success: true,
		user: result.user,
		accessToken: result.accessToken,
	});
};

export const refresh = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const token = req.cookies?.jwtRefresh;
	if (!token) {
		return next(new CustomError("No refresh token", 401));
	}

	const result = await refreshAccessToken(token);
	res.json({ success: true, accessToken: result.accessToken });
};

export const logout = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const token = req.cookies?.jwtRefresh;
	if (token) {
		const incomingHash = crypto
			.createHash("sha256")
			.update(token)
			.digest("hex");

		await logoutUser(incomingHash);
	}

	res.clearCookie("jwtRefresh", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		path: "/api/v1/auth",
	});

	return res.json({ success: true, message: "Logged out" });
};
