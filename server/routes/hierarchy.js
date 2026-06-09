// routes/hierarchy.js — Hierarchy Nodes + Old Location Tables
const express      = require('express');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const router       = express.Router();

router.use(authenticate);

// ── HIERARCHY NODES (UnitSetup page) ──

// GET /api/hierarchy/nodes?parentId=xxx
router.get('/nodes', async (req, res) => {
  try {
    const rawId = req.query.parentId;
    const parentId = (!rawId || rawId === 'null' || rawId === 'undefined') ? null : rawId;

    let query, params;
    if (!parentId) {
      query  = `SELECT * FROM hierarchy_nodes WHERE parent_id IS NULL ORDER BY name`;
      params = [];
    } else {
      query  = `SELECT * FROM hierarchy_nodes WHERE parent_id = $1 ORDER BY name`;
      params = [parentId];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load nodes.' });
  }
});

// GET /api/hierarchy/nodes-by-level?level=2  — Issue #2 Fix: range dropdown ke liye
router.get('/nodes-by-level', async (req, res) => {
  try {
    const { level } = req.query;
    if (!level) return res.status(400).json({ error: 'level param zaroori hai.' });
    const { rows } = await pool.query(
      `SELECT id, name, level, node_code FROM hierarchy_nodes WHERE level=$1 ORDER BY name`,
      [parseInt(level)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed.' });
  }
});

// GET /api/hierarchy/stats — For Dashboard Org Structure
router.get('/stats', async (req, res) => {
  try {
    const { rows: levels } = await pool.query('SELECT level, count(*)::integer as count FROM hierarchy_nodes GROUP BY level ORDER BY level');
    
    // Count the actual Special Units (which are at Level 3 under the 'Special Units' umbrella node at Level 2)
    const { rows: specialUnitsNodes } = await pool.query(`
      SELECT count(*)::integer as count 
      FROM hierarchy_nodes 
      WHERE level=3 AND parent_id = (SELECT id FROM hierarchy_nodes WHERE name ILIKE '%Special Units%' LIMIT 1)
    `);
    
    const specialUnitsCount = specialUnitsNodes[0]?.count || 0;

    res.json({
      levels: levels,
      specialUnits: specialUnitsCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});


// POST /api/hierarchy/nodes
router.post('/nodes', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { node_code, name, level, parent_id, assigned_module, is_fixed } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, assigned_module, is_fixed)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [node_code, name, level, parent_id||null, assigned_module||'attendance', is_fixed||false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Node code already exists.' });
    res.status(500).json({ error: 'Failed to create node.' });
  }
});

// PUT /api/hierarchy/nodes/:id
router.put('/nodes/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { name, assigned_module } = req.body;
    const { rows } = await pool.query(
      `UPDATE hierarchy_nodes SET name=$1, assigned_module=$2, updated_at=NOW()
       WHERE id=$3 AND is_fixed=false RETURNING *`,
      [name, assigned_module, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Node not found or is fixed.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update node.' });
  }
});

// DELETE /api/hierarchy/nodes/:id
router.delete('/nodes/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    await pool.query(
      `DELETE FROM hierarchy_nodes WHERE id=$1 AND is_fixed=false`,
      [req.params.id]
    );
    res.json({ message: 'Node deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete node.' });
  }
});

// DELETE /api/hierarchy/nodes (bulk clear all non-fixed)
router.delete('/nodes', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    await pool.query(`DELETE FROM hierarchy_nodes WHERE is_fixed = false`);
    res.json({ message: 'All non-fixed nodes deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear nodes.' });
  }
});

// POST /api/hierarchy/import-csv — Bulk import District + PS from CSV data
router.post('/import-csv', async (req, res) => {
  if (!['super_admin', 'state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const { rows, state_name = 'Haryana Police' } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No data rows provided.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stats = { districts: 0, police_stations: 0, skipped: 0 };

    // Step 1: Ensure State node (Level 1) exists
    let stateId;
    const stateCode = 'HR-STATE';
    const stateRes = await client.query(
      `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
       VALUES ($1, $2, 1, NULL, true, 'attendance')
       ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [stateCode, state_name]
    );
    stateId = stateRes.rows[0].id;

    // Step 2: Get all unique districts from CSV
    const uniqueDistricts = [...new Set(rows.map(r => r.district?.trim()).filter(Boolean))];

    // Range Mapping
    const rangeMapping = {
      'Ambala': 'Ambala Range', 'Yamunanagar': 'Ambala Range', 'Yamuna Nagar': 'Ambala Range', 'Kurukshetra': 'Ambala Range',
      'Hisar': 'Hisar Range', 'Hansi': 'Hisar Range', 'Fatehabad': 'Hisar Range', 'Sirsa': 'Hisar Range', 'Jind': 'Hisar Range', 'Dabwali': 'Hisar Range',
      'Karnal': 'Karnal Range', 'Panipat': 'Karnal Range', 'Kaithal': 'Karnal Range',
      'Rohtak': 'Rohtak Range', 'Bhiwani': 'Rohtak Range', 'Charkhi Dadri': 'Rohtak Range',
      'Rewari': 'South Range', 'Palwal': 'South Range', 'Mahendergarh': 'South Range', 'Nuh': 'South Range',
      'Gurugram': 'Gurugram Commissionerate', 'Faridabad': 'Faridabad Commissionerate', 'Panchkula': 'Panchkula Commissionerate', 'Sonipat': 'Sonipat Commissionerate', 'Jhajjar': 'Jhajjar Commissionerate'
    };

    // Step 2.5: Ensure Ranges (Level 2) exist
    const rangeIdMap = {};
    const uniqueRanges = [...new Set(uniqueDistricts.map(d => {
      const matchKey = Object.keys(rangeMapping).find(k => k.toLowerCase() === d.toLowerCase());
      return matchKey ? rangeMapping[matchKey] : 'Special Units';
    }))];
    
    for (const rName of uniqueRanges) {
      const rCode = `HR-R-${rName.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')}`;
      const rRes = await client.query(
        `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
         VALUES ($1, $2, 2, $3, false, 'attendance')
         ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id
         RETURNING id`,
        [rCode, rName, stateId]
      );
      rangeIdMap[rName] = rRes.rows[0].id;
    }

    // Step 3: Insert Districts (Level 3) under their Ranges
    const districtIdMap = {};
    for (let i = 0; i < uniqueDistricts.length; i++) {
      const distName = uniqueDistricts[i];
      const distCode = `HR-D-${distName.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')}`;
      const matchKey = Object.keys(rangeMapping).find(k => k.toLowerCase() === distName.toLowerCase());
      const rName = matchKey ? rangeMapping[matchKey] : 'Special Units';
      const rangeId = rangeIdMap[rName];

      const dRes = await client.query(
        `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
         VALUES ($1, $2, 3, $3, false, 'attendance')
         ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id
         RETURNING id`,
        [distCode, distName, rangeId]
      );
      districtIdMap[distName] = dRes.rows[0].id;
      if (dRes.rows[0].id) stats.districts++;
    }

    // Step 4: Insert Police Stations (Level 4) under their districts
    const psCounters = {};
    for (const row of rows) {
      const district = row.district?.trim();
      const ps = row.police_station?.trim();
      if (!district || !ps) { stats.skipped++; continue; }

      const districtId = districtIdMap[district];
      if (!districtId) { stats.skipped++; continue; }

      const distCode = `HR-D-${district.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')}`;
      psCounters[distCode] = (psCounters[distCode] || 0) + 1;
      const psCode = `${distCode}-PS${psCounters[distCode]}`;

      await client.query(
        `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
         VALUES ($1, $2, 4, $3, false, 'attendance')
         ON CONFLICT (node_code) DO NOTHING`,
        [psCode, ps, districtId]
      );
      stats.police_stations++;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Import successful!`,
      stats: {
        state: state_name,
        districts: stats.districts,
        police_stations: stats.police_stations,
        skipped: stats.skipped
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('CSV Import Error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
});

// ── OLD LOCATION TABLES (PersonnelList, AttendanceRegister use these) ──

// GET /api/hierarchy/states
router.get('/states', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, name FROM hierarchy_nodes WHERE level=1 ORDER BY name`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/hierarchy/ranges?stateId=xxx
router.get('/ranges', async (req, res) => {
  try {
    const { stateId } = req.query;
    const q = stateId
      ? `SELECT id, name FROM hierarchy_nodes WHERE level=2 AND parent_id=$1 ORDER BY name`
      : `SELECT id, name FROM hierarchy_nodes WHERE level=2 ORDER BY name`;
    const { rows } = await pool.query(q, stateId ? [stateId] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/hierarchy/districts?rangeId=xxx&stateId=xxx
router.get('/districts', async (req, res) => {
  try {
    const { rangeId, stateId } = req.query;
    let q, params;
    if (rangeId) {
      q = `SELECT d.id, d.name, r.parent_id AS "stateId", r.name AS "rangeName" FROM hierarchy_nodes d LEFT JOIN hierarchy_nodes r ON d.parent_id = r.id WHERE d.level=3 AND d.parent_id=$1 ORDER BY d.name`;
      params = [rangeId];
    } else if (stateId) {
      q = `SELECT d.id, d.name, r.parent_id AS "stateId", r.name AS "rangeName" FROM hierarchy_nodes d LEFT JOIN hierarchy_nodes r ON d.parent_id = r.id WHERE d.level=3 AND r.parent_id=$1 ORDER BY d.name`;
      params = [stateId];
    } else {
      q = `SELECT d.id, d.name, r.parent_id AS "stateId", r.name AS "rangeName" FROM hierarchy_nodes d LEFT JOIN hierarchy_nodes r ON d.parent_id = r.id WHERE d.level=3 ORDER BY d.name`;
      params = [];
    }
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/hierarchy/units?districtId=xxx&unitType=xxx&module=attendance
router.get('/units', async (req, res) => {
  try {
    const { districtId } = req.query;
    let baseQuery = `
      SELECT h.id, h.name, h.assigned_module,
             h_parent.id as district_id,
             h_grandparent.id as range_id,
             h_greatgrandparent.id as state_id
      FROM hierarchy_nodes h
      LEFT JOIN hierarchy_nodes h_parent ON h_parent.id = h.parent_id
      LEFT JOIN hierarchy_nodes h_grandparent ON h_grandparent.id = h_parent.parent_id
      LEFT JOIN hierarchy_nodes h_greatgrandparent ON h_greatgrandparent.id = h_grandparent.parent_id
      WHERE h.level=4
    `;
    const params = [];
    let idx = 1;

    if (districtId) {
      baseQuery += ` AND h.parent_id = $${idx++}`;
      params.push(districtId);
    }
    
    if (req.user.role !== 'super_admin' && req.user.nodeId) {
      baseQuery += ` AND h.id IN (
        WITH RECURSIVE descendants AS (
          SELECT id FROM hierarchy_nodes WHERE id = $${idx++}
          UNION ALL
          SELECT child.id FROM hierarchy_nodes child
          INNER JOIN descendants d ON child.parent_id = d.id
        )
        SELECT id FROM descendants
      )`;
      params.push(req.user.nodeId);
    }

    baseQuery += ` ORDER BY h.name`;
    const { rows } = await pool.query(baseQuery, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/hierarchy/sub-units?unitId=xxx&districtId=xxx
router.get('/sub-units', async (req, res) => {
  try {
    const { unitId } = req.query;
    let baseQuery = `
      SELECT h.id, h.name, h.assigned_module,
             h.parent_id as unit_id
      FROM hierarchy_nodes h
      WHERE h.level=5
    `;
    const params = [];
    let idx = 1;

    if (unitId) {
      baseQuery += ` AND h.parent_id = $${idx++}`;
      params.push(unitId);
    }
    
    if (req.user.role !== 'super_admin' && req.user.nodeId) {
      baseQuery += ` AND h.id IN (
        WITH RECURSIVE descendants AS (
          SELECT id FROM hierarchy_nodes WHERE id = $${idx++}
          UNION ALL
          SELECT child.id FROM hierarchy_nodes child
          INNER JOIN descendants d ON child.parent_id = d.id
        )
        SELECT id FROM descendants
      )`;
      params.push(req.user.nodeId);
    }

    baseQuery += ` ORDER BY h.name`;
    const { rows } = await pool.query(baseQuery, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// GET /api/hierarchy/unit-categories
router.get('/unit-categories', async (req, res) => {
  res.json([{id:1, name:'Police Station'}, {id:2, name:'Headquarters'}]);
});

module.exports = router;
