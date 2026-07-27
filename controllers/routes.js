const express = require("express");
const router = express.Router();
const passport = require("passport");
const user = require("../models/user.js");
const post = require("../models/post.js");
const auth = require("../middlewares/auth.js");
const notification = require("../middlewares/notification.js");
const { csrfValidate } = require("../middlewares/csrf.js");

router.use(notification);

router.get("/", async function (req, res) {
  try {
    if (req.user) {
      const posts = await post.getStream(req.user.following, 0, 19);
      res.render("homepage", {
        user: req.user,
        posts: posts,
      });
    } else {
      res.render("landing", {
        layout: false,
      });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/register", function (req, res) {
  res.render("register", {
    layout: false,
  });
});

router.get("/top", async function (req, res) {
  try {
    const posts = await post.top();
    res.render("homepage", {
      user: req.user,
      posts: posts,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/leaderboard", async function (req, res) {
  try {
    const users = await user.all();
    res.render("leaderboard", {
      user: req.user,
      users: users,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

/* User */
router.use("/users", require("./users.js"));

/* Posts + Votes + Comments */
router.use("/posts", require("./posts.js"));

/* Signin / Signout */
router.get("/signout", auth, function (req, res) {
  req.logout(function (err) {
    if (err) console.error(err.message);
    res.redirect("/");
  });
});

router.post("/signin", csrfValidate, function (req, res, next) {
  passport.authenticate("local-signin", function (authErr, authUser) {
    if (authErr) return next(authErr);
    if (!authUser) return res.status(400).redirect(req.headers.referer || "/");
    return req.login(authUser, function (loginErr) {
      if (loginErr) return next(loginErr);
      res.redirect(req.headers.referer || "/");
    });
  })(req, res, next);
});

router.post("/signup", csrfValidate, function (req, res, next) {
  passport.authenticate("local-signup", function (signupErr, signupUser) {
    if (signupErr) return next(signupErr);
    if (!signupUser) {
      req.session.error = req.session.error || "Registration failed";
      return res.redirect("/register");
    }
    req.login(signupUser, function (loginErr) {
      if (loginErr) return next(loginErr);
      res.redirect(req.headers.referer || "/");
    });
  })(req, res, next);
});

/* 404 & 500 */
router.use(function (req, res) {
  res.status(404).send("Page Not Found");
});

router.use(function (err, req, res, _next) {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

module.exports = router;
