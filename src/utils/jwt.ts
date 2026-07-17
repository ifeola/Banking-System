import jwt from "jsonwebtoken";
import { config } from "dotenv";
import crypto from "crypto";

config();

const createAccessToken = (userId: string) => {
	const token = jwt.sign(
		{ user_id: userId, type: "access" },
		process.env.JWT_ACCESS_SECRET as string,
		{
			expiresIn: "15m",
		}
	);

	return token;
};

const createRefreshToken = (userId: string) => {
	const token = jwt.sign(
		{ user_id: userId, type: "refresh" },
		process.env.JWT_REFRESH_SECRET as string,
		{
			expiresIn: "7d",
		}
	);

	const hash = crypto.createHash("sha256").update(token).digest("hex");

	return { token, hash };
};

export { createAccessToken, createRefreshToken };
