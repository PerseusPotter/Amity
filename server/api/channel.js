var Servers = require('../../database/server');
var Channel = require('../../database/channel');
var auth = require('../auth');
var formDecode = require('../formDecode');
var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}
var path = require('path');

module.exports = async function(req, res, paths, searchParams) {
  let userID = auth.getUser(req);
  let serverID = BigInt(paths.shift());
  let channelID = BigInt(paths.shift());
  if (!serverID || !channelID) return 2;

  let server = await Servers.getServer(serverID);
  if (!server) throw 'cannot find server';
  try {
    await fs_p.lstat(path.join(__dirname, '../../database/data/channels', channelID + '.stupiddb'));
  } catch {
    throw 'cannot find channel';
  }
  let channel = new Channel(channelID);

  let isInServer = false;
  let m = server.members;
  for (let i = 0, l = m.length; !isInServer && i < l; i++) {
    let id = m.readBigUInt64LE(i);
    if (id === userID) isInServer;
  }
  if (!isInServer) throw 'you are not in the server';

  isInServer = false;
  m = server.channels;
  for (let i = 0, l = m.length; !isInServer && i < l; i++) {
    let id = m.readBigUInt64LE(i);
    if (id === channelID) isInServer;
  }
  if (!isInServer) throw 'channel is not in the server';

  if (req.method === 'GET') {
    let messageID = BigInt(paths.shift());
    let index;
    if (messageID) index = await channel.messages.findRow('id', messageID);
    else index = channel.messages.totalLength - channel.messages.cumSumT;
    if (index === -1) throw 'cannot find message';

    let messages = [];
    let len = channel.messages.cumSumT;
    for (let i = 0; i < 50; i++) {
      if (index < 0) break;
      let msg = await channel.messages.readRow(index);
      messages.push({ id: msg.id.toString(), author: msg.id.toString(), timestamp: msg.timestamp, content: msg.content, attachment: '/api/files/' + msg.attachmentID + msg, attachmentExt });
      index -= len;
    }

    return JSON.stringify(messages);
  } else {
    let form = await formDecode(req);
    if (!('json_payload' in form)) return 2;
    let data = JSON.parse(form.json_payload.data);
    if (!('content' in data)) return 2;
    if (data.content.length < 1 || data.content.length > 2000) throw 'message length bad';

    let attachment;
    let filename;
    if ('attachment' in form) {
      attachment = form.attachment.data;
      if ('filename' in form.attachment) filename = form.attachment.filename;
    }
    await channel.createMessage(userID, Date.now(), data.content, attachment, filename);
  }

  return 0;
};