import type { NextFunction, Request, Response } from "express";

const login = (req: Request, res: Response, next: NextFunction) => {
	const { phone, password } = req.body;
	console.log(phone, password);

	return phone;
};
export { login };
