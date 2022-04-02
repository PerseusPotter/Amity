var fs = require('fs');
var path = require('path');
var https = require('https');
var URL = require('url').URL;

const CACHE_LENGTH = 60 * 60 * 1000;
// const CACHE_LENGTH = 1;
var fileCache = new Map();
let getFile = function(name) {
  let t = Date.now();
  for (let [name, data] of fileCache.entries()) {
    if (t - data.time > CACHE_LENGTH) {
      fileCache.delete(name);
    }
  }
  return new Promise((resolve, reject) => {
    name = path.resolve(__dirname, name);
    if (fileCache.has(name)) return resolve(fileCache.get(name));
    if (!fs.existsSync(name)) return reject('File not found: ' + name);
    // no point of streams, it's going into cache
    fs.readFile(name, (err, data) => {
      if (err) return reject(err);
      resolve(data);
      data.time = Date.now();
      fileCache.set(name, data);
    });
  });
};

var webCache = new Map();
let getURL = function(url) {
  let t = Date.now();
  for (let [name, data] of webCache.entries()) {
    if (t - data.time > CACHE_LENGTH) {
      webCache.delete(name);
    }
  }
  return new Promise((resolve, reject) => {
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
        buf.time = Date.now();
        webCache.set(url, buf);
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