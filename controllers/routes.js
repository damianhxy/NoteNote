var express = require("express");
var router = express.Router();
var user = require("../models/user.js");
var post = require("../models/post.js");

router.get("/", function(req, res) {
    if (req.user) {
        res.render("homepage", {
            user: req.user
        });
    } else {
        res.render("landing", {
            layout: false
        });
    }
});

router.get("/register", function(req, res) {
    res.render("register", {
        layout: false
    });
});

router.get("/top", function(req, res) {
    post.top()
    .then(function(posts) {
        res.render("homepage", {
            user: req.user,
            posts: posts
        })
    });
});

router.get("/leaderboard", function(req, res) {
    user.all()
    .then(function(users) {
        res.render("leaderboard", {
            user: req.user,
            users: users
        });
    });
});

/* User */
router.use("/users", require("./users.js"));

/* Posts */
router.use("/posts", require("./posts.js"));

/* 404 & 500 */
router.use(function(req, res) {
    res.status(404).send("Page Not Found");
});

router.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

module.exports = router;
