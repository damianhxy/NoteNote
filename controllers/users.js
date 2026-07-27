const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.js");
const { csrfValidate } = require("../middlewares/csrf.js");
const user = require("../models/user.js");
const post = require("../models/post.js");

router.get("/:profile", auth, async function (req, res) {
  try {
    const profileUser = await user.get(req.params.profile);
    if (!profileUser) {
      req.session.error = "User not found";
      return res.redirect("/");
    }
    const posts = await post.findByUser(req.params.profile);
    res.render("profile", {
      user: req.user,
      profileUser: profileUser,
      followerCount: profileUser.followers.length,
      followingCount: profileUser.following.length,
      posts: posts,
    });
  } catch (err) {
    console.error(err.message);
    req.session.error = err.message;
    res.redirect(req.headers.referer || "/");
  }
});

router.post("/follow/:target", auth, csrfValidate, async function (req, res) {
  try {
    const follower = req.user.username;
    const following = req.params.target;
    await user.addFollow(follower, following);
    res.end();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Follow failed" });
  }
});

module.exports = router;
