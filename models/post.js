const path = require("path");
const crypto = require("crypto");
const { formatInTimeZone } = require("date-fns-tz");
const db = require("../database/index.js");
const settings = require("../controllers/settings.js");

db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        _id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        description TEXT DEFAULT '',
        date TEXT NOT NULL,
        datePretty TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        karma INTEGER DEFAULT 0,
        upvotes TEXT DEFAULT '[]',
        downvotes TEXT DEFAULT '[]',
        comments TEXT DEFAULT '[]'
    )
`);

const insertStmt = db.prepare(
  "INSERT INTO posts (_id, username, name, path, description, date, datePretty, tags, karma, upvotes, downvotes, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const findByIdStmt = db.prepare("SELECT * FROM posts WHERE _id = ?");
const findByUserStmt = db.prepare("SELECT * FROM posts WHERE username = ? ORDER BY date DESC");
const deleteStmt = db.prepare("DELETE FROM posts WHERE _id = ?");
const updateStmt = db.prepare(
  "UPDATE posts SET karma = ?, upvotes = ?, downvotes = ?, comments = ? WHERE _id = ?",
);
const topStmt = db.prepare("SELECT * FROM posts ORDER BY karma DESC LIMIT 20");
const searchTagsStmt = db.prepare("SELECT * FROM posts WHERE tags LIKE ?");
const searchDescStmt = db.prepare("SELECT * FROM posts WHERE description LIKE ?");

function getStreamStmt(following) {
  const placeholders = following.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM posts WHERE username IN (${placeholders}) ORDER BY date DESC`);
}

function formatDate(date) {
  return formatInTimeZone(date || new Date(), "Asia/Singapore", "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function formatDatePretty(date) {
  return formatInTimeZone(date || new Date(), "Asia/Singapore", settings.POST_TIME_FORMAT);
}

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

function deserializePost(row) {
  if (!row) return null;
  return {
    _id: row._id,
    username: row.username,
    name: row.name,
    path: row.path,
    description: row.description,
    date: row.date,
    datePretty: row.datePretty,
    tags: parseJsonArray(row.tags),
    karma: row.karma,
    upvotes: parseJsonArray(row.upvotes),
    downvotes: parseJsonArray(row.downvotes),
    comments: parseJsonArray(row.comments).map((c) => ({
      username: c.username,
      content: c.content,
      date: c.date,
      datePretty: c.datePretty,
    })),
  };
}

exports.add = function (req) {
  const tags = req.body.tags
    ? req.body.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : ["untagged"];
  const id = generateId();
  insertStmt.run(
    id,
    req.user.username,
    req.body.name,
    req.file.path.slice(6),
    req.body.text || "",
    formatDate(),
    formatDatePretty(),
    JSON.stringify(tags),
    0,
    "[]",
    "[]",
    "[]",
  );
  return id;
};

exports.search = function (search) {
  const pattern = "%" + search.replace(/%/g, "\\%") + "%";
  const byTags = searchTagsStmt.all(pattern);
  const byDesc = searchDescStmt.all(pattern);
  const seen = new Set();
  const results = [];
  for (const post of [...byTags, ...byDesc]) {
    if (!seen.has(post._id)) {
      seen.add(post._id);
      results.push(post);
    }
  }
  return results.map(deserializePost);
};

exports.findByUser = function (username) {
  return findByUserStmt.all(username).map(deserializePost);
};

exports.get = function (ID) {
  const post = findByIdStmt.get(ID);
  return post ? deserializePost(post) : null;
};

exports.delete = function (ID, username) {
  const post = findByIdStmt.get(ID);
  if (!post) throw Error("Post not found");
  if (post.username !== username) throw Error("Unauthorised");
  const fs = require("fs").promises;
  fs.unlink(path.join("public", post.path)).catch(() => {});
  deleteStmt.run(ID);
};

exports.vote = function (ID, username, value) {
  const post = findByIdStmt.get(ID);
  if (!post) throw Error("Post not found");

  const upvotes = parseJsonArray(post.upvotes);
  const downvotes = parseJsonArray(post.downvotes);

  let oldValue = 0;
  const upIdx = upvotes.indexOf(username);
  const downIdx = downvotes.indexOf(username);

  if (upIdx !== -1) {
    upvotes.splice(upIdx, 1);
    oldValue = 1;
  } else if (downIdx !== -1) {
    downvotes.splice(downIdx, 1);
    oldValue = -1;
  }

  if (value === 1) {
    upvotes.push(username);
  } else if (value === -1) {
    downvotes.push(username);
  }

  const newKarma = post.karma + (value - oldValue);
  updateStmt.run(newKarma, JSON.stringify(upvotes), JSON.stringify(downvotes), post.comments);
  return [post.username, value - oldValue];
};

exports.addComment = function (id, username, content) {
  const post = findByIdStmt.get(id);
  if (!post) throw Error("Post not found");

  const comments = parseJsonArray(post.comments);
  comments.push({
    username: username,
    content: content,
    date: formatDate(),
    datePretty: formatDatePretty(),
  });
  updateStmt.run(post.karma, post.upvotes, post.downvotes, JSON.stringify(comments));
};

exports.deleteComment = function (id, index) {
  const post = findByIdStmt.get(id);
  if (!post) throw Error("Post not found");

  const comments = parseJsonArray(post.comments);
  comments.splice(parseInt(index, 10), 1);
  updateStmt.run(post.karma, post.upvotes, post.downvotes, JSON.stringify(comments));
};

exports.getStream = function (following, start, end) {
  if (!following || following.length === 0) return [];
  const stmt = getStreamStmt(following);
  return stmt
    .all(...following)
    .slice(start, end - start + 1)
    .map(deserializePost);
};

exports.top = function () {
  return topStmt.all().map(deserializePost);
};
