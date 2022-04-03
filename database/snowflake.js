let prevTime = 0n;
let prevCount = 0;

module.exports = function(id) {
  let t = Date.now();
  if (prevTime !== t) {
    prevTime = t;
    prevCount = 0n;
  }

  t = BigInt(t);
  let uuid = t << 18n;
  uuid |= BigInt((id & 0b111111) << 12);
  // istfg if prevCount exceeds 4095
  uuid |= prevCount;

  prevCount++;

  return uuid;
};