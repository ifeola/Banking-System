import type { Request, Response, NextFunction } from "express";
import { initiateTransferSchema } from "../schemas/schema.ts";
import db from "../database/db.ts";
import CustomError from "../utils/CustomError.ts";

const user = async (req: Request, res: Response, next: NextFunction) => {
	const input = initiateTransferSchema.parse(req.body);
	const userId = req.user!.id;

	const client = await db.pool.connect();

	try {
		await client.query("BEGIN");

		const existing = await client.query(
			"SELECT * FROM transactions WHERE idempotency_key = $1",
			[input.idempotencyKey]
		);
		if (existing.rows.length > 0) {
			await client.query("ROLLBACK");
			return res.status(200).json({ transaction: existing.rows[0] });
		}

		const accountResult = await client.query(
			`
			SELECT a.id, a.status, a.user_id
			FROM accounts a WHERE a.id = $1 FOR UPDATE;
			`,
			[input.sourceAccountId]
		);

		const account = accountResult.rows[0];

		if (!account) next(new CustomError("Account not found", 404));
	} catch (error) {}
};

export default user;
