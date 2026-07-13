import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import CustomError from "../utils/CustomError.ts";
import type { User, LoginInput } from "../validators/register.ts";
import db from "../database/db.ts";
import { setRefreshCookie } from "../utils/cookie.ts";
import type { Response } from "express";
import { createAccessToken } from "../utils/jwt.ts";
import crypto from "crypto";

export async function registerUser(data: User) {
	const { first_name, last_name, email, phone, password } = data;

	const existing = await db.query(
		"SELECT id FROM users WHERE email = $1 OR phone = $2",
		[email, phone]
	);

	if (existing.rows.length > 0) {
		throw new CustomError("Email or phone already registered", 409);
	}

	const salt = await bcrypt.genSalt(10);
	const password_hash = await bcrypt.hash(password, salt);

	const result = await db.query(
		`INSERT INTO users (first_name, last_name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, first_name, last_name, email, phone, created_at`,
		[first_name, last_name, email, phone, password_hash]
	);

	return result.rows[0];
}

export async function loginUser(data: LoginInput, res: Response) {
	const { phone, password } = data;

	const result = await db.query(
		"SELECT id, first_name, last_name, email, phone, password_hash FROM users WHERE phone = $1",
		[phone]
	);

	if (result.rows.length === 0) {
		throw new CustomError("Invalid phone or password", 401);
	}

	const user = result.rows[0];

	const valid = await bcrypt.compare(password, user.password_hash);
	if (!valid) {
		throw new CustomError("Invalid phone or password", 401);
	}

	const accessToken = createAccessToken(user.id);
	const { token: refreshToken, hash } = setRefreshCookie(res, user.id);

	const decoded = jwt.decode(refreshToken) as { exp: number };
	await db.query(
		"INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, to_timestamp($3))",
		[user.id, hash, decoded.exp]
	);

	return {
		user: {
			id: user.id,
			first_name: user.first_name,
			last_name: user.last_name,
			email: user.email,
			phone: user.phone,
		},
		refreshToken,
		accessToken,
		decoded,
	};
}

export async function refreshAccessToken(token: string) {
	const hash = crypto.createHash("sha256").update(token).digest("hex");

	const result = await db.query(
		"SELECT user_id FROM refresh_tokens WHERE token = $1",
		[hash]
	);

	if (result.rows.length === 0) {
		throw new CustomError("Invalid refresh token", 401);
	}

	try {
		const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {
			userId: string;
		};

		const newAccessToken = jwt.sign(
			{ userId: payload.userId, type: "access" },
			process.env.JWT_ACCESS_SECRET as string,
			{
				expiresIn: "15m",
			}
		);

		return { accessToken: newAccessToken };
	} catch {
		await db.query("DELETE FROM refresh_tokens WHERE token = $1", [token]);
		throw new CustomError("Refresh token expired", 401);
	}
}

export async function logoutUser(token: string) {
	await db.query("delete from refresh_tokens where token = $1", [token]);
}
