import type { NextFunction, Request, Response } from "express";

type AsyncHandler = (
	req: Request,
	res: Response,
	next: NextFunction
) => Promise<void | Response>;

const catchError = (errorHandler: AsyncHandler) => {
	return function (req: Request, res: Response, next: NextFunction) {
		errorHandler(req, res, next).catch((error) => next(error));
	};
};

export default catchError;
