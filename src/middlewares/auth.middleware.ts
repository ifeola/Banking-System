import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import CustomError from "../utils/CustomError.ts";
import type { AuthenticatedRequest } from "../types/types.ts";
config();

const authenticate = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	let token;
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		token = req.headers.authorization?.split(" ")[1];
	}

	if (!token) {
		return next(
			new CustomError("Authentication falied, please try again", 401)
		);
	}

	try {
		const decoded = jwt.verify(
			token,
			process.env.JWT_ACCESS_SECRET as string
		) as { user_id: string };
		req.user = decoded;
		next();
	} catch (error) {
		next(error);
	}
};

export { authenticate };
