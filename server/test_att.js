const { pool } = require('./db');
async function testAtt() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM personnel WHERE full_name = 'ravi'");
    if(res.rows.length === 0) { console.log('ravi not found'); return; }
    const p = res.rows[0];
    
    await client.query(`
      INSERT INTO attendance_register (
         personnel_id, date, attendance_type, attendance_source, marking_method,
         node_id, marked_by_user_id, marked_by_role, is_late, remarks, marked_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    `, [p.id, '2026-06-01', 'Present', 'Register', 'Manual', p.node_id, 'd1ab8df9-62fd-488e-b693-a9f90940fce8', 'unit_admin', false, null]);
    console.log('Success!');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}
testAtt();
