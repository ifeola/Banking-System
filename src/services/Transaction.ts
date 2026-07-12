import db from "../database/db.ts";

class Transaction {
	static async findOne(account_id: string) {
		const queryText = `
      select *
      from transactions
      where transactions.id = $1;
    `;

		const query = await db.query(queryText, [account_id]);
		return query.rows;
	}

	static async findAll(account_id: string) {
		const queryText = `
      select *
      from transactions
      where transactions.account_id = $1
      order by created_at asc;
    `;

		const query = await db.query(queryText, [account_id]);
		return query.rows;
	}
}

export default Transaction;
