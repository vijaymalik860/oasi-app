// middleware/auth.js — JWT Token Verification
const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
  // 🚨 MOCK AUTHENTICATION FOR OPEN PORTAL (NO LOGIN REQUIRED)
  req.user = { 
    uid: null, 
    belt: 'ADMIN001', 
    role: 'super_admin', 
    nodeId: null, 
    stateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
    districtId: null, 
    unitId: null 
  };
  next();
};
