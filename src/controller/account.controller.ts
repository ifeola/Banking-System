import type { Request, Response, NextFunction } from "express";

const Account = (req: Request, res: Response, next: NextFunction) => {
	return res.send("Hello world");
};

export default Account;
