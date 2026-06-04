const http = require('http');
const fs = require('fs');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/personnel/1', // assuming id 1 exists
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.TOKEN
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.write(JSON.stringify({ full_name: 'Test' }));
req.end();
