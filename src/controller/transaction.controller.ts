import type { Request, Response, NextFunction } from "express";

const user = (req: Request, res: Response, next: NextFunction) => {
	return res.send("Hello world");
};

export default user;
