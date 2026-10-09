const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const settings = require("../controllers/settings.js");

fs.mkdirSync(settings.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
  },
  destination: function (req, file, cb) {
    cb(null, settings.UPLOAD_DIR);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (
    settings.ALLOWED_EXTENSIONS.includes(ext) &&
    settings.ALLOWED_MIME_TYPES.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed. Accepted: " + settings.ALLOWED_EXTENSIONS.join(", ")));
  }
}

module.exports = multer({
  limits: {
    fields: 4,
    fileSize: settings.FILE_SIZE_LIMIT,
  },
  storage: storage,
  fileFilter: fileFilter,
});
