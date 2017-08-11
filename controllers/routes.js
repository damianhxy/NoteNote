var express = require("express");
var router = express.Router();
var passport = require("passport");
var user = require("../models/user.js");
var post = require("../models/post.js");
var auth = require("../middlewares/auth.js");
var notification = require("../middlewares/notification.js");
router.use(notification);

router.get("/", function(req, res) {
    if (req.user) {
        post.getStream(req.user.following, 0, 19)
        .then(function(posts) {
            res.render("homepage", {
                user: req.user,
                posts: posts
            });
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

/* Posts + Votes + Comments */
router.use("/posts", require("./posts.js"));

/* Signin / Signout */
router.get("/signout", auth, function(req, res) {
    req.logout();
    res.redirect("/");
});

router.post("/signin", function(req, res, next) {
    passport.authenticate("local-signin", function(err, user) {
        if (err) return next(err);
        if (!user)
            return res.status(400).redirect(req.headers.referer || "/");
        return req.login(user, function(err) {
            if (err) return next(err);
            res.redirect(req.headers.referer || "/");
        });
    })(req, res, next);
});

router.post("/signup", auth, function(req, res, next) {
    passport.authenticate("local-signup", function(err, user, info) {
        if (err) return next(err);
        req.login(user, function(err) {
            if (err) return next(err);
            res.redirect(req.headers.referer || "/");
        });
    })(req, res);
});

router.post("/signup", passport.authenticate("local-signup", {
    successRedirect: "/",
    failureRedirect: "/register"
}));

/* 404 & 500 */
router.use(function(req, res) {
    res.status(404).send("Page Not Found");
});

router.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

module.exports = router;
