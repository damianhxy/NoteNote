const EventEmitter = require("events");
const db = require("./index.js");

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires INTEGER NOT NULL
    )
`);

const getStmt = db.prepare("SELECT sess, expires FROM sessions WHERE sid = ?");
const setStmt = db.prepare("INSERT OR REPLACE INTO sessions (sid, sess, expires) VALUES (?, ?, ?)");
const destroyStmt = db.prepare("DELETE FROM sessions WHERE sid = ?");
const cleanupStmt = db.prepare("DELETE FROM sessions WHERE expires < ?");

const CLEANUP_INTERVAL = 3600000;

class SQLiteSessionStore extends EventEmitter {
  constructor() {
    super();
    this._cleanupInterval = setInterval(() => {
      cleanupStmt.run(Date.now());
    }, CLEANUP_INTERVAL);
    process.nextTick(() => this.emit("connect"));
  }

  get(sid, callback) {
    try {
      const row = getStmt.get(sid);
      if (!row) return callback(null, null);
      if (row.expires < Date.now()) {
        destroyStmt.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 86400000;
      const expires = Date.now() + maxAge;
      setStmt.run(sid, JSON.stringify(session), expires);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      destroyStmt.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 86400000;
      const expires = Date.now() + maxAge;
      setStmt.run(sid, JSON.stringify(session), expires);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  close() {
    clearInterval(this._cleanupInterval);
  }
}

module.exports = SQLiteSessionStore;
