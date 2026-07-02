import type { NextFunction, Request, Response } from "express";
import { config } from "dotenv";
import CustomError from "../utils/CustomError.ts";

config();

const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const statusCode = err instanceof CustomError ? err.statusCode : 500;
	const message =
		err instanceof CustomError ? err.message : "Interner Server error";

	if (process.env.NODE_ENV !== "production") {
		console.log(err);
	}

	res.status(statusCode).json({
		success: false,
		message,
		...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
	});
};

export default errorHandler;
