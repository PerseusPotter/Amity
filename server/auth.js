let Users = require('../database/user');
var crypto = require('crypto');

var createCache = require('./cache');
const TOKEN_CACHE_LEN = 24 * 60 * 60 * 1000;
var tokens = createCache(TOKEN_CACHE_LEN);
var cookies = require('./cookies');

var _ws = require('ws');
var wsPort = 8080;
module.exports = {
  server() {
    var wss = new _ws.WebSocketServer({ port: wsPort });
    wss.on('connection', ws => {
      let timeout = setTimeout(ws.close, 10000);
      timeout.unref();

      let state = 0;
      let needMessage = true;
      let nonce;
      let user;
      ws.on('message', async data => {
        if (!needMessage) return;

        needMessage = false;
        switch (state) {
          case 0: {
            let bits = data.subarray(0, 8);
            let username = data.subarray(8).toString();
            if (username.length < 2) throw 'username too short';
            if (username.length > 32) throw 'username too long';
            user = Users.findUser(username);
            if (!user) throw 'user does not exist';
            let b = Buffer.allocUnsafe(4);
            b.writeUInt32LE(10000);
            let rand = crypto.randomBytes(8);
            nonce = Buffer.concat([bits, rand]);
            ws.send(Buffer.concat([user.salt, b, nonce]));
            break;
          }
          case 1: {
            if (data.length !== 32) throw 'hash is not 32 bytes long';

            let clientSign = crypto.createHmac('sha256', nonce);
            clientSign.update(user.clientKeyH);
            clientSign = clientSign.digest();

            let clientKey = Buffer.allocUnsafe(32);
            for (let i = 0; i < 32; i++) clientKey[i] = data[i] ^ clientSign[i];

            let clientKeyH = crypto.createHash('sha256');
            clientKeyH.update(clientKey);
            clientKeyH = clientKeyH.digest();

            if (!crypto.timingSafeEqual(clientKeyH, user.clientKeyH)) throw 'not authorized';

            let serverSign = crypto.createHmac('sha256', nonce);
            serverSign.update(user.serverKey);
            serverSign = serverSign.digest();

            // TODO: generate token
            let item = tokens.create();
            item.userID = user.id;
            ws.send(Buffer.concat([serverSign, item.uuid]));
            ws.close();
            break;
          }
        }
        state++;
        needMessage = true;
      });

      ws.on('error', err => {
        ws.write('error: ' + err.toString());
        ws.close();
      });
    });
  },
  getUser(req) {
    let authHead = req.headers.authorization || cookies.get(req, 'loginToken');
    if (!authHead) throw 'no authentication provided';

    authHead = authHead.split(' ');
    if (authHead.length <= 1 || authHead[0] !== 'Basic') throw 'malformed authentication';

    authHead = Buffer.from(authHead[1], 'base64');
    let [type, token] = authHead.toString().split(':');
    if (!(type && token) || type !== 'token') throw 'malformed authentication';

    if (!tokens.has(token)) throw 'invalid authentication';
    return tokens.get(token).userID;
  }
};