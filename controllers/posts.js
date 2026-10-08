const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const auth = require("../middlewares/auth.js");
const upload = require("../middlewares/upload.js");
const { csrfValidate, csrfValidateMultipart } = require("../middlewares/csrf.js");
const post = require("../models/post.js");
const user = require("../models/user.js");

router.get("/upload", auth, function (req, res) {
  res.render("upload", {
    user: req.user,
  });
});

router.post(
  "/",
  auth,
  function (req, res, next) {
    upload.single("file")(req, res, function (err) {
      if (err) {
        req.session.error = err.message;
        return res.status(400).redirect("/posts/upload");
      }
      next();
    });
  },
  csrfValidateMultipart,
  function (req, res) {
    if (!req.file) {
      req.session.error = "No file uploaded";
      return res.status(400).redirect("/posts/upload");
    }
    try {
      const id = post.add(req);
      res.redirect("/posts/" + id);
    } catch (uploadErr) {
      console.error(uploadErr.message);
      req.session.error = "Failed to upload post";
      res.status(500).redirect("/posts/upload");
    }
  },
);

/* Votes */
router.post("/vote/:id", auth, csrfValidate, async function (req, res) {
  try {
    const [username, delta] = await post.vote(
      req.params.id,
      req.user.username,
      parseInt(req.body.val),
    );
    await user.updateKarma(username, delta);
    res.end();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Vote failed" });
  }
});

/* Comments */
router.post(
  "/comment/:id",
  auth,
  csrfValidate,
  body("content").trim().isLength({ min: 1, max: 1000 }),
  async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid comment" });
    }
    try {
      await post.addComment(req.params.id, req.user.username, req.body.content);
      res.end();
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: "Failed to add comment" });
    }
  },
);

router.delete("/comment/:id/:index", auth, csrfValidate, async function (req, res) {
  try {
    await post.deleteComment(req.params.id, req.params.index);
    res.end();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

router.get("/search", auth, async function (req, res) {
  try {
    const posts = await post.search(req.query.query || "");
    res.render("homepage", {
      user: req.user,
      posts: posts,
    });
  } catch (err) {
    console.error(err.message);
    req.session.error = "Search failed";
    res.redirect("/");
  }
});

router.delete("/:id", auth, csrfValidate, async function (req, res) {
  try {
    await post.delete(req.params.id, req.user.username);
    res.end();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.get("/:id", auth, async function (req, res) {
  try {
    const ret = await post.get(req.params.id);
    res.render("homepage", {
      user: req.user,
      posts: ret ? [ret] : [],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
