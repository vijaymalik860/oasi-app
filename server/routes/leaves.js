// routes/leaves.js — Leave + Transfer + Grievance Management
const express      = require('express');
const path         = require('path');
const multer       = require('multer');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const router       = express.Router();

// ── Multer — File Upload Config ──────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/grievances'));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e6)}`;
    const ext    = path.extname(file.originalname);
    cb(null, `grievance-${unique}${ext}`);
  },
});

const ALLOWED_TYPES = [
  'image/jpeg','image/png','image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB per file
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

router.use(authenticate);

// GET /api/leaves
router.get('/', async (req, res) => {
  try {
    const { personnelId, nodeId, status } = req.query;
    let q = `SELECT l.*, p.full_name, p.belt_number, p.rank
             FROM leaves l JOIN personnel p ON p.id=l.personnel_id WHERE 1=1`;
    const params = [];
    if (personnelId) { q+=` AND l.personnel_id=$${params.length+1}`; params.push(personnelId); }
    if (nodeId)      { q+=` AND l.node_id=$${params.length+1}`;      params.push(nodeId); }
    if (status)      { q+=` AND l.status=$${params.length+1}`;       params.push(status); }
    q += ` ORDER BY l.start_date DESC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// POST /api/leaves — Apply for leave
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const totalDays = Math.ceil((new Date(d.end_date) - new Date(d.start_date)) / (1000*60*60*24)) + 1;
    const { rows } = await pool.query(
      `INSERT INTO leaves (personnel_id, node_id, leave_type, start_date, end_date, total_days, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.personnel_id, d.node_id||null, d.leave_type, d.start_date, d.end_date, totalDays, d.reason||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to apply leave.' }); }
});

// PUT /api/leaves/:id/approve
router.put('/:id/approve', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE leaves SET status='Approved', approved_by_user_id=$1, approval_date=NOW(), remarks=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [req.user.uid, req.body.remarks||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// PUT /api/leaves/:id/reject
router.put('/:id/reject', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Permission denied.' });
  try {
    const { rows } = await pool.query(
      `UPDATE leaves SET status='Rejected', approved_by_user_id=$1, approval_date=NOW(), remarks=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [req.user.uid, req.body.remarks||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── TRANSFERS ──

// GET /api/leaves/transfers
router.get('/transfers', async (req, res) => {
  try {
    const { personnelId, status } = req.query;
    let q = `SELECT t.*, p.full_name, p.belt_number, p.rank,
                    fn.name AS from_node_name, tn.name AS to_node_name
             FROM transfers t
             JOIN personnel p ON p.id=t.personnel_id
             LEFT JOIN hierarchy_nodes fn ON fn.id=t.from_node_id
             LEFT JOIN hierarchy_nodes tn ON tn.id=t.to_node_id
             WHERE 1=1`;
    const params = [];
    if (personnelId) { q+=` AND t.personnel_id=$${params.length+1}`; params.push(personnelId); }
    if (status)      { q+=` AND t.status=$${params.length+1}`;       params.push(status); }
    q += ` ORDER BY t.created_at DESC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// POST /api/leaves/transfers — Create transfer
router.post('/transfers', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin'];
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Permission denied.' });
  try {
    const d = req.body;
    const { rows } = await pool.query(
      `INSERT INTO transfers (personnel_id, from_node_id, to_node_id, order_number, order_date, relieving_date, joining_date, remarks, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.personnel_id, d.from_node_id||null, d.to_node_id||null, d.order_number||null,
       d.order_date||null, d.relieving_date||null, d.joining_date||null, d.remarks||null, req.user.uid]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// ── GRIEVANCES ──

// GET /api/leaves/grievances — Role-based scoped view (including escalated)
router.get('/grievances', async (req, res) => {
  try {
    const { status } = req.query;
    const { role, nodeId, uid } = req.user;

    let q, params = [];

    if (['super_admin', 'state_admin'].includes(role)) {
      // ── Super/State Admin: Saari grievances ──
      q = `SELECT g.*, h.name AS node_name
           FROM grievances g
           LEFT JOIN hierarchy_nodes h ON h.id = g.node_id
           WHERE 1=1`;
      if (status) { q += ` AND g.status=$${params.length+1}`; params.push(status); }

    } else if (nodeId) {
      // ── Range/District/Unit Admin:
      //    1. Apne node + child nodes ki grievances
      //    2. PLUS jo unke role pe escalate ki gayi hain (unke jurisdiction se)
      q = `
        WITH RECURSIVE node_tree AS (
          SELECT id FROM hierarchy_nodes WHERE id = $1
          UNION ALL
          SELECT hn.id FROM hierarchy_nodes hn
          JOIN node_tree nt ON hn.parent_id = nt.id
        )
        SELECT g.*, h.name AS node_name
        FROM grievances g
        LEFT JOIN hierarchy_nodes h ON h.id = g.node_id
        WHERE (
          g.node_id IN (SELECT id FROM node_tree)
          OR g.escalated_to_role = $2
        )
      `;
      params.push(nodeId, role);
      if (status) { q += ` AND g.status=$${params.length+1}`; params.push(status); }

    } else {
      // ── No node: Sirf apni khud ki ──
      q = `SELECT g.*, h.name AS node_name
           FROM grievances g
           LEFT JOIN hierarchy_nodes h ON h.id = g.node_id
           WHERE g.created_by_user_id = $1`;
      params.push(uid);
      if (status) { q += ` AND g.status=$${params.length+1}`; params.push(status); }
    }

    q += ` ORDER BY g.created_at DESC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);

  } catch (err) {
    console.error('[Grievances GET]', err.message);
    res.status(500).json({ error: 'Failed.' });
  }
});

// POST /api/leaves/grievances — with optional file attachments
router.post('/grievances', authenticate, upload.array('attachments', 3), async (req, res) => {
  try {
    const d = req.body;

    // Build attachments metadata array from uploaded files
    const attachments = (req.files || []).map(f => ({
      filename:     f.filename,
      originalname: f.originalname,
      mimetype:     f.mimetype,
      size:         f.size,
      url:          `/uploads/grievances/${f.filename}`,
    }));

    const { rows } = await pool.query(
      `INSERT INTO grievances
         (applicant_name, applicant_mobile, grievance_type, description, node_id, created_by_user_id, attachments)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        d.applicant_name, d.applicant_mobile||null,
        d.grievance_type||null, d.description||null,
        d.node_id||null, req.user.uid,
        JSON.stringify(attachments),
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Grievance POST]', err.message);
    res.status(500).json({ error: err.message || 'Failed.' });
  }
});

// PUT /api/leaves/grievances/:id/forward — Escalate to higher authority
router.put('/grievances/:id/forward', async (req, res) => {

  // Role → next higher role mapping
  const NEXT_ROLE = {
    unit_admin:     'district_admin',
    district_admin: 'state_admin',
    range_admin:    'state_admin',
    state_admin:    'super_admin',
  };

  const { role, uid, belt } = req.user;
  const nextRole = NEXT_ROLE[role];

  if (!nextRole) {
    return res.status(403).json({ error: 'Aap aur upar escalate nahi kar sakte.' });
  }

  try {
    const { notes } = req.body;

    // Pehle existing grievance fetch karo
    const existing = await pool.query('SELECT * FROM grievances WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });

    const g = existing.rows[0];

    // Escalation history entry
    const historyEntry = {
      forwarded_by_role: role,
      forwarded_by_uid:  uid,
      forwarded_to_role: nextRole,
      notes:             notes || null,
      forwarded_at:      new Date().toISOString(),
    };

    const oldHistory = Array.isArray(g.escalation_history) ? g.escalation_history : [];
    const newHistory = [...oldHistory, historyEntry];

    const { rows } = await pool.query(
      `UPDATE grievances
          SET status             = 'Escalated',
              escalated_to_role  = $1,
              forward_notes      = $2,
              escalation_history = $3,
              updated_at         = NOW()
        WHERE id = $4
        RETURNING *`,
      [nextRole, notes || null, JSON.stringify(newHistory), req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('[Grievance FORWARD]', err.message);
    res.status(500).json({ error: 'Failed to forward grievance.' });
  }
});

// PUT /api/leaves/grievances/:id — Update status / resolve
router.put('/grievances/:id', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','range_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    const { status, resolution_text } = req.body;
    const { rows } = await pool.query(
      `UPDATE grievances
          SET status=$1, resolution_text=$2, updated_at=NOW()
        WHERE id=$3
        RETURNING *`,
      [status, resolution_text || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Grievance not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Grievance PUT]', err.message);
    res.status(500).json({ error: 'Failed to update grievance.' });
  }
});

module.exports = router;
