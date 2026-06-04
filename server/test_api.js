const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const token = jwt.sign({ uid: '00000000-0000-0000-0000-000000000000', belt: '1234', role: 'super_admin' }, process.env.JWT_SECRET);

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/personnel/00000000-0000-0000-0000-000000000000',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.write(JSON.stringify({ full_name: 'Test', belt_number: '123' }));
req.end();
