const crypto = require("crypto");
const bcryptjs = require("bcryptjs");
const db = require("../database/index.js");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        _id TEXT PRIMARY KEY,
        name TEXT DEFAULT '',
        username TEXT UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        karma INTEGER DEFAULT 0,
        followers TEXT DEFAULT '[]',
        following TEXT DEFAULT '[]',
        admin INTEGER DEFAULT 0
    )
`);

const insertStmt = db.prepare(
  "INSERT INTO users (_id, name, username, hash, karma, followers, following, admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
);
const findByUsernameStmt = db.prepare("SELECT * FROM users WHERE username = ?");
const findByIdStmt = db.prepare("SELECT * FROM users WHERE _id = ?");
const updateFollowingStmt = db.prepare("UPDATE users SET following = ? WHERE username = ?");
const updateFollowersStmt = db.prepare("UPDATE users SET followers = ? WHERE username = ?");
const updateKarmaStmt = db.prepare("UPDATE users SET karma = ? WHERE username = ?");
const allUsersStmt = db.prepare("SELECT * FROM users ORDER BY karma DESC, username ASC");

function generateId() {
  return crypto.randomUUID();
}

function parseJsonArray(str) {
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

function deserializeUser(row) {
  if (!row) return null;
  return {
    _id: row._id,
    name: row.name,
    username: row.username,
    hash: row.hash,
    karma: row.karma,
    followers: parseJsonArray(row.followers),
    following: parseJsonArray(row.following),
    admin: !!row.admin,
  };
}

exports.add = async function (body, username, password) {
  const existing = findByUsernameStmt.get(username);
  if (existing) throw Error("User already exists");
  if (password !== body.password2) throw Error("Password mismatch");
  if (!username || username.length < 3) throw Error("Username must be at least 3 characters");
  if (!password || password.length < 6) throw Error("Password must be at least 6 characters");
  const hash = await bcryptjs.hash(password, 10);
  const id = generateId();
  insertStmt.run(id, body.name || "", username, hash, 0, "[]", "[]", 0);
  return {
    _id: id,
    username: username,
    name: body.name || "",
    karma: 0,
    followers: [],
    following: [],
    admin: false,
  };
};

exports.authenticate = async function (username, password) {
  const row = findByUsernameStmt.get(username);
  if (!row) throw Error("User does not exist");
  const res = await bcryptjs.compare(password, row.hash);
  if (!res) throw Error("Wrong password");
  return deserializeUser(row);
};

exports.addFollow = async function (follower, following) {
  if (follower === following) throw Error("Cannot follow yourself");

  const followerRow = findByUsernameStmt.get(follower);
  if (!followerRow) throw Error("User does not exist");

  const followingList = parseJsonArray(followerRow.following);
  const idx = followingList.indexOf(following);
  if (idx === -1) {
    followingList.push(following);
  } else {
    followingList.splice(idx, 1);
  }
  updateFollowingStmt.run(JSON.stringify(followingList), follower);

  const followingRow = findByUsernameStmt.get(following);
  if (!followingRow) throw Error("Target user does not exist");

  const followersList = parseJsonArray(followingRow.followers);
  const fIdx = followersList.indexOf(follower);
  if (fIdx === -1) {
    followersList.push(follower);
  } else {
    followersList.splice(fIdx, 1);
  }
  updateFollowersStmt.run(JSON.stringify(followersList), following);
};

exports.updateKarma = async function (username, delta) {
  const row = findByUsernameStmt.get(username);
  if (!row) throw Error("User not found");
  updateKarmaStmt.run(row.karma + delta, username);
};

exports.get = function (username) {
  const row = findByUsernameStmt.get(username);
  return row ? deserializeUser(row) : null;
};

exports.getByID = function (ID) {
  const row = findByIdStmt.get(ID);
  if (!row) throw Error("User does not exist");
  return deserializeUser(row);
};

exports.all = function () {
  return allUsersStmt.all().map(deserializeUser);
};
