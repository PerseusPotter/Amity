var finishStream = function(stream) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let len = 0;
    stream.on('data', c => {
      chunks.push(c);
      len += c.length;
      if (len > 10485760) reject('too long');
    });
    stream.on('end', () => {
      let buf = Buffer.concat(chunks);
      resolve(buf);
    });
    stream.on('error', e => reject(e));
  });
};

let indexOf = function(buf, num, pos = 0) {
  let l = buf.length;
  while (pos < l && buf[pos] !== num) pos++;
  return pos === l ? -1 : pos;
};

module.exports = function(req) {
  return new Promise(async (resolve, reject) => {
    let parts = req.headers['content-type'].split(';');
    if (parts[0] !== 'multipart/form-data') return reject('not form data');
    parts = parts[1].split('boundary=');
    if (parts.length < 2) return reject('no boundary');
    let boundary = '--' + parts[1].split(';')[0];
    boundary = Buffer.from(boundary);
    let len = boundary.byteLength;

    // TODO: use streams (but that's hard)
    let data = Object.create(null);
    let raw = await finishStream(req);
    let bufPos = 0;
    let l = raw.length;

    // skip past first boundary
    while (boundary.compare(raw, bufPos, bufPos + len, 0, len)) bufPos++;
    bufPos += len + 1;

    while (bufPos < l) {
      let eol = indexOf(raw, 10, bufPos);
      if (eol === -1) break;
      bufPos = eol + 1

      let disposition = raw.slice(bufPos, eol).toString();
      parts = disposition.split(';');
      if (parts[0] !== 'Content-Disposition: form-data') continue;

      let tmp = parts[1].split('name=');
      if (tmp.length < 2) return reject('malformed form data');
      let name = tmp[1].split(';')[0];

      tmp = parts[1].split('filename=');
      let filename;
      let contentType;
      if (tmp.length === 2) {
        filename = tmp[1].split(';')[0];
        if (filename[0] === '"') filename = filename.slice(1, -1);

        eol = indexOf(raw, 10, bufPos);
        if (eol === -1) break;
        bufPos = eol + 1

        let contentTypeRaw = raw.slice(bufPos, eol).toString();
        parts = contentTypeRaw.split(':');
        if (parts[0] !== 'Content-Type') return reject('malformed form data');
        contentType = parts[1].trim();
      }
      bufPos++;

      let pos = bufPos;
      while (boundary.compare(raw, pos, pos + len, 0, len)) pos++;
      let dat = raw.slice(bufPos, pos);
      data[name] = {
        filename,
        contentType,
        data: dat
      };
      bufPos = pos + len + 1;
    }

    resolve(data);
  });
};