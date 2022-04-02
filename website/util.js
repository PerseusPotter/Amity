let CircularCache;
let messageItem;
let createElemm;
let messageFormat;
let getRelativeTime;
let fileBase64;
(function() {
  // weakmaps ¯\_(ツ)_/¯
  let cacheItem = function(key, value) {
    let obj = Object.create(null);
    obj.key = key;
    obj.onExpire = value.onExpire || Function.prototype;
    obj.value = value;
    obj.next = undefined;
    return obj;
  };
  CircularCache = function(len) {
    if (!(this instanceof CircularCache)) return new CircularCache(len);
    this.cache = new Map();
    this.length = len;
    this.head;
    this.tail;

    this.has = function(key) {
      return this.cache.has(key);
    };
    this.get = function(key) {
      return this.cache.get(key).value;
    };
    this.set = function(key, value) {
      if (this.cache.has(key)) this.delete(key);
      else if (this.cache.size === len) {
        this.head.onExpire();
        this.cache.delete(this.head.key);
        this.head = this.head.next;
      }
      let item = cacheItem(key, value);
      this.cache.set(key, item);
      if (this.tail) this.tail.next = item;
      else this.head = item;
      this.tail = item;
    };
    this.delete = function(key) {
      if (this.cache.size === 0 || !this.cache.has(key)) return;
      if (this.cache.size === 1) {
        this.head = undefined;
        this.tail = undefined;
        this.cache.get(key).onExpire();
        this.cache.delete(key);
        return;
      }
      let prevItem;
      let item = this.head;
      do {
        if (item.key === key) break;
        prevItem = item;
      } while ((item = item.next) !== undefined);

      if (item === undefined) throw 'uhm, linked list broke (cache)';
      if (prevItem) {
        if (item.next) { // item.next might not exist if item is the last item in the list
          prevItem.next = item.next;
        } else {
          this.tail = prevItem;
          this.tail.next = undefined;
        }
      } else {
        // item is head
        this.head = this.head.next;
      }
      this.cache.get(key).onExpire();
      this.cache.delete(key);
    };
    this.clear = function() {
      this.cache.clear();
      this.head = undefined;
      this.tail = undefined;
    };

    return this;
  };
  messageItem = function(msg, elem) {
    let obj = Object.create(null);
    obj.id = msg.id;
    obj.content = msg.content;
    obj.authorName = msg.name;
    obj.avatarURL = msg.avatar;
    obj.timestamp = msg.time;
    obj.elem = elem;
    obj.onExpire = () => elem.remove();
    return obj;
  };
  createElem = function(msg) {
    let e = document.createElement('li');
    e.value = ~~(msg.time / 2048); // bc apparently it's 32 bits
    e.classList.add('message');

    let leftColumn;
    {
      leftColumn = document.createElement('div');
      leftColumn.classList.add('leftColumn');

      let image = document.createElement('img');
      image.src = msg.avatar;
      leftColumn.append(image);
    }

    let rightColumn;
    {
      rightColumn = document.createElement('div');
      rightColumn.classList.add('rightColumn');

      let username = document.createElement('span');
      username.innerText = msg.name + '\u200B';
      rightColumn.append(username);

      let timestamp = document.createElement('span');
      timestamp.innerText = getRelativeTime(new Date(msg.time));
      rightColumn.append(timestamp);

      let content = document.createElement('p');
      messageFormat(msg.content).forEach(v => content.append(v));
      rightColumn.append(content);
    }

    e.append(leftColumn);
    e.append(rightColumn);

    return e;
  };
  messageFormat = (function() {
    let formats;
    {
      let createReg = (start, end, flags = 'g') => new RegExp(`(?<!\\\\)(?<pad1>${start})(?<msg>.+?)(?<!\\\\)(?<pad2>${end || start})`, flags);
      let prepareTags = function(tags) {
        if (Array.isArray(tags[0])) throw 'first tag cannot be an array';
        let hasMsg = false;
        let recurse = function(t) {
          return t.map(v => {
            if (Array.isArray(v)) return recurse(v);
            if (typeof v === 'string' || v instanceof String) return { tag: v };
            if (v.msg) hasMsg = hasMsg || v.msg;
            return v;
          });
        };
        tags = recurse(tags);
        if (!hasMsg) {
          let last = tags;
          do {
            last = last[last.length - 1];
          } while (Array.isArray(last));
          last.msg = true;
        }
        return tags;
      };
      let createFormat = function(regex, tags, classList) {
        let obj = Object.create(null);
        obj.regex = regex;
        if (!Array.isArray(tags)) tags = [tags];
        tags = prepareTags(tags);
        obj.tags = tags;
        if (!classList) classList = [];
        else if (!Array.isArray(classList)) classList = [classList];
        obj.classList = classList;
        return obj;
      };
      let reg_bi = createReg('\\*\\*\\*');
      let reg_b = createReg('\\*\\*');
      let reg_i = createReg('\\*');
      let reg_strike = createReg('~~');
      let reg_und = createReg('__');
      let reg_code = createReg('```(?:\\n)?', '```', 'gs');
      let reg_inline = createReg('`');
      let reg_spoiler = createReg('\\|\\|');
      let reg_quote = createReg('^> ', '(?:\\n|$)', 'gm');

      let bi = createFormat(reg_bi, ['b', ['i']]);
      let b = createFormat(reg_b, 'b');
      let i = createFormat(reg_i, 'i');
      let strike = createFormat(reg_strike, 'del');
      let und = createFormat(reg_und, 'ins');
      let code = createFormat(reg_code, ['pre', ['code']], 'msgCode');
      let inline = createFormat(reg_inline, 'span', 'msgInline');
      let spoiler = createFormat(reg_spoiler, [
        'span',
        [
          'span'
        ]
      ], 'msgSpoiler');
      let quote = createFormat(reg_quote, [
        'div',
        [
          'div',
          'blockquote'
        ]
      ], 'msgQuote');

      formats = [bi, b, i, strike, und, code, inline, spoiler, quote];

      window.addEventListener('click', evn => {
        if (evn.target.classList.contains('msgSpoiler') && !evn.target.classList.contains('msgSpoilerClicked')) {
          evn.stopPropagation();
          evn.target.classList.add('msgSpoilerClicked');
        }
      });
    }
    let createElem = (function() {
      let create = function(tag, innerNodes) {
        let e = document.createElement(tag.tag);
        if (tag.attributes) {
          for (let [key, value] of Object.entries(tag.attributes)) {
            if (tag.attributes.hasOwnProperty(key)) {
              e[key] = value;
            }
          }
        }
        if (tag.msg) innerNodes.forEach(v => e.append(v));
        return e;
      };
      return function(tag, innerNodes) {
        let returnElem = create(tag.tags[0], innerNodes);
        let parentElem = returnElem;
        let lastElem = returnElem;
        let recurse = function(t) {
          if (Array.isArray(t)) {
            let oldParent = parentElem;
            parentElem = lastElem;
            t.forEach(recurse);
            parentElem = oldParent;
          } else {
            parentElem.append(lastElem = create(t, innerNodes));
          }
        };
        recurse(tag.tags.slice(1));
        tag.classList.forEach(v => returnElem.classList.add(v));
        return returnElem;
      };
    }());
    return function(msg) {
      let result = [];
      // let pos = 0;
      let pos = msg.length;
      let _msg = msg;
      let replace = function(format) {
        let _results = [];
        _msg.replace(format.regex, (match, pad1, group, pad2, offset) => {
          _results.push({
            startPos: offset,
            pad1End: offset + pad1.length,
            pad2Start: offset + pad1.length + group.length,
            endPos: offset + match.length,
            len: match.length,
            msg: group,
            tags: format.tags,
            classList: format.classList
          });
        });
        return _results;
      };
      while (true) {
        let matches = formats.map(replace).flat();
        // console.log('matches', matches);
        if (!matches.length) break;

        // let f = matches.sort((a, b) => a.startPos - b.startPos || b.endPos - a.endPos || b.pad1End - a.pad1End || b.pad2Start - a.pad2Start)[0];
        let f = matches.sort((a, b) => b.endPos - a.endPos || a.startPos - b.startPos || a.pad2Start - b.pad2Start || b.pad1End - a.pad1End)[0];

        // if (f.startPos > pos) result.push(document.createTextNode(msg.substring(pos, pos = f.startPos)));
        if (f.endPos < pos) result.unshift(document.createTextNode(msg.substring(f.endPos, pos)));

        let innerFormat = messageFormat(f.msg.trim());
        // console.log('inner', f.msg.trim(), innerFormat);
        // console.log('before', _msg);
        _msg = _msg.slice(0, f.startPos) + 'a'.repeat(f.len) + _msg.slice(f.endPos);
        // console.log('after', _msg);

        // result.push(createElem(f, innerFormat));
        result.unshift(createElem(f, innerFormat));
        // pos = f.endPos;
        pos = f.startPos
      }

      // if (pos < msg.length) result.push(document.createTextNode(msg.substring(pos)));
      if (pos > 0) result.unshift(document.createTextNode(msg.substring(0, pos)));
      return result;
    };
  }());
  let isSameDay = (d1, d2) => (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate());
  let timeStr = (t) => {
    let h = t.getHours();
    return `${h > 12 ? h - 12 : h}:${t.getMinutes().toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  let fullTimeStr = (t) => `${(t.getMonth() + 1).toString().padStart(2, '0')}/${t.getDate().toString().padStart(2, '0')}/${t.getFullYear()}`;
  getRelativeTime = function(t) {
    let d = new Date();
    let h = t.getHours() + 1;

    if (isSameDay(d, t)) return `Today at ${timeStr(t)}`;
    else {
      let yd = d.getTime() - (24 * 60 * 60 * 1000);
      yd = new Date(yd);
      if (isSameDay(yd, t)) return `Yesterday at ${timeStr(t)}`;
      else return fullTimeStr(t);
    }
  };
  fileBase64 = function(file) {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.addEventListener('loadend', () => {
        let base64 = reader.result.replace(/data:.*?\/.*?;base64,/, '');
        resolve(base64);
      }, { once: true });
      read.addEventListener('error', () => {
        reject(reader.error);
      }, { once: true });
      reader.readAsDataURL(file);
    });
  };
}());