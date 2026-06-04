// middleware/auth.js — JWT Token Verification
const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Login karo pehle.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { uid, belt, role, nodeId, stateId, districtId, unitId }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalid ya expire ho gaya. Dobara login karo.' });
  }
};
