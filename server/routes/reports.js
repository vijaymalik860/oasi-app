const express = require('express');
const { pool } = require('../db');
const authenticate = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

// GET /api/reports/fir
router.get('/fir', async (req, res) => {
  try {
    const { unit_id, district_id, range_id, year, quarter, police_station } = req.query;
    
    let baseQuery = `
      SELECT id, node_id, year, quarter, police_station, fir_count, 
             charge_sheet_filed, conviction, pending, cognizable, non_cognizable, 
             created_at
      FROM fir_reports
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (year) {
      baseQuery += ` AND year = $${idx++}`;
      params.push(year);
    }
    if (quarter) {
      baseQuery += ` AND quarter = $${idx++}`;
      params.push(quarter);
    }
    if (police_station) {
      baseQuery += ` AND police_station ILIKE $${idx++}`;
      params.push(`%${police_station}%`);
    }

    let filterNodeId = unit_id || district_id || range_id;
    if (filterNodeId) {
      baseQuery += ` AND node_id IN (
        WITH RECURSIVE descendants AS (
          SELECT id FROM hierarchy_nodes WHERE id = $${idx++}
          UNION ALL
          SELECT child.id FROM hierarchy_nodes child
          INNER JOIN descendants d ON child.parent_id = d.id
        )
        SELECT id FROM descendants
      )`;
      params.push(filterNodeId);
    }

    baseQuery += ` ORDER BY year DESC, quarter DESC, police_station ASC`;

    const { rows } = await pool.query(baseQuery, params);
    res.json(rows);
  } catch (err) {
    console.error('[Reports] Error fetching FIRs:', err);
    res.status(500).json({ error: 'Failed to fetch FIR reports.' });
  }
});

// POST /api/reports/fir
router.post('/fir', async (req, res) => {
  try {
    const {
      quarter, year, police_station,
      fir_count, charge_sheet_filed, conviction, pending, cognizable, non_cognizable
    } = req.body;

    const actualNodeId = req.user.nodeId || null;

    const { rows } = await pool.query(
      `INSERT INTO fir_reports (
         node_id, year, quarter, police_station, fir_count, 
         charge_sheet_filed, conviction, pending, cognizable, non_cognizable,
         created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        actualNodeId, year, quarter, police_station,
        fir_count || 0, charge_sheet_filed || 0, conviction || 0, pending || 0, 
        cognizable || 0, non_cognizable || 0, req.user.uid
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Reports] Error creating FIR:', err);
    res.status(500).json({ error: 'Failed to create FIR report.' });
  }
});

module.exports = router;
