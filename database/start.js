let { mkdirSync, writeFileSync } = require('fs');

module.exports = function() {
  mkdirSync('./data', { recursive: true });
  mkdirSync('./data/avatar', { recursive: true });
  mkdirSync('./data/server', { recursive: true });
  writeFileSync('./data/users.stupiddb', '', 'a');
  writeFileSync('./data/servers.stupiddb', '', 'a');
};