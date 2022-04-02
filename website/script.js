window.addEventListener('load', () => {
  let cachedMessages = new CircularCache(100);
  let messageList = document.getElementById('messageList');
  let messageBox = document.getElementById('messageInput');
  let fileInput = document.getElementById('fileInput');
  let urlParams = new URLSearchParams(window.location.search);
  let currServerID = urlParams.get('serverID');
  // if (!currServerID) return void (window.location.href = '/chooseServer');
  let updating = false;
  let isFirstUpdate = true;
  let d = document.documentElement;
  let actualLastMessageID;
  let actualLastMessageTime;

  let error = (function() {
    let errorWrap = document.getElementById('errorWrap');
    let errors = Object.create(null);
    let createErr = function(key, message) {
      key = (key || 'default').toString();
      if (key in errors) return;
      let err = document.createElement('div');
      err.classList.add('error');
      err.innerText = message;
      errorWrap.append(err);
      errors[key] = err;
      err.delete = () => deleteErr(key);
      setTimeout(() => deleteErr(key), 5000);
      return err;
    };
    let deleteErr = function(key) {
      if (!key || !(key in errors)) return;
      errors[key].remove();
      delete errors[key];
    };
    createErr.delete = deleteErr;
    return createErr;
  }());

  window.addEventListener('error', err => {
    error(Date.now(), err.message);
  });

  let receivePing = (function() {
    let title = document.title;
    let pings = 0;
    window.addEventListener('focus', () => {
      if (pings > 0) {
        document.title = title;
        pings = 0;
      }
    });
    let pingSound = new Audio('/ping.mp3');
    return function() {
      if (document.hasFocus()) return;
      pings++;
      document.title = `${title} - ${pings} unread`;
      pingSound.play();
    };
  }());

  let update = function() {
    if (updating || !currServerID || isFirstUpdate) return;
    updating = true;
    getMessages(actualLastMessageID, 'after').then(msgs => {
      let i = msgs.length;
      while (i--) {
        let v = msgs[i];
        if (cachedMessages.has(v.id) || actualLastMessageTime > v.time) continue;
        receivePing();
      }
    }).finally(() => updating = false);
  };
  let createUpdateTimer = (function() {
    let timer;
    return function(len) {
      clearInterval(timer);
      timer = setInterval(update, len);
    };
  }());
  createUpdateTimer(500);
  window.addEventListener('focus', () => createUpdateTimer(500));
  window.addEventListener('blur', () => createUpdateTimer(2500));

  messageBox.contentEditable = 'true';
  messageBox.spellcheck = 'true';
  messageBox.setAttribute('autocorrect', 'off');

  messageBox.addEventListener('keydown', evn => {
    evn.stopPropagation();
    if (evn.key === 'Enter' && !evn.shiftKey) {
      evn.preventDefault();
      sendMessage();
    }
  });

  let sendMessage = async function() {
    if (!messageBox.textContent && !fileInput.files.length) return;
    let body = {};
    let files = [];
    if (fileInput.files.length) {
      for (let i = 0, l = fileInput.files.length; i < l; i++) {
        let file = fileInput.files[i];
        let base64 = await fileBase64(file);
        files.push({
          name: file.name,
          data: base64
        });
      }
    }
    body.serverID = currServerID;
    body.files = files;
    body.message = encodeURIComponent(messageBox.textContent);
    messageBox.textContent = '';
    await fetch('/api/sendMessage', { method: 'POST', body: JSON.stringify(body) }).catch(err => error('failSend', 'Message failed to send.'));
    update();
  };

  let getMessages = function(messageID, relativeTo) {
    return new Promise(resolve => {
      let body = {};
      body.serverID = currServerID;
      if (messageID) {
        body.messageID = messageID;
        body.relativeTo = relativeTo;
      }
      fetch('/api/getMessages', { method: 'POST', body: JSON.stringify(body) }).then(res => res.text()).then(txt => {
        let json;
        try {
          json = JSON.parse(txt);
        } catch {
          if (txt.length > 10) txt = txt.substring(0, 10) + '...';
          throw 'bad json: ' + txt + '\ntry refreshing';
        }
        return json;
      }).then(msgs => {
        error.delete('offline');
        msgs.forEach(v => {
          if (!actualLastMessageTime || actualLastMessageTime < v.time) {
            actualLastMessageTime = v.time;
            actualLastMessageID = v.id;
          }
        });
        resolve(msgs);
      }).catch(err => {
        error('offline', err);
        resolve([]);
      });
    });
  };

  let getMessagesTop = async function() {
    let cached = Array.from(cachedMessages.cache.values());
    let firstMessage = cached.reduce((a, v) => a.value.timestamp < v.value.timestamp ? a : v, cached[0]).value;

    let msgs = await getMessages(firstMessage.id, 'before');

    let curScrollPos = d.scrollTop;
    let oldScroll = d.scrollHeight - d.clientHeight;
    let i = -1;
    let l = msgs.length;
    while (++i < l) {
      let v = msgs[i];
      if (cachedMessages.has(v.id)) continue;
      let elem = createElem(v);
      messageList.prepend(elem);
      let item = messageItem(v, elem);
      cachedMessages.set(v.id, item);
    }
    let newScroll = d.scrollHeight - d.clientHeight;
    d.scrollTop = curScrollPos + (newScroll - oldScroll);
  };
  let getMessagesBottom = async function() {
    let lastMessageID;
    if (!isFirstUpdate) {
      let cached = Array.from(cachedMessages.cache.values());
      lastMessageID = cached.reduce((a, v) => a.value.timestamp > v.value.timestamp ? a : v, cached[0]).value.id;
    }
    let msgs = await getMessages(lastMessageID, 'after');
    let i = msgs.length;
    while (i--) {
      let v = msgs[i];
      if (cachedMessages.has(v.id)) continue;
      let elem = createElem(v);
      messageList.append(elem);
      let item = messageItem(v, elem);
      cachedMessages.set(v.id, item);
    }
    if (isFirstUpdate) window.scrollTo(0, document.body.scrollHeight);
    isFirstUpdate = false;
  };

  window.addEventListener('scroll', () => {
    if (d.scrollTop === 0) {
      getMessagesTop();
    } else if (d.scrollHeight - d.scrollTop === d.clientHeight) {
      getMessagesBottom();
    }
  });

  getMessagesBottom();
}, { once: true });