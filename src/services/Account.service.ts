import db from "../database/db.ts";

class Account {
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
