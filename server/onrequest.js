var path = require('path');
var { file: getFile } = require('./getIO');
var api = require('./api');

let fileTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif'
};
var files = (function() {
  let f = new Map();
  let websiteFolder = path.join(__dirname, '../website');
  require('fs').readdirSync(websiteFolder).forEach(v => {
    let ext = path.extname(v);
    let basename = path.basename(v);
    let obj = {
      path: path.join(websiteFolder, v),
      type: fileTypes[ext] || 'application/octet-stream'
    }
    f.set('/' + basename, obj);
    if (ext === '.html') f.set('/' + path.basename(basename, ext), obj);
  });
  return f;
}());

var onrequest = async function(protocol, req, res, port) {
  let { pathname, searchParams } = new URL(req.url, 'https://localhost');

  if (pathname.startsWith('/api/')) return await api(req, res, pathname, searchParams);

  if (pathname === '/') {
    let site;
    try {
      auth(req);
      site = path.join(websiteFolder, 'app.html');
    } catch {
      site = path.join(websiteFolder, 'home.html');
    }
    site = await getFile(site);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(site);
    res.end();
    return;
  }
  if (pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Pong!');
    res.end();
    return;
  }
  if (files.has(pathname)) {
    let file = files.get(pathname);
    res.writeHead(200, { 'Content-Type': file.type });
    let dat = await getFile(file.path);
    res.write(dat);
    res.end();
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.write('Hello World!');
  res.end();
};

module.exports = onrequest;