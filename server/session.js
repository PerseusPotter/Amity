var crypto = require('crypto');

var getUUID = function() {
  let uuid;
  let loops = 0;
  do {
    uuid = crypto.randomBytes(32).toString('hex');
    loops++;
    if (loops > 5) {
      console.log('wtf');
      uuid = crypto.randomBytes(32);
      do {
        increment:
        for (let i = 0; i < uuid.length; i++) {
          if (uuid[i]++ !== 255) break increment;
        }
      } while (sessions.has(uuid.toString('hex')));
      uuid = uuid.toString();
    }
  } while (sessions.has(uuid));
  return uuid;
};

const SESSION_LENGTH = 12 * 60 * 60 * 1000;
var sessions = new Map();
var createSession = function() {
  let session = Object.create(null);
  let uuid = getUUID();
  session.uuid = uuid;
  session.name;
  session.avatar;
  session.creationTime = Date.now();
  session.expirationTime = session.creationTime + SESSION_LENGTH;
  session.onExpire = Function.prototype;

  sessions.set(uuid, session);
  return session;
};

module.exports = {
  has: function(uuid) {
    return sessions.has(uuid);
  },
  get: function(uuid) {
    let s = sessions.get(uuid);
    if (!s) return;
    s.expirationTime = Date.now() + SESSION_LENGTH;
    return s;
  },
  delete: function(uuid) {
    if (!sessions.has(uuid)) return;
    let session = sessions.get(uuid);
    session.onExpire(session);
    sessions.delete(uuid);
  },
  create: function() {
    let s = createSession();
    return s;
  },
  updateTimer: setInterval(() => {
    let t = Date.now();
    for (let [uuid, session] of sessions.entries()) {
      if (t > session.expirationTime) {
        session.onExpire(session);
        sessions.delete(uuid);
      }
    }
  }, 1000).unref()
};