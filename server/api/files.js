let { file: getFile } = require('../getIO');
let path = require('path');

module.exports = async function(req, res, paths, searchParams) {
  let file = paths.shift();
  if (!file) return 2;
  file = path.join(__dirname, '../../database/data/files', file);
  try {
    let buf = await getFile(file);
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.write(buf);
    res.end();
  } catch {
    return 1;
  }
  return -1;
};