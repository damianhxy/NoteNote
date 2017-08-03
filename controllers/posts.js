var express = require("express");
var router = express.Router();
var auth = require("../middlewares/auth.js");
var upload = require("../middlewares/upload.js");
var post = require("../models/post.js");

router.get("/upload", auth, function(req, res) {
    res.render("upload", {
        user: req.user
    });
});

router.post("/upload", auth, function(req, res) {
    upload.single("file")(req, res, function(err) {
        if (err) {
            console.error(err.message);
            req.flash(err.message);
            res.status(400).redirect("/posts/upload");
        } else {
            post.add(req)
            .then(function() {
                req.flash("success", "Notes uploaded");
                res.redirect("/posts/upload");
            });
        }
    });
});

router.post("/vote/:id", auth, function(req, res) {
    var nval = req.body.val;
    // WIP
});

router.delete("/:id", auth, function(req, res) {
    post.delete(req.params.id, req.user.username)
    .then(function() {
        res.end();
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

router.get("/:id", auth, function(req, res) {
    post.get(req.params.id)
    .then(function(ret) {
        res.render("homepage", {
            user: req.user,
            posts: [ret]
        });
    });
});

module.exports = router;
