import pg from "pg";

const pool = new pg.Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: Number(process.env.DB_PORT),
});

export default {
	query: (text: string, params: (string | number | null | Date | boolean)[]) =>
		pool.query(text, params),
	pool,
};
