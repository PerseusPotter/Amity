var fs = require('fs');
var path = require('path');
var https = require('https');
var URL = require('url').URL;
var createCache = require('./cache');

const CACHE_LENGTH = 60 * 60 * 1000;
// const CACHE_LENGTH = 1;
var fileCache = createCache(CACHE_LENGTH);
let getFile = function(name) {
  return new Promise((resolve, reject) => {
    name = path.resolve(__dirname, name);
    if (fileCache.has(name)) return resolve(fileCache.get(name).data);
    if (!fs.existsSync(name)) return reject('File not found: ' + name);
    // no point of streams, it's going into cache
    fs.readFile(name, (err, data) => {
      if (err) return reject(err);
      resolve(data);
      let item = fileCache.create(name);
      item.data = data;
    });
  });
};

var webCache = createCache(CACHE_LENGTH);
let getURL = function(url) {
  return new Promise((resolve, reject) => {
    if (webCache.has(url)) return resolve(webCache.get(url).data);
    url = new URL(url);
    let options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET'
    };

    let req = https.request(options, res => {
      if (res.headers.location && (res.statusCode === 201 || ~~(res.statusCode / 100) === 3)) {
        getURL(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let buf = Buffer.concat(chunks);
        resolve(buf);
        let item = webCache.create(url);
        item.data = buf;
      });
      res.on('error', e => reject(e));
    });

    req.on('error', reject);

    req.end();
  });
};

module.exports = {
  file: getFile,
  url: getURL
};