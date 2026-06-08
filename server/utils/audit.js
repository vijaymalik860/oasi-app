const { pool } = require('../db');

/**
 * Logs an action to the audit_logs table
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Description of the action (e.g. 'CREATE_USER', 'UPDATE_ROLE')
 * @param {string} entityType - The type of entity affected (e.g. 'User', 'Role', 'Personnel')
 * @param {string} entityId - The ID of the affected entity (optional)
 * @param {object} oldData - The state before the action (optional)
 * @param {object} newData - The state after the action (optional)
 * @param {string} ipAddress - IP address of the user (optional)
 */
async function logAudit(userId, action, entityType, entityId = null, oldData = null, newData = null, ipAddress = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, oldData, newData, ipAddress]
    );
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

module.exports = { logAudit };
