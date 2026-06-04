const { pool } = require('./db');
pool.query("UPDATE hierarchy_nodes SET name = 'Special Units' WHERE name = 'Other Range' AND level = 2").then(() => {
  console.log('Database updated!');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
