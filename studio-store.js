/* GRAPE TREE - tiny browser store for the cake studio files (print PNG, original upload...).
   Files are too big for the cart (localStorage), so they wait here until the order is placed. */
(function () {
    'use strict';
    var DB = 'gt-studio', ST = 'designs';
    function open() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) return reject(new Error('no storage'));
            var r = indexedDB.open(DB, 1);
            r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
            r.onsuccess = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error); };
        });
    }
    function run(mode, fn) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(ST, mode), out = fn(tx.objectStore(ST));
                tx.oncomplete = function () { resolve(out && out.result); db.close(); };
                tx.onerror = tx.onabort = function () { reject(tx.error); db.close(); };
            });
        });
    }
    window.GTStore = {
        put: function (id, v) { return run('readwrite', function (s) { return s.put(v, id); }); },
        get: function (id) { return run('readonly', function (s) { return s.get(id); }); },
        del: function (id) { return run('readwrite', function (s) { return s.delete(id); }); }
    };
})();
