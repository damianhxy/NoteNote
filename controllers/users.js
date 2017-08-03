var express = require("express");
var passport = require("passport");
var router = express.Router();
var auth = require("../middlewares/auth.js");
var user = require("../models/user.js");
var post = require("../models/post.js");

router.get("/:profile", auth, function(req, res) {
    user.get(req.params.profile)
    .then(function(ret) {
        post.findByUser(req.params.profile)
        .then(function(posts) {
            res.render("profile", {
                user: req.user,
                profileUser: ret,
                followerCount: ret.followers.length,
                followingCount: ret.following.length,
                posts: posts
            });
        });
    })
    .catch(function(err) {
        console.error(err.message);
        req.flash("error", err.message);
        res.redirect(req.header.referrer || "/");
    });
});

router.post("/follow/:target", auth, function(req, res) {
    // Increment / Decrement both people
    var follower = req.user.username;
    var following = req.params.target;
    user.addFollow(follower, following)
    .then(function() {
        res.end();
    });
});

module.exports = router;
