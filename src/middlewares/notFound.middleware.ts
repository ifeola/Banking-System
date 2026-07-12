import type { NextFunction, Request, Response } from "express";
import CustomError from "../utils/CustomError.ts";

export function notFound(req: Request, _res: Response, next: NextFunction) {
	next(
		new CustomError(`Route not found: ${req.method} ${req.originalUrl}`, 404)
	);
}
