import type { Request } from "express";

interface AuthenticatedRequest extends Request {
	user?: {
		user_id: string;
	};
}

export type { AuthenticatedRequest };
