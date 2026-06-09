// routes/admin.js — Dropdown Master, App Users
const express      = require('express');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const bcrypt       = require('bcryptjs');
const { logAudit } = require('../utils/audit');
const router       = express.Router();

router.use(authenticate);

// ── MASTER FIELD TYPES ──

// GET /api/admin/field-types?stateId=xxx
router.get('/field-types', async (req, res) => {
  try {
    const { stateId } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM master_field_types WHERE state_id=$1 AND is_active=true ORDER BY display_name`,
      [stateId || req.user.stateId]
    );
    res.json(rows);
  } catch (err) { 
    console.error('Error fetching field-types:', err);
    res.status(500).json({ error: 'Failed.', details: err.message }); 
  }
});

// POST /api/admin/field-types
router.post('/field-types', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { state_id, field_name, display_name, personnel_field_name, description, helper_example } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO master_field_types (state_id, field_name, display_name, personnel_field_name, description, helper_example)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [state_id||req.user.stateId, field_name, display_name, personnel_field_name||null, description||null, helper_example||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Field already exists.' });
    res.status(500).json({ error: 'Failed.' });
  }
});

// DELETE /api/admin/field-types/:id
router.delete('/field-types/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    await pool.query(`UPDATE master_field_types SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Field type deactivated.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── DROPDOWN VALUES ──

// GET /api/admin/dropdown-values?stateId=xxx&fieldTypeId=xxx
router.get('/dropdown-values', async (req, res) => {
  try {
    const { stateId, fieldTypeId } = req.query;
    let q = `SELECT dv.*, ft.field_name, ft.display_name
             FROM master_dropdown_values dv
             JOIN master_field_types ft ON ft.id = dv.field_type_id
             WHERE dv.is_active=true`;
    const params = [];
    if (stateId)     { q += ` AND dv.state_id=$${params.length+1}`;     params.push(stateId); }
    if (fieldTypeId) { q += ` AND dv.field_type_id=$${params.length+1}`; params.push(fieldTypeId); }
    q += ` ORDER BY ft.field_name, dv.display_order`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// POST /api/admin/dropdown-values
router.post('/dropdown-values', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { field_type_id, state_id, value, display_order, access_level } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO master_dropdown_values (field_type_id, state_id, value, display_order, access_level)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [field_type_id, state_id||req.user.stateId, value, display_order||0, access_level||'all']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Value already exists.' });
    res.status(500).json({ error: 'Failed.' });
  }
});

// PUT /api/admin/dropdown-values/:id
router.put('/dropdown-values/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { value, display_order, is_active, access_level } = req.body;
    const { rows } = await pool.query(
      `UPDATE master_dropdown_values
       SET value=$1, display_order=$2, is_active=$3, access_level=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [value, display_order||0, is_active!==false, access_level||'all', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// DELETE /api/admin/dropdown-values/:id
router.delete('/dropdown-values/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    await pool.query(`DELETE FROM master_dropdown_values WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── APP USERS (User Management) ──

// GET /api/admin/users
// Issue #7 Fix: node_name added | Issue #9 Fix: state_admin scope
router.get('/users', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    let whereClause = '';
    const params = [];

    // Issue #9: state_admin sirf apne node ke subtree ke users dekhe
    // super_admin sab dekhe
    if (req.user.role === 'state_admin' && req.user.nodeId) {
      // state_admin ke node se neeche ke sab users
      // Simple approach: state_admin apne nodeId ke sath scoped users dekhe
      // (Poori hierarchy filtering complex hai — abhi sirf non-super users dikhao)
      whereClause = `WHERE r.name != 'super_admin'`;
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.belt_number, u.is_active, u.last_login,
              u.node_id,
              r.name AS role_name,
              h.name AS node_name,
              h.level AS node_level
       FROM app_users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN hierarchy_nodes h ON h.id = u.node_id
       ${whereClause}
       ORDER BY r.rank_level, u.name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// POST /api/admin/users — Create new user
router.post('/users', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { name, belt_number, password, role_name, state_id, district_id, unit_id, node_id } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const finalNodeId = node_id || unit_id || district_id || state_id || null;

    const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name=$1`, [role_name]);
    if (roleRows.length === 0) return res.status(400).json({ error: 'Invalid role.' });

    const { rows } = await pool.query(
      `INSERT INTO app_users (name, belt_number, password_hash, role_id, node_id, is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING id, name, belt_number, is_active`,
      [name, belt_number, hash, roleRows[0].id, finalNodeId]
    );
    
    await logAudit(req.user.uid, 'CREATE_USER', 'User', rows[0].id, null, { name, belt_number, role_name, node_id: finalNodeId }, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Belt number already exists.' });
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PUT /api/admin/users/:id/toggle — Enable/Disable user
router.put('/users/:id/toggle', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE app_users SET is_active = NOT is_active WHERE id=$1 RETURNING id, belt_number, is_active`,
      [req.params.id]
    );
    
    await logAudit(req.user.uid, 'TOGGLE_USER_STATUS', 'User', req.params.id, null, { is_active: rows[0].is_active }, req.ip);

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// PUT /api/admin/users/:id — Issue #8 Fix: Edit user (name, role, node)
router.put('/users/:id', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { name, role_name, node_id } = req.body;
    const updates = [];
    const params = [];

    if (name)      { params.push(name);      updates.push(`name=$${params.length}`); }
    if (node_id)   { params.push(node_id);   updates.push(`node_id=$${params.length}`); }
    if (role_name) {
      const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name=$1`, [role_name]);
      if (roleRows.length === 0) return res.status(400).json({ error: 'Invalid role.' });
      params.push(roleRows[0].id);
      updates.push(`role_id=$${params.length}`);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Kuch update karne ke liye nahi hai.' });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE app_users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING id, name, belt_number`,
      params
    );
    
    await logAudit(req.user.uid, 'UPDATE_USER', 'User', req.params.id, null, { name, role_name, node_id }, req.ip);

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update user.' }); }
});


// PUT /api/admin/users/:id/password — Reset password
router.put('/users/:id/password', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { newPassword } = req.body;
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE app_users SET password_hash=$1 WHERE id=$2`, [hash, req.params.id]);
    
    await logAudit(req.user.uid, 'RESET_PASSWORD', 'User', req.params.id, null, null, req.ip);

    res.json({ message: 'Password updated.' });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── ROLES MANAGEMENT ──
router.get('/roles', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.description, r.rank_level, COUNT(u.id) as user_count 
       FROM roles r 
       LEFT JOIN app_users u ON r.id = u.role_id 
       GROUP BY r.id 
       ORDER BY r.rank_level`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.put('/roles/:id', async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Permission denied. Only Super Admin can edit roles.' });
  }
  try {
    const { description } = req.body;
    const { rows } = await pool.query(
      `UPDATE roles SET description=$1 WHERE id=$2 RETURNING *`,
      [description, req.params.id]
    );
    
    await logAudit(req.user.uid, 'UPDATE_ROLE', 'Role', req.params.id, null, { description }, req.ip);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── AUDIT LOGS ──
router.get('/audit-logs', async (req, res) => {
  if (!['super_admin','state_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_data, a.new_data, a.ip_address, a.created_at,
              u.name as user_name, u.belt_number
       FROM audit_logs a
       LEFT JOIN app_users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── DASHBOARD STATS ──
router.get('/dashboard-stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const u = req.user;

    let scope = '';
    const params = [];
    if (u.role !== 'super_admin' && u.nodeId) {
      scope = `WHERE node_id=$1`; params.push(u.nodeId);
    }

    const [totalR, presentR] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM personnel ${scope} AND is_deleted=false AND service_status='Active'`
        .replace('WHERE', scope ? 'AND' : 'WHERE').replace('AND is_deleted', scope ? 'AND is_deleted' : 'WHERE is_deleted'), params),
      pool.query(
        `SELECT COUNT(*) FROM attendance_register WHERE date=$${params.length+1} AND attendance_type IN ('Present','Duty Outside')`,
        [...params, today]
      ),
    ]);

    res.json({
      totalPersonnel: parseInt(totalR.rows[0].count),
      presentToday:   parseInt(presentR.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

module.exports = router;
