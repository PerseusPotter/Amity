let { mkdirSync, writeFileSync } = require('fs');

module.exports = function() {
  mkdirSync('./data', { recursive: true });
  mkdirSync('./data/avatar', { recursive: true });
  mkdirSync('./data/channel', { recursive: true });
  writeFileSync('./data/users.stupiddb', '', 'a');
  writeFileSync('./data/avatars.stupiddb', '', 'a');
  writeFileSync('./data/channels.stupiddb', '', 'a');
};