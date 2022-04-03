var Servers = require('../../database/server');
var Users = require('../../database/user');
var Channel = require('../../database/channel');
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

let popcnt = function(num) {
  let cnt = 0;
  for (; num; cnt++) {
    num &= num - 1n;
  }
  return cnt;
};

module.exports = async function(req, res, paths, searchParams) {
  switch (paths.shift()) {
    case 'data': {
      let serverID = BigInt(paths.shift());
      if (!serverID) return 2;
      let server = await Servers.getServer(serverID);
      if (!server) throw 'server not found';
      if (req.method === 'GET') {
        if (server.visibility === 0) {
          let userID = auth.getUser(req);
          let isInServer = false;
          let m = server.members;
          for (let i = 0, l = m.length; !isInServer && i < l; i++) {
            let id = m.readBigUInt64LE(i);
            if (id === userID) isInServer = true;
          }
          if (!isInServer) throw 'server not found';
        }
        let members = [];
        let m = server.members;
        for (let i = 0, l = m.length; i < l; i += 8) {
          let id = m.readBigUInt64LE(i);
          if (id > 0n) members.push(id.toString());
        }
        let channels = [];
        m = user.channels;
        for (let i = 0, l = m.length; i < l; i += 40) {
          let id = m.readBigUInt64LE(i);
          if (id > 0n) {
            let name = m.slice(i + 8, i + 40).toString();
            channels.push({
              id: id.toString(),
              name
            });
          }
        }
        return JSON.stringify({ id: server.id, name: server.name, owner: server.owner, icon: '/api/files/' + server.iconID + '.jpg', interests: server.interests.toString(), members, channels, isVisible: server.visibility > 0 });
      } else {
        let id = auth.getUser(req);
        if (server.owner !== id) throw 'you are not the owner of the server';
        let form = await formDecode(req);
        if ('json_payload' in form) {
          let data = JSON.parse(form.json_payload.data);
          if ('name' in data) {
            if (data.name.length > 32 || data.name.length < 2) throw 'name length bad';
            server.name = data.name;
          }
          if ('owner' in data) server.owner = BigInt(data.owner);
          if ('interests' in data) server.interests = BigInt(data.interests);
        }
        if ('icon' in form) {
          let iconID = snowflake(3);
          // 8MB
          if (form.icon.data.byteLength > 8388608) throw 'image to big';
          await fs_p.writeFile(path.join(__dirname, '../../database/data/files/', iconID + '.jpg'), form.icon.data);
          server.iconID = iconID;
        }

        await Servers.setServer(server);
      }
      break;
    }
    case 'leave': {
      let userID = auth.getUser(req);
      let user = await Users.getUser(userID);
      let serverID = BigInt(paths.shift());
      if (!serverID) return 2;
      let server = await Servers.getServer(serverID);
      if (!server) throw 'server not found';

      let isInServer = false;
      let m = server.members;
      for (let i = 0, l = m.length; !isInServer && i < l; i++) {
        let id = m.readBigUInt64LE(i);
        if (id === userID) {
          isInServer = true;
          m.writeBigUInt64LE(0n, i);
        }
      }
      if (!isInServer) throw 'you are not in the server';

      m = user.servers;
      for (let i = 0, l = m.length; i < l; i++) {
        let id = m.readBigUInt64LE(i);
        if (id === userID) {
          m.writeBigUInt64LE(0n, i);
          break;
        }
      }

      await Users.setUser(user);
      await Servers.setServer(server);
      break;
    }
    case 'channels': {
      let serverID = BigInt(paths.shift());
      if (!server) return 2;
      let server = await Servers.getServer(serverID);
      if (!server) throw 'server not found';

      let isInServer = false;
      let m = server.members;
      for (let i = 0, l = m.length; !isInServer && i < l; i++) {
        let id = m.readBigUInt64LE(i);
        if (id === userID) isInServer = true;
      }
      if (!isInServer) {
        if (server.visibility > 0) throw 'you are not in the server';
        else throw 'server not found';
      }

      switch (paths.shift()) {
        case 'new': {
          let name = await finishStream(req).toString();
          if (name.length < 2 || name.length > 32) throw 'name length bad';

          let channel = new Channel();
          let wasWritten = false;
          m = server.channels;
          for (let i = 0, l = m.length; !wasWritten && i < l; i++) {
            let id = m.readBigUInt64LE(i);
            if (i === 0) {
              wasWritten = true;
              m.writeBigUInt64LE(channel.id, i);
              m.write(name, i + 8, 32);
            }
          }
          if (!wasWritten) throw 'maximum number of channels exceeded';
          await Servers.setServer(server);
          break;
        }
      }
    }
    case 'similar': {
      let interests = paths.shift();
      if (!interests) return 2;
      interests = BigInt(interests);

      let servers = [];
      let table = Servers.table;
      let index = table.totalLength;
      let len = table.cumSumT;
      while (index >= 0) {
        let server = table.readRow(index);
        let similar = server.interests & interests;
        servers.push({ count: popcnt(similar), id: server.id.toString(), similar: similar.toString() });
        index -= len;
      }
      servers.sort((a, b) => b.count - a.count);
      servers = servers.slice(0, 10);
      return JSON.stringify(servers);
    }
  }

  return 0;
};