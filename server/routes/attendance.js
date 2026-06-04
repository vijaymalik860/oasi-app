// routes/attendance.js — Attendance Register
const express      = require('express');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const router       = express.Router();

router.use(authenticate);

// GET /api/attendance?date=2024-01-15&unitId=xxx&subUnitId=xxx
router.get('/', async (req, res) => {
  try {
    const { date, unitId, subUnitId, nodeId, districtId, rangeId, stateId } = req.query;

    let q = `SELECT ar.*, p.full_name, p.belt_number, p.rank
             FROM attendance_register ar
             JOIN personnel p ON p.id = ar.personnel_id
             WHERE 1=1`;
    const params = [];

    if (date) { q += ` AND ar.date = $${params.length+1}`; params.push(date); }
    if (subUnitId || unitId || districtId || rangeId || stateId || nodeId) {
      const finalNodeId = nodeId || subUnitId || unitId || districtId || rangeId || stateId;
      q += ` AND ar.node_id = $${params.length+1}`; params.push(finalNodeId);
    }

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('[Attendance] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load attendance.' });
  }
});

// POST /api/attendance — Single mark/upsert
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO attendance_register (
         personnel_id, date, attendance_type, attendance_source, marking_method,
         node_id, marked_by_user_id, marked_by_role, is_late, remarks, marked_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (personnel_id, date)
       DO UPDATE SET
         attendance_type   = EXCLUDED.attendance_type,
         attendance_source = EXCLUDED.attendance_source,
         marking_method    = EXCLUDED.marking_method,
         marked_by_user_id = EXCLUDED.marked_by_user_id,
         marked_by_role    = EXCLUDED.marked_by_role,
         is_late           = EXCLUDED.is_late,
         remarks           = EXCLUDED.remarks,
         updated_at        = NOW()
       RETURNING *`,
      [
        d.personnel_id, d.date, d.attendance_type,
        d.attendance_source||'Register', d.marking_method||'Manual',
        d.node_id||d.sub_unit_id||d.unit_id||d.district_id||null,
        req.user.uid, req.user.role, d.is_late||false, d.remarks||null
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[Attendance] Mark error:', err.message);
    res.status(500).json({ error: 'Failed to mark attendance.' });
  }
});

// POST /api/attendance/bulk — Bulk upsert
router.post('/bulk', async (req, res) => {
  try {
    const records = req.body; // Array of attendance records
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array required.' });
    }

    const results = [];
    for (const d of records) {
      const { rows } = await pool.query(
        `INSERT INTO attendance_register (
           personnel_id, date, attendance_type, attendance_source, marking_method,
           node_id, marked_by_user_id, marked_by_role, is_late, remarks, marked_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (personnel_id, date)
         DO UPDATE SET
           attendance_type   = EXCLUDED.attendance_type,
           marking_method    = EXCLUDED.marking_method,
           marked_by_user_id = EXCLUDED.marked_by_user_id,
           marked_by_role    = EXCLUDED.marked_by_role,
           is_late           = EXCLUDED.is_late,
           remarks           = EXCLUDED.remarks,
           updated_at        = NOW()
         RETURNING *`,
        [
          d.personnel_id, d.date, d.attendance_type,
          d.attendance_source||'Register', d.marking_method||'Manual',
          d.node_id||d.sub_unit_id||d.unit_id||d.district_id||null,
          req.user.uid, req.user.role, d.is_late||false, d.remarks||null
        ]
      );
      results.push(rows[0]);
    }

    res.json(results);
  } catch (err) {
    console.error('[Attendance] Bulk error:', err.message);
    res.status(500).json({ error: 'Bulk attendance failed.' });
  }
});

// GET /api/attendance/stats?date=xxx&unitId=xxx
router.get('/stats', async (req, res) => {
  try {
    const { date, unitId, districtId } = req.query;
    let q = `SELECT attendance_type, COUNT(*) AS count
             FROM attendance_register WHERE 1=1`;
    const params = [];
    if (date)       { q += ` AND date=$${params.length+1}`;       params.push(date); }
    const finalNodeId = unitId || districtId;
    if (finalNodeId) { q += ` AND node_id=$${params.length+1}`; params.push(finalNodeId); }
    q += ` GROUP BY attendance_type`;

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
});

module.exports = router;
