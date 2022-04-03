var Users = require('../../database/user');
var Servers = require('../../database/server');
var auth = require('../auth');
var formDecode = require('../formDecode');
var snowflake = require('../../database/snowflake');
var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}
var path = require('path');
var { promisify } = require('util');
var { pbkdf2, randomBytes, createHmac, createHash } = require('crypto');
pbkdf2 = promisify(pbkdf2);

module.exports = async function(req, res, paths, searchParams) {
  switch (paths.shift()) {
    case 'logout':
      auth.logout(req);
      break;
    case 'signup': {
      let form = await formDecode(req);
      if (!('json_payload' in form && 'avatar' in form)) return 2;
      let data = JSON.parse(form.json_payload.data);
      if (!('username' in data && 'password' in data && 'interests' in data)) return 2;
      if (data.username.length > 32 || data.username.length < 2) throw 'username length bad';
      await Users.createUser(data.username, data.password, form.avatar.data, BigInt(data.interests));
      break;
    }
    case 'data': {
      if (req.method === 'GET') {
        let id = BigInt(paths.shift() || auth.getUser(req));
        let user = await Users.getUser(id);
        if (!user) throw 'unable to find user';
        let friends = [];
        let f = user.friends;
        for (let i = 0, l = f.length; i < l; i += 8) {
          let id = f.readBigUInt64LE(i);
          if (id > 0n) friends.push(id.toString());
        }
        return JSON.stringify({ id: user.id.toString(), username: user.username, avatar: '/api/files/' + user.avatarID + '.jpg', friends, interests: user.interests.toString() });
      } else {
        let id = auth.getUser(req);
        let user = await Users.getUser(id);
        let form = await formDecode(req);
        if ('json_payload' in form) {
          let data = JSON.parse(form.json_payload.data);
          if ('username' in data) {
            if (data.username.length > 32 || data.username.length < 2) throw 'username length bad';
            user.username = data.username;
          }
          if ('password' in data) {
            let salt = randomBytes(16);
            let saltedPass = await pbkdf2(data.password.data, salt, 10000, 32, 'sha256');
            let clientKey = createHmac('sha256', 'Client Key');
            clientKey.update(saltedPass);
            clientKey = clientKey.digest();
            let clientKeyH = createHash('sha256');
            clientKeyH.update(clientKey);
            clientKeyH = clientKeyH.digest('hex');
            let serverKey = createHmac('sha256', 'Server Key');
            serverKey.update(saltedPass);
            serverKey = serverKey.digest('hex');
            user.salt = salt;
            user.clientKeyH = clientKeyH;
            user.serverKey = serverKey;
          }
          if ('interests' in data) user.interests = BigInt(data.interests);
        }
        if ('avatar' in form) {
          let avatarID = snowflake(1);
          // 8MB
          if (form.avatar.data.byteLength > 8388608) throw 'image to big';
          await fs_p.writeFile(path.join(__dirname, '../../database/data/files/', avatarID + '.jpg'), form.avatar.data);
          user.avatarID = avatarID;
        }

        await Users.setUser(user);
      }
      break;
    }
    case 'delete': {
      let id = auth.getUser(req);
      await Users.deleteUser(id);
      break;
    }
    case 'servers': {
      let userID = auth.getUser(req);
      let user = Users.getUser(userID);
      if (req.method === 'GET') {
        let s = user.servers;
        let arr = [];
        for (let i = 0, l = s.length; i < l; i++) {
          let id = s.readBigUInt64LE(i);
          if (id > 0n) arr.push(id.toString());
        }
        return JSON.stringify(arr);
      } else {
        let serverID = BigInt(paths.shift());
        if (!serverID) return 2;
        let server = await Servers.getServer(serverID);
        if (!server || server.visibility === 0) throw 'server not found';

        let m = server.members;
        let written = false;
        for (let i = 0, l = m.length; i < l; i++) {
          let id = m.readBigUInt64LE(i);
          if (id === 0n) {
            m.writeBigUInt64LE(userID, i);
            written = true;
            break;
          }
        }
        if (!written) throw 'server is full';

        written = false;
        m = user.servers;
        for (let i = 0, l = m.length; i < l; i++) {
          let id = m.readBigUInt64LE(i);
          if (id === 0n) {
            m.writeBigUInt64LE(serverID, i);
            written = true;
            break;
          }
        }
        if (!written) throw 'maximum number of servers joined';

        await Servers.setServer(server);
      }
    }
    default: return 1;
  }

  return 0;
};