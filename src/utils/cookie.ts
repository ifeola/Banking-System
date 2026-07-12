import type { Response, CookieOptions } from "express";
import { createRefreshToken } from "./jwt.ts";

const createCookieOptions = (maxAge: number): CookieOptions => {
	return {
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		httpOnly: true,
		path: "/api/v1/auth",
		maxAge,
	};
};

const setRefreshCookie = (res: Response, userId: string) => {
	const { token, hash } = createRefreshToken(userId);
	const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
	res.cookie("jwtRefresh", token, createCookieOptions(refreshMaxAge));

	return { token, hash };
};

export { setRefreshCookie };
