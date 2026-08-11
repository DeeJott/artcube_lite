const http = require('http');

console.log("Requesting http://localhost:3000/media/Contrasts-Dryhope.mp3...");

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/media/Contrasts-Dryhope.mp3',
  method: 'HEAD'
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
