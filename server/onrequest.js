var path = require('path');
var { unescape: decodeURIComponent } = require('querystring');
var URL = require('url').URL;
var { file: getFile, url: getURL } = require('./getIO');
var { getAll: getAllCookies, get: getCookie, set: setCookie } = require('./cookies');
var { has: hasSession, get: getSession, delete: deleteSession, create: createSession } = require('./session');
var api = require('../database/api');

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
  f.set('/', { path: path.join(websiteFolder, 'home.html'), type: 'text/html' });
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

var getQS = (url, key) => (url.match(new RegExp(`\\?.*?${key}=([^&]+?)(?:$|&)`)) || [])[1];

var relativeToValues = ['before', 'after', 'around'];

var finishStream = function(stream) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => {
      let buf = Buffer.concat(chunks);
      resolve(buf);
    });
    stream.on('error', e => reject(e));
  });
};

var onrequest = async function(protocol, req, res, port) {
  res.setHeader('Cache-Control', 'no-cache');
  let uuid = getCookie(req, 'coolsecretuuid');
  let session;
  let pathname = req.url.split('?')[0];
  if (uuid && uuid !== 'poop') {
    session = getSession(uuid);
    if (!session || pathname === '/resetplz') {
      setCookie(res, [['coolsecretuuid', 'poop'], ['Expires', 'Thu, Jan 01 1970 00:00:00 UTC']]);
      deleteSession(uuid);
      res.writeHead(302, { 'Location': '/' });
      res.end();
      return;
    }
    if (pathname.startsWith('/api')) {
      /*
      /api/getMessages
      serverID: <serverID>
      messageID: [messageID]
      relativeTo: [relativeTo]
      returns at most 50 messages
      [
        {
          "id": {messageID@string},
          "content": {msg@string},
          "name": {username@string},
          "avatar": {avatar@url},
          "time": {time@utc}
        }
      ]

      /api/sendMessage
      serverID: <serverID>
      message: <encodeURLComponent(msg)>
      files: {
        name: <name@string>,
        data: <data@base64>
      }[]
      returns
      {
        success: {was successfully sent@boolean},
        error: [error]@?string
      }

      /api/getServers
      returns
      [
        {
          "id": {serverID@string},
          "name": {serverName@string},
          "icon": [icon@?url]
        }
      ]
      */
      let data;
      let body = await finishStream(req);
      body = body.toString() || '{}';
      body = JSON.parse(body);
      if (pathname === '/api/getMessages') {
        if (!body.serverID || (body.relativeTo && !relativeToValues.includes(body.relativeTo))) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.write('missing/invalid parameters');
          res.end();
          return;
        }
        data = await api.getMessages(body.serverID, body.messageID, body.relativeTo);
        data = data.map(v => {
          let url = new URL(v.avatar);
          url.hostname = process.env.thisURL;
          url.pathname = 'getcdn';
          url.searchParams.set('url', v.avatar);
          v.avatar = url.toString();
          return v;
        });
      } else if (pathname === '/api/sendMessage') {
        let message = decodeURIComponent(body.message);
        if (!body.serverID || !message) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.write('missing/invalid parameters');
          res.end();
          return;
        }
        data = await api.sendMessage(body.serverID, message, session.name, `${process.env.thisProto}://${process.env.thisURL}/tempfile/${session.uuid}`);
      } else if (pathname === '/api/getServers') {
        data = await api.getServers();
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.write('path not found');
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify(data || {}));
      res.end();
      return;
    }
    if (pathname === '/getcdn') {
      let url = decodeURIComponent(getQS(req.url, 'url'));
      let buf = await getURL(url);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.write(buf);
      res.end();
      return;
    }
    if (pathname === '/') {
      let site = await getFile(files.get('/amity.html').path);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write(site);
      res.end();
      return;
    }
    // overflow into below
  }
  if (pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Pong!');
    res.end();
    return;
  }
  if (pathname === '/submit') {
    let body = await finishStream(req);
    body = body.toString();
    body = JSON.parse(body);
    session = createSession();
    session.name = body.name;
    session.avatar = Buffer.from(body.avatar, 'base64');
    setCookie(res, [['coolsecretuuid', session.uuid], ['Max-Age', (session.expirationTime - session.creationTime) / 1000]]);
    res.writeHead(302, { 'Location': '/home' });
    res.end();
    return;
  }
  if (pathname === '/tempfile') {
    uuid = req.url.slice(10);
    session = getSession(uuid);
    if (!session) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.write(session.avatar);
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
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Hello World!');
  res.end();
};

module.exports = onrequest;