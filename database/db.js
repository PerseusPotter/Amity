var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}

const parseValueDict = {
  string(buf, offset, len) {
    return buf.subarray(offset, len).toString();
  },
  number(buf, offset, len) {
    return buf.readUIntLE(offset, len);
  }
};
let parseValue = function(buf, offset, len, type) {
  return parseValueDict[type](buf, offset, len);
};
let getPromise = function() {
  return new Promise(resolve => {
    let p = new Promise(cb => {
      resolve({ promise: p, cb });
    });
  });
};
class Table {
  constructor(filename, dataTypes) {
    let prom = fs_p.open(filename, 'r+');
    prom.then(fh => this.fh = fh);
    this.fhP = prom;
    this.dataDescriptor = dataTypes;
    let types = Object.create(null);
    let lengths = Object.create(null);
    let cumSum = Object.create(null);
    let cumSumT = 0;
    dataTypes.forEach((v, i) => {
      types[v.name] = v.type;
      lengths[v.name] = v.length;
      if (i === 0) cumSum[v.name] = 0;
      else cumSum[v.name] = cumSum[dataTypes[i - 1].name] + dataTypes[i - 1].length;
      if (i === dataTypes.length - 1) cumSumT = cumSum[v.name] + v.length;
    });
    this.dataTypes = types;
    this.dataLengths = lengths;
    this.cumSum = cumSum;
    if (cumSumT > 4096) throw 'i dont want to do this';
    if (cumSum & (cumSum - 1)) {
      let powerOf2 = 1 << 32 - Math.clz32(cumSumT);
      this.dataDescriptor.push({ name: 'FILLER', length: powerOf2 - cumSumT, type: 'string' });
      this.dataTypes['FILLER'] = 'string';
      this.dataLengths['FILLER'] = powerOf2 - cumSumT;
      this.cumSum['FILLER'] = cumSumT;
      cumSumT = powerOf2;
    }
    this.cumSumT = cumSumT;
    this.readQueue = [];
    this.prevReadTime = Date.now();
  }

  async findRow(key, value) {
    if (!(key in this.cumSum)) return -1;

    let { promise, cb } = await getPromise();
    this.readQueue.push([this.cumSum[key], this.dataLengths[key], this.dataTypes[key], value, cb]);
    if (Date.now() - this.prevReadTime > 100) {
      let fh = this.fh;
      if (!this.fh) {
        await this.fhP;
        fh = this.fh;
      }
      const q = this.readQueue;
      const len = this.cumSumT;
      let buf = Buffer.allocUnsafe(4096);
      let index = 0;
      while (true) {
        let { bytesRead } = fh.read(buf, 0, len, index);
        if (bytesRead < len) return -1;

        let pos = 0;
        while (pos < 4096) {
          q.forEach((v, i) => {
            if (parseValue(buf, pos + v[0], v[1], v[2]) === v[3]) {
              v[4](index);
              q.splice(i, 1);
            }
          });
          pos += len;
        }
        index += 4096;
      }
    }

    return promise;
  }

  async readRow(index) {
    let fh = this.fh;
    if (!this.fh) {
      await this.fhP;
      fh = this.fh;
    }

    const len = this.cumSumT;
    let buf = Buffer.allocUnsafe(len);
    let { bytesRead } = fh.read(buf, 0, len, index);
    if (bytesRead < len) return null;

    let data = Object.create(null);
    const cumSum = this.cumSum;
    this.dataDescriptor.forEach(v => {
      data[v.name] = parseValue(buf, cumSum[v.name], v.length, v.type);
    });

    return data;
  }

  async writeRow(data, index) {
    let fh = this.fh;
    if (!this.fh) {
      await this.fhP;
      fh = this.fh;
    }

    const len = this.cumSumT;
    let buf = Buffer.allocUnsafe(len);

    const cumSum = this.cumSum;
    this.dataDescriptor.forEach(v => {
      if (v.type === 'string') {
        buf.write(data[v.name], cumSum[v.name], v.length);
      } else if (v.type === 'number') {
        buf.writeUIntLE(data[v.name], cumSum[v.name], v.length);
      }
    });

    await fh.write(buf, 0, len, index);
  }
}

module.exports = Table;