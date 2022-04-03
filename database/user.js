var Table = require('./db');
var Users = new Table('./data/users.stupiddb', [
  {
    name: 'id',
    type: 'uuid',
    length: 8
  },
  {
    name: 'username',
    type: 'string',
    length: 32
  },
  {
    name: 'salt',
    type: 'buffer',
    length: 16
  },
  {
    name: 'clientKeyH',
    type: 'hex',
    length: 32
  },
  {
    name: 'serverKey',
    type: 'hex',
    length: 32
  },
  {
    name: 'avatarID',
    type: 'uuid',
    length: 8
  },
  {
    name: 'friends',
    type: 'buffer',
    length: 8 * 200
  },
  {
    name: 'interests1',
    type: 'number',
    length: 4
  },
  {
    name: 'interests2',
    type: 'number',
    length: 4
  }
]);

var { promisify } = require('util');
var { pbkdf2, randomBytes, createHmac, createHash } = require('crypto');
pbkdf2 = promisify(pbkdf2);
var snowflake = require('./snowflake');
var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}

let userCache = new WeakMap();
module.exports = {
  async createUser(username, password, avatar, interests1, interests2) {
    let userID = snowflake(0);
    let avatarID = snowflake(1);
    // 8MB
    if (avatar.byteLength > 8388608) throw 'image to big';
    await fs_p.writeFile('./data/files/' + avatarID + '.jpg', avatar);

    let salt = randomBytes(16);
    let saltedPass = await pbkdf2(password, salt, 10000, 32, 'sha256');
    let clientKey = createHmac('sha256', 'Client Key');
    clientKey.update(saltedPass);
    clientKey = clientKey.digest();
    let clientKeyH = createHash('sha256');
    clientKeyH.update(clientKey);
    clientKeyH = clientKeyH.digest('hex');
    let serverKey = createHmac('sha256', 'Server Key');
    serverKey.update(saltedPass);
    serverKey = serverKey.digest('hex');

    let data = {
      id: userID,
      username,
      salt,
      clientKeyH,
      serverKey,
      avatarID,
      friends: null,
      interests1,
      interests2
    };
    await Users.appendRow(data);

    return data;
  },
  async getUser(id) {
    let i;
    if (userCache.has(id)) i = userCache.get(id);
    else {
      i = await Users.findRow('id', id);
      if (i === -1) return null;
      userCache.set(id, i);
    }

    let data = await Users.readRow(i);

    return data;
  },
  async setUser(data) {
    let i;
    if (userCache.has(data.id)) i = userCache.get(data.id);
    else {
      i = await Users.findRow('id', data.id);
      if (i === -1) throw 'cannot find user';
      userCache.set(data.id, i);
    }

    await Users.writeRow(data, i);
  },
  async deleteUser(id) {
    let i;
    if (userCache.has(id)) i = userCache.get(id);
    else {
      i = await Users.findRow('id', id);
      if (i === -1) return null;
      userCache.set(id, i);
    }

    let old = await this.getUser(id);

    await Users.deleteRow(i);

    return old;
  }
};