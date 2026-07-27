const multer = require("multer");
const path = require("path");
const settings = require("../controllers/settings.js");

const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/");
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
