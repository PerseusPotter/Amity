var nonce = require('./nonce');
var help = require('./api/help');

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

let handlers = {
  user: require('./api/user')
};
module.exports = async function(req, res, pathname, searchParams) {
  if (req.headers['content-length'] > 10485760) res.end();
  let paths = pathname.split('/').slice(2);

  let handler;
  if (paths.length > 0) handler = handlers[paths.shift()];
  if (!handler) handler = help;

  let returnVal = await handler(req, res, userID, paths, searchParams);

  if (returnVal === 0) res.writeHead(200);
  else if (returnVal === 1) res.writeHead(404);
  else if (returnVal === 2) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('malformed request');
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(returnVal);
  }
  res.end();
};

/*
list of apis

COOLDOWN

 - logout
 - signup
 - get current user data
 - set username
 - set password
 - change avatar
add friends
remove friends
 - set interests
 - delete account
get servers
get server name
get server icon
get server owner
get server interests
get server members
get server channels
set server name
set server icon
set server visibility
change server ownership
set server interests
join server
leave server
server invite
kick from server
add channel
rename channel
delete channel
send message
read message
(also for owner ↓)
edit message
delete message
download attachment
get related servers

*/