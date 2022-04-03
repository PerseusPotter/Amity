var Table = require('./db');
var Servers = new Table('./data/servers.stupiddb', [
  {
    name: 'id',
    type: 'uuid',
    length: 8
  },
  {
    name: 'name',
    type: 'string',
    length: 32
  },
  {
    name: 'owner',
    type: 'uuid',
    length: 8
  },
  {
    name: 'iconID',
    type: 'uuid',
    length: 8
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
  },
  {
    name: 'members',
    type: 'buffer',
    length: 8 * 200
  },
  {
    name: 'channels',
    type: 'buffer',
    length: (8 + 32) * 60
  }
]);

var Channel = require('./channel');
var snowflake = require('./snowflake');
var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}

let serverCache = new WeakMap();
module.exports = {
  async createServer(name, owner, icon, interests1, interests2) {
    let serverID = snowflake(2);
    let iconID = snowflake(3);
    // 8MB
    if (icon.byteLength > 8388608) throw 'image to big';
    await fs_p.writeFile('./data/files/' + iconID + '.jpg', icon);

    let mBuf = Buffer.allocUnsafe(8);
    mBuf.writeBigUInt64LE(owner);
    let channel = new Channel();
    let cBuf = Buffer.allocUnsafe(40);
    cBuf.writeBigUInt64LE(channel.id);
    cBuf.write('general', 8);

    let data = {
      id: serverID,
      name,
      owner,
      iconID,
      interests1,
      interests2,
      members: mBuf,
      channels: cBuf
    };
    await Servers.appendRow(data);

    return data;
  },
  async getServer(id) {
    let i;
    if (serverCache.has(id)) i = serverCache.get(id);
    else {
      i = await Servers.findRow('id', id);
      if (i === -1) return null;
      serverCache.set(id, i);
    }

    let data = await Servers.readRow(i);

    return data;
  },
  async setServer(data) {
    let i;
    if (serverCache.has(data.id)) i = serverCache.get(data.id);
    else {
      i = await Servers.findRow('id', data.id);
      if (i === -1) throw 'cannot find server';
      serverCache.set(data.id, i);
    }

    await Servers.writeRow(data, i);

    return data;
  },
  async deleteServer(id) {
    let i;
    if (serverCache.has(id)) i = serverCache.get(id);
    else {
      i = await Servers.findRow('id', id);
      if (i === -1) return null;
      serverCache.set(id, i);
    }

    let old = await this.getServer(id);

    await Servers.deleteRow(i);

    return old;
  }
};