import db from "../database/db.ts";

class Account {
	static async create(
		user_id: string,
		account_number: string,
		account_type: string
	) {
		const queryText = `
      insert into accounts (user_id, account_number, account_type)
			values ($1, $2, $3)
			returning *;
    `;

		const query = await db.query(queryText, [
			user_id,
			account_number,
			account_type,
		]);
		return query.rows[0];
	}

	static async find(user_id: string) {
		const queryText = `
      select user_id,
        account_number, account_type, status, balance, currency, updated_at
      from accounts where accounts.user_id = $1;
    `;

		const query = await db.query(queryText, [user_id]);
		return query.rows[0];
	}
}

export default Account;
