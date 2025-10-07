import pg from "pg";
export const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
