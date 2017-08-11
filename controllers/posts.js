var express = require("express");
var router = express.Router();
var auth = require("../middlewares/auth.js");
var upload = require("../middlewares/upload.js");
var post = require("../models/post.js");
var user = require("../models/user.js");

router.get("/upload", auth, function(req, res) {
    res.render("upload", {
        user: req.user
    });
});

router.post("/", auth, function(req, res) {
    upload.single("file")(req, res, function(err) {
        if (err) {
            req.session.error = err.message;
            res.status(400).redirect("/posts/upload");
        } else {
            post.add(req)
            .then(function(id) {
                res.redirect("/posts/" + id);
            });
        }
    });
});

/* Votes */
router.post("/vote/:id", auth, function(req, res) {
    post.vote(req.params.id, req.user.username, parseInt(req.body.val))
    .then(function([username, delta]) {
        return user.updateKarma(username, delta);
    })
    .then(function() {
        res.end();
    });
});

/* Comments */
router.post("/comment/:id", auth, function(req, res) {
    post.addComment(req.params.id, req.user.username, req.body.content)
    .then(function() {
        res.end();
    });
});

router.delete("/comment/:id/:index", auth, function(req, res) {
    post.deleteComment(req.params.id, req.params.index)
    .then(function() {
        res.end();
    });
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
            posts: ret ? [ret] : []
        });
    });
});

module.exports = router;
