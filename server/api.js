var nonce = require('./nonce');
var help = require('./api/help');

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

let handlers = {};
module.exports = function(req, res, userID, pathname, searchParams) {
  let paths = pathname.split('/').slice(2);

  let handler;
  if (paths.length > 0) handler = handlers[paths.shift()];
  if (!handler) handler = help;

  handler(req, res, userID, paths, searchParams);
};