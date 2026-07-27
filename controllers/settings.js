require("dotenv").config();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("FATAL: SESSION_SECRET must be set in .env (min 32 chars)");
  process.exit(1);
}

exports.PORT = process.env.PORT || 8080;
exports.SECRET = process.env.SESSION_SECRET;
exports.TIME_FORMAT = "dd MMM HH:mm:ss";
exports.POST_TIME_FORMAT = "d MMM yy | HH:mm";
exports.FILE_SIZE_LIMIT = 25 * 1024 * 1024;
exports.ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];
exports.TIMEZONE = "Asia/Singapore";
exports.ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".zip",
  ".rar",
  ".7z",
];
