var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}

const parseValueDict = {
  string(buf, offset, len) {
    return buf.subarray(offset, offset + len).toString();
  },
  number(buf, offset, len) {
    return buf.readUIntLE(offset, len);
  },
  buffer(buf, offset, len) {
    return buf.subarray(offset, offset + len);
  },
  hex(buf, offset, len) {
    return buf.subarray(offset, offset + len).toString('hex');
  },
  uuid(buf, offset, len) {
    return buf.readBigUInt64LE(offset);
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
    this.totalLength = null;
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
    this.writeQueue = [];
    this.prevWriteTime = Date.now();
    this.isWriting = false;
  }

  async findRow(key, value) {
    if (!(key in this.cumSum)) return -1;

    let { promise, cb } = await getPromise();
    this.readQueue.push([this.cumSum[key], this.dataLengths[key], this.dataTypes[key], value, cb]);
    let t = Date.now();
    if (t - this.prevReadTime > 100) {
      this.prevReadTime = t;
      let fh = this.fh;
      if (!this.fh) {
        await this.fhP;
        fh = this.fh;
      }

      if (this.totalLength === null) this.totalLength = (await fh.stat()).size;

      const q = this.readQueue;
      const len = this.cumSumT;
      let buf = Buffer.allocUnsafe(4096);
      let index = totalLength;
      while ((index -= 4096) >= 0) {
        let { bytesRead } = fh.read(buf, 0, len, index);
        if (bytesRead < 4096) {
          q.forEach(v => v[4](-1));
          break;
        }

        let pos = 4096;
        while ((pos -= len) >= 0) {
          q.forEach((v, i) => {
            let val = parseValue(buf, pos + v[0], v[1], v[2]);
            if (val instanceof Buffer ? val.equals(v[3]) : val === v[3]) {
              v[4](index);
              q.splice(i, 1);
            }
          });
        }
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

  _getRowBuf(data) {
    let buf = Buffer.allocUnsafe(this.cumSumT);

    const cumSum = this.cumSum;
    this.dataDescriptor.forEach(v => {
      if (v.type === 'string') {
        buf.write(data[v.name], cumSum[v.name], v.length);
      } else if (v.type === 'number') {
        buf.writeUIntLE(data[v.name], cumSum[v.name], v.length);
      } else if (v.type === 'hex') {
        buf.write(data[v.name], cumSum[v.name], v.length, 'hex');
      } else if (v.type === 'uuid') {
        buf.writeBigUInt64BE(data[v.name], cumSum[v.name], v.length);
      } else {
        if (data[v.name] === null) buf.fill(0, cumSum[v.name], cumSum[v.name] + v.length);
        else {
          data[v.name].copy(buf, cumSum[v.name], 0, v.length);
          if (data[v.name].length < v.length) buf.fill(0, cumSum[v.name] + data[v.name].length, cumSum[v.name] + v.length);
        }
      }
    });

    return buf;
  }

  async writeRow(data, index) {
    let fh = this.fh;
    if (!this.fh) {
      await this.fhP;
      fh = this.fh;
    }

    if (this.totalLength === null) this.totalLength = (await fh.stat()).size;
    if (index >= this.totalLength) return false;

    let buf = this._getRowBuf(data);

    this.writeQueue.push([buf, index]);
    let t = Date.now();
    if (t - this.prevWriteTime > 100) await this._flushWrite();
    this.prevWriteTime = t;
  }

  async _flushWrite() {
    const q = this.writeQueue;
    if (this.isWriting || q.length === 0) return;
    this.isWriting = true;

    const len = this.cumSumT;
    let item;
    while ((item = q.pop()) !== undefined) {
      await fh.write(item[0], 0, len, item[1]);
    }

    this.isWriting = false;
  }

  async appendRow(data) {
    let fh = this.fh;
    if (!this.fh) {
      await this.fhP;
      fh = this.fh;
    }

    if (this.totalLength === null) this.totalLength = (await fh.stat()).size;

    let l = this.totalLength;
    this.totalLength += this.cumSumT;
    await this.writeRow(data, l);
  }

  async deleteRow(index) {
    let fh = this.fh;
    if (!this.fh) {
      await this.fhP;
      fh = this.fh;
    }

    if (this.totalLength === null) this.totalLength = (await fh.stat()).size;
    if (index >= this.totalLength) return false;

    let buf = Buffer.allocUnsafe(this.cumSumT).fill(0);

    this.writeQueue.push([buf, index]);
    let t = Date.now();
    if (t - this.prevWriteTime > 100) await this._flushWrite();
    this.prevWriteTime = t;
  }
}

module.exports = Table;