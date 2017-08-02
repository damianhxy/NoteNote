var express = require("express");
var passport = require("passport");
var router = express.Router();
var auth = require("../middlewares/auth.js");
var user = require("../models/user.js");
var post = require("../models/post.js");
var flash = require("express-flash");

router.get("/signout", auth, function(req, res) {
    req.logout();
    res.redirect("/");
});

router.post("/signin", passport.authenticate("local-signin", {
    successRedirect: "/",
    failureRedirect: "/"
}));

router.post("/signup", passport.authenticate("local-signup", {
    successRedirect: "/",
    failureRedirect: "/"
}));

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
        flash("error", err.message);
        res.redirect(req.header.referrer || "/");
    });
});

router.post("/follow", auth, function(req, res) {
    // Increment / Decrement both people
});

module.exports = router;
