var express = require("express");
var router = express.Router();
var flash = require("express-flash");
var auth = require("../middlewares/auth.js");
var upload = require("../middlewares/upload.js");
var post = require("../models/post.js");

router.get("/upload", auth, function(req, res) {
    res.render("upload", {
        user: req.user
    });
});

router.get("/search", auth, function(req, res) {
    post.search(req.query.query)
    .then(function(posts) {
        res.render("homepage", {
            user: req.user,
            posts: posts
        });
    });
});

router.post("/upload", auth, function(req, res) {
    upload.single("file")(req, res, function(err) {
        if (err) {
            console.error(err.message);
            flash(err.message);
            res.status(400).redirect("/posts/upload");
        } else {
            post.add(req)
            .then(function() {
                flash("success", "Notes uploaded");
                res.redirect("/posts/upload");
            });
        }
    });
});

module.exports = router;
