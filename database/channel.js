var Table = require('./db');

var snowflake = require('./snowflake');
var fs_p;
try {
  fs_p = require('fs/promises');
} catch {
  fs_p = require('fs').promises;
}

class Channel {
  constructor(id) {
    if (!id) id = snowflake(4);
    this.id = id;
    this.messages = new Table(`./data/channels/${this.id}.stupiddb`, [
      {
        name: 'id',
        type: 'uuid',
        length: 8
      },
      {
        name: 'author',
        type: 'uuid',
        length: 8
      },
      {
        name: 'timestamp',
        type: 'number',
        length: 4
      },
      {
        name: 'content',
        type: 'string',
        length: 2000
      },
      {
        name: 'attachment',
        type: 'uuid',
        length: 8
      }
    ]);
    this.messageCache = new WeakMap();
  }

  async createMessage(author, timestamp, content, attachment) {
    let messageID = snowflake(5);
    let attachmentID;
    if (attachment) {
      attachmentID = snowflake(6);
      // 8MB
      if (attachment.byteLength > 8388608) throw 'attachment to big';
      await fs_p.writeFile('./data/files/' + attachmentID + '.jpg', icon);
    } else attachmentID = 0n;

    let data = {
      id: messageID,
      author,
      timestamp,
      content,
      attachmentID
    };
    await this.messages.appendRow(data);

    return data;
  }

  async getMessage(id) {
    let i;
    if (this.messageCache.has(id)) i = this.messageCache.get(id);
    else {
      i = await this.messages.findRow('id', id);
      if (i === -1) return null;
      this.messageCache.set(id, i);
    }

    let data = await this.messages.readRow(i);

    return data;
  }

  async setMessage(data) {
    let i;
    if (this.messageCache.has(data.id)) i = this.messageCache.get(data.id);
    else {
      i = await this.messages.findRow('id', data.id);
      if (i === -1) throw 'cannot find message';
      this.messageCache.set(data.id, i);
    }

    await this.messages.writeRow(data, i);

    return data;
  }

  async deleteMessage(id) {
    let i;
    if (this.messageCache.has(id)) i = this.messageCache.get(id);
    else {
      i = await this.messages.findRow('id', id);
      if (i === -1) return null;
      this.messageCache.set(id, i);
    }

    let old = await this.getMessage(id);

    await this.messages.deleteRow(i);

    return old;
  }
}

module.exports = Channel;