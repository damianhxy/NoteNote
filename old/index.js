var exphbs = require("express-handlebars");
var express = require("express");
var moment = require("./public/lib/js/moment.js");
var morgan = require("morgan");
var passport = require("passport");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var methodOverride = require("method-override");
var session = require("express-session");
var LocalStrategy = require("passport-local");
var func = require("./functions.js");
var multer = require("multer");
var fs = require("fs");
var latest;


// Routes
app.get("/", function(req, res, next) {
    if (req.user) {
        func.getFollowing(req.user.username)
        .then(function(mask) {
            return func.filterPosts(req.user.username, 0, mask);
        })
        .then(function(posts) {
            posts.map(function(e) {
                e.date = moment(e.date).format("DD MMMM YYYY, h:mm:ss a");
                e.comments.forEach(function(f) {
                    f.date = moment(f.date).format("DD MMMM YYYY, h:mm:ss a");
                });
            });
            res.render("homepage", {
                user: req.user,
                posts: posts
            })
        })
        .fail(function(err) {
            next(err);
        });
    } else
        res.render("landing", {
            layout: false
        });
});

app.get("/register", function(req, res, next) {
    if (req.user) {
        func.getFollowing(req.user.username)
        .then(function(mask) {
            res.redirect("/");
        })
        .fail(function(err) {
            next(err);
        });
    } else
        res.render("register", {
            layout: false
        });
});

app.post("/signin", passport.authenticate("local-signin", {
    successRedirect: "/",
    failureRedirect: "/"
}));

app.post("/signup", passport.authenticate("local-signup", {
    successRedirect: "/",
    failureRedirect: "/register"
}));

app.use(function(req, res, next) {
    if (!req.user) {
        req.session.error = "Please log in first";
        res.redirect("/");
    } else next();
});

app.post("/", function(req, res, next) {
    func.getFollowing(req.user.username)
    .then(function(mask) {
        return func.filterPosts(req.user.username, req.body.offset, mask);
    })
    .then(function(posts) {
        res.send(posts);
    })
    .fail(function() {
        res.status(400).send("Loading Failed");
    });s
});

app.post("/addpost", function(req, res, next) {
    if (latest && !latest.truncated)
        func.getPostCount()
        .then(function(count) {
            req.body.tags = (req.body.tags || "untagged").split(",");
            if (req.body.tags)
                req.body.tags.map(function(e) {
                    e = e.toLowerCase();
                });
            return func.addPost({
                "path": latest.path.slice(6),
                "filename": latest.name,
                "original": latest.originalname,
                "extension": latest.extension,
                "tags": req.body.tags,
                "user": req.user.username,
                "date": moment().format(),
                "hidden": false,
                "comments": [],
                "votes": {
                    "-1": [],
                    "1": []
                },
                "karma": 0,
                "id": count + 1,
                "text": req.body.text,
                "icon": req.user.icon
            });
        })
        .then(function() {
            res.redirect("/");
        })
        .fail(function(err) {
            console.log("Failed to make post: " + err);
            res.send("Failed to make post");
        });
    else if (latest && latest.truncated)
        res.status(400).send("File size limit exceeded");
    else
        res.status(400).send("File upload failed");
});

app.post("/deletepost", function(req, res, next) {
    var scope = {};
    func.getPostByID(parseInt(req.body.postID))
    .then(function(post) {
        scope.post = post;
        if (req.user.username === post.user)
            return func.deletePost(parseInt(req.body.postID));
        else
            res.status(400).send("Not Owner");
    })
    .then(function() {
        fs.unlink("./public" + scope.post.path, function(err) {
            if (err) throw err;
            else return func.updateKarma(req.user.username, -scope.post.karma);
        });
    })
    .then(function() {
        res.send("Delete Success");
    })
    .fail(function(err) {
        console.log("Failed to delete post: " + err);
        res.status(400).send("Failed to delete post");
    });
});

app.get("/posts/:id", function(req, res, next) {
    func.getPostByID(parseInt(req.params.id))
    .then(function(post) {
        post.date = moment(post.date).format("DD MMMM YYYY, h:mm:ss a");
        post.comments.forEach(function(e) {
            e.date = moment(e.date).format("DD MMMM YYYY, h:mm:ss a");
        });
        res.render("homepage", {
            user: req.user,
            posts: [post]
        });
    })
    .fail(function(err) {
        if (err === "NOT FOUND")
            next();
        else
            next(err);
    });
});

app.post("/addcomment", function(req, res, next) {
    func.commentCount(parseInt(req.body.postID))
    .then(function(count) {
        return func.addComment(parseInt(req.body.postID), req.user.username,
        {
            "user": req.user.username,
            "date": Date.now(),
            "text": req.body.comment,
            "icon": req.user.icon,
            "hidden": false,
            "id": count + 1
        });
    })
    .then(function(obj) {
		res.send(obj);
    })
    .fail(function(err) {
        console.log("Failed to add comment: " + err);
        res.status(400).send("Failed to add comment");
    });
});

app.post("/deletecomment", function(req, res, next) {
    func.deletecomment(req.body.postID, req.user.username, req.body.commentID)
    .fail(function(err) {
        console.log("Failed to delete comment: " + err);
        res.status(400).send("Failed to delete comment");
    });
});

app.post("/follow", function(req, res, next) {
    func.userExists(req.user.username)
    .then(func.userExists(req.body.userID))
    .then(func.toggleFollow(req.user.username, req.body.userID))
    .then(func.toggleFollowed(req.body.userID, req.user.username))
    .then(function(){
		res.send("Success");
	})
    .fail(function(err) {
        console.log("Could not toggle follow: " + err);
        res.status(400).send("Failed to toggle follow");
    });
});

app.get("/profile/:userID", function(req, res, next) {
    var scope = {};
    func.getUserPosts(req.params.userID, 0)
    .then(function(posts) {
        posts.map(function(e) {
            e.date = moment(e.date).format("DD MMMM YYYY, h:mm:ss a");
            e.comments.forEach(function(f) {
                f.date = moment(f.date).format("DD MMMM YYYY, h:mm:ss a");
            });
        });
        scope.posts = posts;
        return func.getFollowed(req.params.userID);
    })
    .then(function(followers) {
		scope.followers = followers;
        return func.getFollowing(req.params.userID);
	})
    .then(function(followees) {
        scope.followees = followees;
        return func.getUserByID(req.params.userID);
    })
    .then(function(theuser) {
        res.render("profile", {
            user: req.user,
            theuser: theuser,
            posts: scope.posts,
            isFollower: !! ~ scope.followers.indexOf(req.user.username),
            followerCount: scope.followers.length,
            followeeCount: scope.followees.length - 1
        });
    })
    .fail(function(err) {
        if (err === "NOT FOUND")
            next();
        else
            next(err);
    });
});

app.post("/profile", function(req, res, next) { // Returns (bool)follows, follower count, posts
    func.getUserPosts(req.body.userID, req.body.offset)
    .then(function(posts) {
        res.send(posts);
    })
    .fail(function(err) {
        console.log("Could not load profile posts: " + err);
        res.status(400).send("Failed to load profile posts");
    });
}); // Render Profile

app.post("/vote", function(req, res, next) {
    func.vote(parseInt(req.body.postID), req.user.username, req.body.value)
    .then(function(obj) {
        return func.updateKarma(obj.user, obj.diff);
    })
    .then(function() {
        res.send("SUCCESS");
    })
    .fail(function(err) {
        res.status(400).send("Failed to register vote");
    });
});

app.get("/users", function(req, res, next) {
    func.getUsers()
    .then(function(users) {
        res.render("userlist", {
            user: req.user,
            users: users
        });
    })
    .fail(function(err) {
        next(err);
    });
});

app.get("/leaderboard", function(req, res, next) {
    func.leaderboard()
    .then(function(users) {
        users[0]["rank"] = 1;
        for (var a = 1; a < users.length; ++a)
            if (users[a].karma === users[a - 1].karma)
                users[a]["rank"] = users[a - 1]["rank"];
            else users[a]["rank"] = users[a - 1]["rank"] + 1;
        res.render("leaderboard", {
            user: req.user,
            users: users
        });
    })
    .fail(function(err) {
        next(err);
    });
});

app.get("/add", function(req, res, next) {
	res.render("add", {
		user: req.user
	});
});

app.get("/search", function(req, res, next) {
    func.searchTags(req.query.query.toLowerCase(), 0)
    .then(function(posts) {
        posts.map(function(e) {
            e.date = moment(e.date).format("DD MMMM YYYY, h:mm:ss a");
            e.comments.forEach(function(f) {
                f.date = moment(f.date).format("DD MMMM YYYY, h:mm:ss a");
            });
        });
        res.render("homepage", {
			user: req.user,
			posts: posts
		});
    })
    .fail(function(err) {
        console.log("Failed to load search page");
        res.status(400).send("Failed to load search page");
    });
}); // Render tags search

app.get("/logout", function(req, res, next) {
    func.removeUser(req.user.username)
    .then(function() {
        console.log("Logged out " + req.user.username);
        req.logout();
        res.redirect("/");
    })
    .fail(function(err) {
        console.log("Sign out failed: " + err);
        req.session.error = "An error was encountered";
        res.redirect("/");
    });
});

app.get("/top", function(req, res, next) {
    func.getTopPosts()
    .then(function(posts) {
        posts.map(function(e) {
            e.date = moment(e.date).format("DD MMMM YYYY, h:mm:ss a");
            e.comments.forEach(function(f) {
                f.date = moment(f.date).format("DD MMMM YYYY, h:mm:ss a");
            });
        });
        res.render("homepage", {
            user: req.user,
            posts: posts
        });
    })
    .fail(function(err) {
        next(err);
    });
});

app.use(function(req, res, next) {
    res.status(404).send("404 Error: Not Found");
});

app.use(function(err, req, res, next) {
    console.log(err);
    res.status(500).send("500 Internal Server Error: " + err);
});

var PORT = 8080;
func.clearUsers()
.then(function() {
    app.listen(PORT);
    console.info("Listening on port " + PORT + " in " + app.get("env") + " mode.");
})
.fail(function(err) {
    console.log("Initialization failed: " + err);
    process.exit(1);
});
