// routes/personnel.js — Personnel CRUD
const express      = require('express');
const { pool }     = require('../db');
const authenticate = require('../middleware/auth');
const multer       = require('multer');
const fs           = require('fs');
const path         = require('path');
const router       = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/personnel';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Sab routes protected hain
router.use(authenticate);

function buildScopeFilter(user) {
  const conditions = ['p.is_deleted = false'];
  const params     = [];
  let   idx        = 1;

  if (user.role !== 'super_admin' && user.nodeId) {
    conditions.push(`p.node_id IN (
      WITH RECURSIVE descendants AS (
        SELECT id FROM hierarchy_nodes WHERE id = $${idx++}
        UNION ALL
        SELECT h.id FROM hierarchy_nodes h
        INNER JOIN descendants d ON h.parent_id = d.id
      )
      SELECT id FROM descendants
    )`);
    params.push(user.nodeId);
  }

  return { conditions, params };
}

// GET /api/personnel — List
router.get('/', async (req, res) => {
  try {
    const { conditions, params } = buildScopeFilter(req.user);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT
         p.id, p.belt_number, p.pay_code, p.full_name, p.father_name,
         p.rank, p.mobile_number, p.alternate_contact,
         p.date_of_birth, p.gender, p.blood_group, p.religion,
         p.caste, p.category, p.home_district, p.home_district_ps,
         p.service_status, p.service_book_number, p.cadre, p.service_type,
         p.date_of_enlistment, p.date_of_last_promotion, p.retirement_date,
         p.ps_duty_type, p.io_status, p.io_category,
         p.parade_group, p.spo_trade, p.company, p.r_batch,
         p.t_duty_order, p.remarks, p.photo_url,
         p.node_id, p.date_of_posting, p.is_deleted,
         p.extra_fields, p.created_at, p.updated_at,
         h.name  AS node_name,
         CASE 
            WHEN h.level = 4 THEN h_greatgrandparent.id
            WHEN h.level = 3 THEN h_grandparent.id
            WHEN h.level = 2 THEN h_parent.id
            WHEN h.level = 1 THEN h.id
         END AS state_id,
         CASE 
            WHEN h.level = 4 THEN h_grandparent.id
            WHEN h.level = 3 THEN h_parent.id
            WHEN h.level = 2 THEN h.id
         END AS range_id,
         CASE 
            WHEN h.level = 4 THEN h_parent.id
            WHEN h.level = 3 THEN h.id
         END AS district_id,
         CASE WHEN h.level = 4 THEN h.id END AS current_unit_id
       FROM personnel p
       LEFT JOIN hierarchy_nodes h ON h.id = p.node_id
       LEFT JOIN hierarchy_nodes h_parent ON h_parent.id = h.parent_id
       LEFT JOIN hierarchy_nodes h_grandparent ON h_grandparent.id = h_parent.parent_id
       LEFT JOIN hierarchy_nodes h_greatgrandparent ON h_greatgrandparent.id = h_grandparent.parent_id
       ${where}
       ORDER BY p.full_name`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('[Personnel] List error:', err.message);
    res.status(500).json({ error: 'Failed to load personnel.' });
  }
});

// GET /api/personnel/:id — Single record
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              h.name AS node_name,
              CASE 
                WHEN h.level = 4 THEN h_greatgrandparent.id
                WHEN h.level = 3 THEN h_grandparent.id
                WHEN h.level = 2 THEN h_parent.id
                WHEN h.level = 1 THEN h.id
              END AS state_id,
              CASE 
                WHEN h.level = 4 THEN h_grandparent.id
                WHEN h.level = 3 THEN h_parent.id
                WHEN h.level = 2 THEN h.id
              END AS range_id,
              CASE 
                WHEN h.level = 4 THEN h_parent.id
                WHEN h.level = 3 THEN h.id
              END AS district_id,
              CASE WHEN h.level = 4 THEN h.id END AS current_unit_id
       FROM   personnel p
       LEFT JOIN hierarchy_nodes h ON h.id = p.node_id
       LEFT JOIN hierarchy_nodes h_parent ON h_parent.id = h.parent_id
       LEFT JOIN hierarchy_nodes h_grandparent ON h_grandparent.id = h_parent.parent_id
       LEFT JOIN hierarchy_nodes h_greatgrandparent ON h_greatgrandparent.id = h_grandparent.parent_id
       WHERE  p.id = $1 AND p.is_deleted = false`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Personnel not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load record.' });
  }
});

// POST /api/personnel — Add new
router.post('/', upload.single('photo'), async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    const d = req.body;
    let extraFields = d.extra_fields || '{}';
    if (typeof extraFields === 'string') { try { extraFields = JSON.parse(extraFields); } catch(e) { extraFields = {}; } }
    if (req.file) { d.photo_url = '/uploads/personnel/' + req.file.filename; }
    const { rows } = await pool.query(
      `INSERT INTO personnel (
         belt_number, pay_code, full_name, father_name, photo_url,
         date_of_birth, gender, blood_group, mobile_number, alternate_contact,
         religion, caste, category, aadhar_number, pan,
         village, police_station, home_district, home_district_ps,
         rank, cadre, service_type, service_status, service_book_number,
         date_of_enlistment, date_of_last_promotion, retirement_date,
         ps_duty_type, io_status, io_category, parade_group, spo_trade,
         company, r_batch, t_duty_order, remarks,
         graduation_degree, subject_graduation, pg_degree, subject_post_graduation,
         node_id, date_of_posting,
         extra_fields, created_by_user_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,$33,$34,$35,$36,
         $37,$38,$39,$40,$41,$42,$43,$44
       ) RETURNING *`,
      [
        d.belt_number||null, d.pay_code||null, d.full_name, d.father_name||null, d.photo_url||null,
        d.date_of_birth||null, d.gender||null, d.blood_group||null, d.mobile_number||null, d.alternate_contact||null,
        d.religion||null, d.caste||null, d.category||null, d.aadhar_number||null, d.pan||null,
        d.village||null, d.police_station||null, d.home_district||null, d.home_district_ps||null,
        d.rank||null, d.cadre||null, d.service_type||null, d.service_status||'Active', d.service_book_number||null,
        d.date_of_enlistment||null, d.date_of_last_promotion||null, d.retirement_date||null,
        d.ps_duty_type||null, d.io_status||null, d.io_category||null, d.parade_group||null, d.spo_trade||null,
        d.company||null, d.r_batch||null, d.t_duty_order||null, d.remarks||null,
        d.graduation_degree||null, d.subject_graduation||null, d.pg_degree||null, d.subject_post_graduation||null,
        d.node_id||null, d.date_of_posting||null,
        JSON.stringify(extraFields), req.user.uid
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[Personnel] Create error:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Pay code already exists.' });
    res.status(500).json({ error: 'Failed to create record.' });
  }
});

// POST /api/personnel/upsert — Insert or Update based on pay_code (for Excel import)
router.post('/upsert', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    const d = req.body;
    let extraFields = d.extra_fields || '{}';
    if (typeof extraFields === 'string') { try { extraFields = JSON.parse(extraFields); } catch(e) { extraFields = {}; } }
    if (req.file) { d.photo_url = '/uploads/personnel/' + req.file.filename; }
    const { rows } = await pool.query(
      `INSERT INTO personnel (
         belt_number, pay_code, full_name, father_name, photo_url,
         date_of_birth, gender, blood_group, mobile_number, alternate_contact,
         religion, caste, category, aadhar_number, pan,
         village, police_station, home_district, home_district_ps,
         rank, cadre, service_type, service_status, service_book_number,
         date_of_enlistment, date_of_last_promotion, retirement_date,
         ps_duty_type, io_status, io_category, parade_group, spo_trade,
         company, r_batch, t_duty_order, remarks,
         graduation_degree, subject_graduation, pg_degree, subject_post_graduation,
         node_id, date_of_posting,
         extra_fields, created_by_user_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,$33,$34,$35,$36,
         $37,$38,$39,$40,$41,$42,$43,$44
       )
       ON CONFLICT (pay_code) WHERE pay_code IS NOT NULL AND pay_code != '' AND is_deleted = false
       DO UPDATE SET
         belt_number            = EXCLUDED.belt_number,
         full_name              = EXCLUDED.full_name,
         father_name            = EXCLUDED.father_name,
         date_of_birth          = EXCLUDED.date_of_birth,
         gender                 = EXCLUDED.gender,
         blood_group            = COALESCE(EXCLUDED.blood_group, personnel.blood_group),
         mobile_number          = EXCLUDED.mobile_number,
         alternate_contact      = COALESCE(EXCLUDED.alternate_contact, personnel.alternate_contact),
         religion               = EXCLUDED.religion,
         caste                  = EXCLUDED.caste,
         category               = EXCLUDED.category,
         aadhar_number          = COALESCE(EXCLUDED.aadhar_number, personnel.aadhar_number),
         pan                    = COALESCE(EXCLUDED.pan, personnel.pan),
         village                = EXCLUDED.village,
         police_station         = EXCLUDED.police_station,
         home_district          = EXCLUDED.home_district,
         rank                   = EXCLUDED.rank,
         cadre                  = EXCLUDED.cadre,
         service_type           = EXCLUDED.service_type,
         service_status         = EXCLUDED.service_status,
         service_book_number    = COALESCE(EXCLUDED.service_book_number, personnel.service_book_number),
         date_of_enlistment     = EXCLUDED.date_of_enlistment,
         date_of_last_promotion = EXCLUDED.date_of_last_promotion,
         retirement_date        = COALESCE(EXCLUDED.retirement_date, personnel.retirement_date),
         graduation_degree      = EXCLUDED.graduation_degree,
         subject_graduation     = EXCLUDED.subject_graduation,
         pg_degree              = EXCLUDED.pg_degree,
         subject_post_graduation= EXCLUDED.subject_post_graduation,
         node_id                = EXCLUDED.node_id,
         updated_at             = NOW(),
         updated_by_user_id     = $44
       RETURNING *, (xmax = 0) AS is_new_record`,
      [
        d.belt_number||null, d.pay_code||null, d.full_name, d.father_name||null, d.photo_url||null,
        d.date_of_birth||null, d.gender||null, d.blood_group||null, d.mobile_number||null, d.alternate_contact||null,
        d.religion||null, d.caste||null, d.category||null, d.aadhar_number||null, d.pan||null,
        d.village||null, d.police_station||null, d.home_district||null, d.home_district_ps||null,
        d.rank||null, d.cadre||null, d.service_type||null, d.service_status||'Active', d.service_book_number||null,
        d.date_of_enlistment||null, d.date_of_last_promotion||null, d.retirement_date||null,
        d.ps_duty_type||null, d.io_status||null, d.io_category||null, d.parade_group||null, d.spo_trade||null,
        d.company||null, d.r_batch||null, d.t_duty_order||null, d.remarks||null,
        d.graduation_degree||null, d.subject_graduation||null, d.pg_degree||null, d.subject_post_graduation||null,
        d.node_id||null, d.date_of_posting||null,
        JSON.stringify(extraFields), req.user.uid
      ]
    );
    const isNew = rows[0]?.is_new_record;
    res.status(isNew ? 201 : 200).json({ ...rows[0], _action: isNew ? 'created' : 'updated' });
  } catch (err) {
    console.error('[Personnel] Upsert error:', err.message);
    res.status(500).json({ error: 'Failed to upsert record.' });
  }
});

// PUT /api/personnel/:id — Update
router.put('/:id', upload.single('photo'), async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin','unit_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    const d = req.body;
    let extraFields = d.extra_fields || '{}';
    if (typeof extraFields === 'string') { try { extraFields = JSON.parse(extraFields); } catch(e) { extraFields = {}; } }
    if (req.file) { d.photo_url = '/uploads/personnel/' + req.file.filename; }
    const { rows } = await pool.query(
      `UPDATE personnel SET
         belt_number=$1, pay_code=$2, full_name=$3, father_name=$4, photo_url=$5,
         date_of_birth=$6, gender=$7, blood_group=$8, mobile_number=$9, alternate_contact=$10,
         religion=$11, caste=$12, category=$13, aadhar_number=$14, pan=$15,
         village=$16, police_station=$17, home_district=$18, home_district_ps=$19,
         rank=$20, cadre=$21, service_type=$22, service_status=$23, service_book_number=$24,
         date_of_enlistment=$25, date_of_last_promotion=$26, retirement_date=$27,
         ps_duty_type=$28, io_status=$29, io_category=$30, parade_group=$31, spo_trade=$32,
         company=$33, r_batch=$34, t_duty_order=$35, remarks=$36,
         graduation_degree=$37, subject_graduation=$38, pg_degree=$39, subject_post_graduation=$40,
         node_id=$41, date_of_posting=$42,
         extra_fields=$43, updated_by_user_id=$44, updated_at=NOW()
       WHERE id=$45 AND is_deleted=false
       RETURNING *`,
      [
        d.belt_number||null, d.pay_code||null, d.full_name, d.father_name||null, d.photo_url||null,
        d.date_of_birth||null, d.gender||null, d.blood_group||null, d.mobile_number||null, d.alternate_contact||null,
        d.religion||null, d.caste||null, d.category||null, d.aadhar_number||null, d.pan||null,
        d.village||null, d.police_station||null, d.home_district||null, d.home_district_ps||null,
        d.rank||null, d.cadre||null, d.service_type||null, d.service_status||'Active', d.service_book_number||null,
        d.date_of_enlistment||null, d.date_of_last_promotion||null, d.retirement_date||null,
        d.ps_duty_type||null, d.io_status||null, d.io_category||null, d.parade_group||null, d.spo_trade||null,
        d.company||null, d.r_batch||null, d.t_duty_order||null, d.remarks||null,
        d.graduation_degree||null, d.subject_graduation||null, d.pg_degree||null, d.subject_post_graduation||null,
        d.node_id||null, d.date_of_posting||null,
        JSON.stringify(extraFields), req.user.uid, req.params.id
      ]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Personnel] Update error:', err); require('fs').writeFileSync('last_error.log', err.stack || err.message);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

// DELETE /api/personnel/:id — Soft delete
router.delete('/:id', async (req, res) => {
  const allowedRoles = ['super_admin','state_admin','district_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permission denied.' });
  }
  try {
    await pool.query(
      `UPDATE personnel SET is_deleted=true, updated_by_user_id=$1, updated_at=NOW()
       WHERE id=$2`,
      [req.user.uid, req.params.id]
    );
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

module.exports = router;


