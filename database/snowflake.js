let prevTime = 0n;
let prevCount = 0;

// id:
// 0: userID
// 1: avatarID
// 2: serverID
// 3: iconID
// 4: channelID
// 5: messageID
// 6: attachmentID
// 7: nonce
module.exports = function(id, thread = 0) {
  let t = Date.now();
  if (prevTime !== t) {
    prevTime = t;
    prevCount = 0n;
  }

  t = BigInt(t);
  let uuid = t << 32n;
  uuid |= BigInt((id & 0b111111) << 26);
  uuid |= BigInt((thread & 0b11111111111111) << 12);
  // istfg if prevCount exceeds 4095
  uuid |= prevCount;

  prevCount++;

  return uuid;
};