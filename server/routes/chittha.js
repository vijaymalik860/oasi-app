// routes/chittha.js — Naukari Chittha (Duty Roster)
const express      = require('express');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const router       = express.Router();

router.use(authenticate);

// GET /api/chitthas
router.get('/', async (req, res) => {
  try {
    const u = req.user;
    let q = `SELECT c.*, h.name AS unit_name
             FROM chitthas c
             LEFT JOIN hierarchy_nodes h ON h.id = c.node_id
             WHERE 1=1`;
    const params = [];

    if (u.role !== 'state_admin' && u.role !== 'super_admin') {
      if (u.nodeId) {
        q += ` AND c.node_id=$${params.length+1}`; params.push(u.nodeId);
      }
    }
    q += ` ORDER BY c.chittha_date DESC`;

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed to load chitthas.' }); }
});

// GET /api/chitthas/:id (with assignments)
router.get('/:id', async (req, res) => {
  try {
    const [chitthaR, assignR] = await Promise.all([
      pool.query(`SELECT c.*, h.name AS unit_name FROM chitthas c LEFT JOIN hierarchy_nodes h ON h.id=c.node_id WHERE c.id=$1`, [req.params.id]),
      pool.query(
        `SELECT ca.*, p.full_name, p.belt_number, p.rank
         FROM chittha_assignments ca
         JOIN personnel p ON p.id = ca.personnel_id
         WHERE ca.chittha_id=$1`,
        [req.params.id]
      )
    ]);
    if (chitthaR.rows.length === 0) return res.status(404).json({ error: 'Chittha not found.' });
    res.json({ ...chitthaR.rows[0], assignments: assignR.rows });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// POST /api/chitthas
router.post('/', async (req, res) => {
  try {
    const { unit_id, district_id, node_id, chittha_date, status } = req.body;
    const finalNodeId = node_id || unit_id || district_id;
    const { rows } = await pool.query(
      `INSERT INTO chitthas (node_id, chittha_date, status, created_by_user_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [finalNodeId, chittha_date, status||'Draft', req.user.uid]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Chittha for this unit/date already exists.' });
    res.status(500).json({ error: 'Failed to create chittha.' });
  }
});

// PUT /api/chitthas/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, assignments } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE chitthas SET status=$1, submitted_at=$2, updated_at=NOW() WHERE id=$3`,
        [status, status==='Submitted' ? new Date() : null, req.params.id]
      );
      if (assignments && Array.isArray(assignments)) {
        await client.query(`DELETE FROM chittha_assignments WHERE chittha_id=$1`, [req.params.id]);
        for (const a of assignments) {
          await client.query(
            `INSERT INTO chittha_assignments (chittha_id, personnel_id, section_name, duty_type, duty_location, remark_text, is_vip_duty)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [req.params.id, a.personnel_id, a.section_name, a.duty_type||null, a.duty_location||null, a.remark_text||null, a.is_vip_duty||false]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ message: 'Chittha updated.' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch (err) { res.status(500).json({ error: 'Failed to update chittha.' }); }
});

// DELETE /api/chitthas/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM chitthas WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Chittha deleted.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

module.exports = router;
