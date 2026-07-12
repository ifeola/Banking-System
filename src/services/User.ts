import db from "../database/db.ts";

class User {
	static async find(phone: string) {
		const queryText = `
      select first_name,
        middle_name, last_name, email, phone, password_hash
      from users where user.phone = $1;
    `;

		const query = await db.query(queryText, [phone]);
		return query.rows[0];
	}
}

export default User;
