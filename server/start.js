var http = require('http');
// var https = require('https');
var onreq = require('./onrequest');
var portHttp = 80;
// var portHttps = 443;

process.env.thisUrl = 'localhost';
process.env.thisProto = 'http';

// const options = {
//   key: process.env['key'],
//   cert: process.env['cert']
// };

var onError = function(res, err) {
  if (res.writableEnded) return;
  else if (res.headersSent) return res.end();
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write((err || 'Unknown Error').toString());
  res.end();
};
var serverHttp = http.createServer((req, res) => {
  onreq('http://', req, res, portHttp).catch(e => onError(res, e));
});
// var serverHttps = https.createServer(options, (req, res) => {
//   onreq('https://', req, res, portHttps).catch(e => onError(res, e));
// });

module.exports = function() {
  void serverHttp.listen(portHttp, () => {
    console.log(`HttpServer listening on port ${portHttp}`);
  });
  // void serverHttps.listen(portHttps, () => {
  // console.log(`HttpsServer listening on port ${portHttps}`);
  // });
};