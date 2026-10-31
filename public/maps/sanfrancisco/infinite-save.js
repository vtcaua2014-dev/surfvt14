"use strict";
// SurfVT14 force-save guard: applies the unlock before Unity starts and keeps
// every IDBFS save file synchronized for the entire session.
(function () {
  var DB_NAME = "/idbfs";
  var STORE = "FILE_DATA";
  var VERSION = 21;
  var SAVE_RE = /^\/idbfs\/([^/]+)\/Save\/(cloud|local|cloud_old|local_old)$/i;
  var installed = false;
  var runningPromise = null;
  var timer = null;

  function bytes() {
    var value = window.__SURFVT14_UNLOCK_BYTES;
    return value && value.length ? value : null;
  }
  function isSaveKey(key) {
    return typeof key === "string" && SAVE_RE.test(key);
  }
  function isSaveStore(store) {
    try { return store && store.name === STORE; } catch (e) { return false; }
  }
  function templateFor(key) {
    var templates = window.__SURFVT14_SAVE_TEMPLATES;
    return (templates && templates[key]) || bytes();
  }
  function forcedValue(previous, key) {
    var payload = templateFor(key);
    if (!payload || !payload.length) return previous;
    var out = previous && typeof previous === "object" ? Object.assign({}, previous) : {};
    out.timestamp = new Date();
    out.mode = 33206;
    out.contents = new Uint8Array(payload);
    return out;
  }
  function installGuard() {
    if (installed || !window.IDBObjectStore) return;
    var proto = IDBObjectStore.prototype;
    ["put", "add"].forEach(function (method) {
      var original = proto[method];
      if (typeof original !== "function") return;
      proto[method] = function (value, key) {
        try {
          if (isSaveStore(this) && isSaveKey(key)) value = forcedValue(value, key) || value;
        } catch (e) {}
        return original.call(this, value, key);
      };
    });
    var originalDelete = proto.delete;
    if (typeof originalDelete === "function") {
      proto.delete = function (key) {
        if (isSaveStore(this) && isSaveKey(key)) {
          // Unity's IDBFS cleanup must never remove a protected save.
          try { return this.get(key); } catch (e) { return originalDelete.call(this, key); }
        }
        return originalDelete.call(this, key);
      };
    }
    installed = true;
    window.__SURFVT14_INFINITE_SAVE_GUARD = true;
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      var request;
      try { request = indexedDB.open(DB_NAME, VERSION); } catch (e) { reject(e); return; }
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        var tx = event.target.transaction;
        var store = db.objectStoreNames.contains(STORE) ? tx.objectStore(STORE) : db.createObjectStore(STORE);
        if (!store.indexNames.contains("timestamp")) store.createIndex("timestamp", "timestamp", { unique: false });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IDBFS indisponível")); };
      request.onblocked = function () { reject(new Error("IDBFS bloqueado")); };
    });
  }
  function listSaveKeys(db) {
    return new Promise(function (resolve, reject) {
      var tx;
      try { tx = db.transaction([STORE], "readonly"); } catch (e) { reject(e); return; }
      var request = tx.objectStore(STORE).getAllKeys();
      request.onsuccess = function () { resolve(request.result.filter(isSaveKey)); };
      request.onerror = function () { reject(request.error || new Error("Falha ao listar saves")); };
    });
  }
  function writeSaveKeys(db, keys) {
    return new Promise(function (resolve, reject) {
      var tx;
      try { tx = db.transaction([STORE], "readwrite"); } catch (e) { reject(e); return; }
      var store = tx.objectStore(STORE);
      keys.forEach(function (key) {
        var value = forcedValue(null, key);
        if (value) store.put(value, key);
      });
      tx.oncomplete = function () { resolve(keys); };
      tx.onerror = function () { reject(tx.error || new Error("Falha ao gravar saves")); };
      tx.onabort = function () { reject(tx.error || new Error("Transação de save abortada")); };
    });
  }
  function refreshOnce() {
    installGuard();
    if (!bytes()) return Promise.resolve({ ready: false, reason: "unlock-not-loaded" });
    return openDb().then(function (db) {
      return listSaveKeys(db).then(function (keys) {
        if (!keys.length) { db.close(); return { ready: false, reason: "NO_SAVE" }; }
        return writeSaveKeys(db, keys).then(function (patched) {
          db.close();
          return { ready: true, persistent: true, bytes: bytes().length, hashes: patched.length, patched: patched };
        }, function (error) { db.close(); throw error; });
      }, function (error) { db.close(); throw error; });
    }).then(function (result) {
      window.__SURFVT14_LAST_UNLOCK = result;
      return result;
    }).catch(function (error) {
      var reason = error && error.code ? error.code : String(error);
      window.__SURFVT14_LAST_UNLOCK_ERROR = reason;
      return { ready: false, reason: reason };
    });
  }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }
  function forceApply() {
    installGuard();
    if (runningPromise) return runningPromise;
    runningPromise = (async function () {
      // Always run unlock first so the force-save uses the same current payload.
      if (window.__SURFVT14_SAVE_SOURCE !== "backup" && typeof window.applyUnlockAll === "function") {
        try { await window.applyUnlockAll(); } catch (e) { window.__SURFVT14_LAST_UNLOCK_ERROR = String(e); }
      }
      var result = { ready: false, reason: "not-ready" };
      // Unity may create IDBFS records a moment after the page opens.
      for (var attempt = 0; attempt < 20; attempt += 1) {
        result = await refreshOnce();
        if (result.ready) break;
        await wait(250);
      }
      window.__SURFVT14_LAST_UNLOCK = result;
      return result;
    })().finally(function () { runningPromise = null; });
    return runningPromise;
  }
  function schedule() {
    installGuard();
    if (!timer) timer = window.setInterval(function () { forceApply(); }, 700);
    return forceApply();
  }
  window.applyInfiniteSave = forceApply;
  window.forceSurfVT14Save = forceApply;
  window.scheduleInfiniteSaveRefresh = schedule;
  window.__SURFVT14_SAVE_READY_PROMISE = schedule();
  ["visibilitychange", "pageshow", "focus", "pointerdown", "touchstart", "keydown", "click"].forEach(function (name) {
    window.addEventListener(name, function () { forceApply(); }, { capture: true, passive: true });
  });
})();
