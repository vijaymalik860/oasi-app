const { pool } = require('./db');

const rangeMapping = {
  'Ambala': 'Ambala Range', 'Yamunanagar': 'Ambala Range', 'Kurukshetra': 'Ambala Range',
  'Hisar': 'Hisar Range', 'Hansi': 'Hisar Range', 'Fatehabad': 'Hisar Range', 'Sirsa': 'Hisar Range', 'Jind': 'Hisar Range', 'Dabwali': 'Hisar Range',
  'Karnal': 'Karnal Range', 'Panipat': 'Karnal Range', 'Kaithal': 'Karnal Range',
  'Rohtak': 'Rohtak Range', 'Bhiwani': 'Rohtak Range', 'Charkhi Dadri': 'Rohtak Range',
  'Rewari': 'South Range', 'Palwal': 'South Range', 'Mahendergarh': 'South Range', 'Nuh': 'South Range',
  'Gurugram': 'Gurugram Commissionerate', 'Faridabad': 'Faridabad Commissionerate', 'Panchkula': 'Panchkula Commissionerate', 'Sonipat': 'Sonipat Commissionerate', 'Jhajjar': 'Jhajjar Commissionerate'
};

async function fixHierarchy() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const stateRes = await client.query(`SELECT id FROM hierarchy_nodes WHERE level=1 LIMIT 1`);
    if (stateRes.rows.length === 0) throw new Error("No State found");
    const stateId = stateRes.rows[0].id;

    const distRes = await client.query(`SELECT id, name FROM hierarchy_nodes WHERE level=3`);
    const districts = distRes.rows;

    const rangeIdMap = {};
    const uniqueRanges = [...new Set(districts.map(d => {
      const matchKey = Object.keys(rangeMapping).find(k => k.toLowerCase() === d.name.toLowerCase());
      return matchKey ? rangeMapping[matchKey] : 'Other Range';
    }))];
    
    for (const rName of uniqueRanges) {
      const rCode = `HR-R-${rName.toUpperCase().replace(/\\s+/g, '-').replace(/[^A-Z0-9-]/g, '')}`;
      const rRes = await client.query(
        `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
         VALUES ($1, $2, 2, $3, false, 'attendance')
         ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id
         RETURNING id`,
        [rCode, rName, stateId]
      );
      rangeIdMap[rName] = rRes.rows[0].id;
    }

    let updated = 0;
    for (const d of districts) {
      const matchKey = Object.keys(rangeMapping).find(k => k.toLowerCase() === d.name.toLowerCase());
      const rName = matchKey ? rangeMapping[matchKey] : 'Other Range';
      const rangeId = rangeIdMap[rName];
      await client.query(
        `UPDATE hierarchy_nodes SET parent_id = $1 WHERE id = $2`,
        [rangeId, d.id]
      );
      updated++;
    }

    await client.query('COMMIT');
    console.log("Fix successful. Updated", updated, "districts into", uniqueRanges.length, "ranges.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("Error:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fixHierarchy();
