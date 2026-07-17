import type { Response, NextFunction } from "express";
import { initiateTransferSchema } from "../schemas/schema.ts";
import db from "../database/db.ts";
import CustomError from "../utils/CustomError.ts";
import type { AuthenticatedRequest } from "../types/types.ts";

const transfer = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	const input = initiateTransferSchema.parse(req.body);
	const userId = req.user?.user_id;

	const client = await db.pool.connect();

	try {
		await client.query("BEGIN");

		// const existing = await client.query(
		// 	"SELECT * FROM transactions WHERE idempotency_key = $1",
		// 	[input.idempotencyKey]
		// );
		// if (existing.rows.length > 0) {
		// 	await client.query("ROLLBACK");
		// 	return res.status(200).json({ transaction: existing.rows[0] });
		// }

		const accountResult = await client.query(
			`
			SELECT a.id, a.status, a.user_id
			FROM accounts a WHERE a.id = $1 FOR UPDATE;
			`,
			[input.sourceAccountId]
		);

		const account = accountResult.rows[0];

		if (!account) return next(new CustomError("Account not found", 404));
		if (account.user_id !== userId)
			return next(new CustomError("Not authorized for this account", 403));
		if (account.status !== "active")
			return next(new CustomError("Account is not active", 400));

		const balanceResult = await client.query(
			`SELECT balance FROM accounts WHERE accounts.id = $1`,
			[input.sourceAccountId]
		);

		const currentBalance = parseFloat(balanceResult.rows[0].balance);

		if (currentBalance < input.amount) {
			return next(new CustomError("Insufficient funds", 404));
		}

		// const resolvedName = await resolveAccountName(
		// 	input.destinationBankCode,
		// 	input.destinationAccountNumber
		// );

		const to_acc = await client.query(
			`
				select accounts.id from accounts
				where account_number = $1;
			`,
			[input.destinationAccountNumber]
		);

		const to_acc_id = to_acc.rows[0];

		if (!to_acc_id) {
			return next(new CustomError("Account not found", 404));
		}

		const txResult = await client.query(
			`
				select * from transfer($1, $2, $3, $4);
			`,
			[input.sourceAccountId, to_acc_id.id, input.amount, input.narration]
		);

		const transaction = txResult.rows[0];

		await client.query(
			`INSERT INTO transaction_audit_logs (transaction_id, actor_user_id, action, new_status)
       VALUES ($1, $2, 'initiated', 'processing')`,
			[transaction.id, userId]
		);

		await client.query("COMMIT");
		return res.status(202).json({ transaction });
	} catch (error) {
		await client.query("ROLLBACK");
		return next(error);
	} finally {
		client.release();
	}
};

export default transfer;
