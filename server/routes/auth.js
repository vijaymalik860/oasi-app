// routes/auth.js — Login / Logout / Me
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../db');
const authenticate = require('../middleware/auth');
const router   = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { beltNumber, password } = req.body;

    if (!beltNumber || !password) {
      return res.status(400).json({ error: 'Belt number aur password dono zaroori hain.' });
    }

    // User fetch karo with all related data
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.belt_number, u.password_hash, u.is_active,
        u.node_id, u.personnel_id, u.mobile_number,
        r.name  AS role_name,
        h.name  AS node_name,
        h.level AS node_level,
        CASE 
          WHEN h.level = 4 THEN h_greatgrandparent.id
          WHEN h.level = 3 THEN h_grandparent.id
          WHEN h.level = 2 THEN h_parent.id
          WHEN h.level = 1 THEN h.id
        END AS state_id,
        CASE 
          WHEN h.level = 4 THEN h_greatgrandparent.name
          WHEN h.level = 3 THEN h_grandparent.name
          WHEN h.level = 2 THEN h_parent.name
          WHEN h.level = 1 THEN h.name
        END AS state_name,
        CASE 
          WHEN h.level = 4 THEN h_grandparent.id
          WHEN h.level = 3 THEN h_parent.id
          WHEN h.level = 2 THEN h.id
        END AS range_id,
        CASE 
          WHEN h.level = 4 THEN h_grandparent.name
          WHEN h.level = 3 THEN h_parent.name
          WHEN h.level = 2 THEN h.name
        END AS range_name,
        CASE 
          WHEN h.level = 4 THEN h_parent.id
          WHEN h.level = 3 THEN h.id
        END AS district_id,
        CASE 
          WHEN h.level = 4 THEN h_parent.name
          WHEN h.level = 3 THEN h.name
        END AS district_name,
        CASE WHEN h.level = 4 THEN h.id END AS unit_id,
        CASE WHEN h.level = 4 THEN h.name END AS unit_name
      FROM   app_users u
      JOIN   roles r    ON r.id  = u.role_id
      LEFT JOIN hierarchy_nodes h ON h.id = u.node_id
      LEFT JOIN hierarchy_nodes h_parent ON h_parent.id = h.parent_id
      LEFT JOIN hierarchy_nodes h_grandparent ON h_grandparent.id = h_parent.parent_id
      LEFT JOIN hierarchy_nodes h_greatgrandparent ON h_greatgrandparent.id = h_grandparent.parent_id
      WHERE  u.belt_number = $1
    `, [beltNumber.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. Belt number sahi nahi hai.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account inactive hai. Admin se contact karo.' });
    }

    // ✅ Secure bcrypt password check
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials. Password galat hai.' });
    }

    // Last login update
    await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [user.id]);

    // JWT issue karo
    const token = jwt.sign(
      {
        uid:        user.id,
        belt:       user.belt_number,
        role:       user.role_name,
        nodeId:     user.node_id,
        nodeName:   user.node_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Frontend ke liye user object (AuthContext format match)
    const ROLE_LABELS = {
      super_admin:    'Super Admin (Headquarters)',
      state_admin:    'State Admin',
      range_admin:    'Range Admin (OASI)',
      district_admin: 'District Admin (OASI)',
      unit_admin:     'Unit Admin (MHC)',
      staff:          'Normal Staff',
    };

    const sessionUser = {
      uid:          user.id,
      name:         user.name,
      beltNumber:   user.belt_number,
      role:         user.role_name,
      roleLabel:    ROLE_LABELS[user.role_name] || user.role_name,
      nodeId:       user.node_id,
      nodeName:     user.node_name || '',
      personnelId:  user.personnel_id,
      stateId:      user.state_id || null,
      rangeId:      user.range_id || null,
      districtId:   user.district_id || null,
      unitId:       user.unit_id || null,
      subUnitId:    null,
      stateName:    user.state_name || '',
      rangeName:    user.range_name || '',
      districtName: user.district_name || '',
      unitName:     user.unit_name || '',
      subUnitName:  '',
    };

    return res.json({ token, user: sessionUser });

  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out.' });
});

// GET /api/auth/me — Token se current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.belt_number, u.node_id, u.personnel_id, u.is_active,
             r.name AS role_name,
             h.name AS node_name,
             h.level AS node_level,
             CASE 
               WHEN h.level = 4 THEN h_greatgrandparent.id
               WHEN h.level = 3 THEN h_grandparent.id
               WHEN h.level = 2 THEN h_parent.id
               WHEN h.level = 1 THEN h.id
             END AS state_id,
             CASE 
               WHEN h.level = 4 THEN h_greatgrandparent.name
               WHEN h.level = 3 THEN h_grandparent.name
               WHEN h.level = 2 THEN h_parent.name
               WHEN h.level = 1 THEN h.name
             END AS state_name,
             CASE 
               WHEN h.level = 4 THEN h_grandparent.id
               WHEN h.level = 3 THEN h_parent.id
               WHEN h.level = 2 THEN h.id
             END AS range_id,
             CASE 
               WHEN h.level = 4 THEN h_grandparent.name
               WHEN h.level = 3 THEN h_parent.name
               WHEN h.level = 2 THEN h.name
             END AS range_name,
             CASE 
               WHEN h.level = 4 THEN h_parent.id
               WHEN h.level = 3 THEN h.id
             END AS district_id,
             CASE 
               WHEN h.level = 4 THEN h_parent.name
               WHEN h.level = 3 THEN h.name
             END AS district_name,
             CASE WHEN h.level = 4 THEN h.id END AS unit_id,
             CASE WHEN h.level = 4 THEN h.name END AS unit_name
      FROM   app_users u
      JOIN   roles r    ON r.id = u.role_id
      LEFT JOIN hierarchy_nodes h ON h.id = u.node_id
      LEFT JOIN hierarchy_nodes h_parent ON h_parent.id = h.parent_id
      LEFT JOIN hierarchy_nodes h_grandparent ON h_grandparent.id = h_parent.parent_id
      LEFT JOIN hierarchy_nodes h_greatgrandparent ON h_greatgrandparent.id = h_grandparent.parent_id
      WHERE  u.id = $1
    `, [req.user.uid]);

    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const u = rows[0];
    res.json({
      uid:          u.id,
      name:         u.name,
      beltNumber:   u.belt_number,
      role:         u.role_name,
      nodeId:       u.node_id,
      nodeName:     u.node_name || '',
      stateId:      u.state_id || null,
      rangeId:      u.range_id || null,
      districtId:   u.district_id || null,
      unitId:       u.unit_id || null,
      subUnitId:    null,
      stateName:    u.state_name || '',
      rangeName:    u.range_name || '',
      districtName: u.district_name || '',
      unitName:     u.unit_name || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
