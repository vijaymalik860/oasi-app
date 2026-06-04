const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'personnel'
  ORDER BY ordinal_position
`).then(r => {
  console.log('All personnel columns:');
  r.rows.forEach(x => console.log(' -', x.column_name));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
