var multer = require("multer");
var settings = require("../controllers/settings.js");

module.exports = multer({
    limits: {
        fields: 4,
        fileSize: settings.FILE_SIZE_LIMIT
    },
    storage: multer.diskStorage({
        filename: function(req, file, cb) {
            cb(null, Date.now() + file.originalname);
        },
        destination: function(req, file, cb) {
            cb(null, "./public/uploads/");
        }
    })
});
