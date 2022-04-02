module.exports = {
  getAll: function(req) {
    var list = {},
      rc = req.headers.cookie;

    rc && rc.split(';').forEach(cookie => {
      let parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
  },
  get: function(req, name) {
    var result,
      rc = req.headers.cookie;

    rc && rc.split(';').forEach(cookie => {
      let parts = cookie.split('=');
      let n = parts.shift().trim();
      if (n !== name) return;
      result = decodeURI(parts.join('='));
    });

    return result;
  },
  set: function(res, keys) {
    let str = (keys || []).map(item => {
      if (!Array.isArray(item)) return item;
      return `${item[0]}=${encodeURI(item[1])}`;
    }).join('; ');
    res.setHeader('Set-Cookie', str);
  }
};