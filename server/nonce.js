var snowflake = require('../database/snowflake');
var createCache = require('./cache');

var nonces = createCache(60 * 1000);
module.exports = {
  create() {
    let uuid = snowflake(7);
    nonces.create(uuid);
    return uuid;
  },
  has(uuid) {
    return nonces.has(uuid);
  }
};