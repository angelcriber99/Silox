import * as http from 'http'
const start = Date.now();
http.get('http://localhost:3000/api/mobile/v1/portfolio', { headers: { 'Authorization': 'Bearer test' } }, (res) => {
  console.log("Status:", res.statusCode);
  res.on('data', () => {});
  res.on('end', () => console.log("Time:", Date.now() - start));
}).on('error', (e) => console.log("Error", e));
