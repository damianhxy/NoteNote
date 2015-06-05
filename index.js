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

var app = express();
var hbs = exphbs.create({
    defaultLayout: "default",
    helpers: {
        fileType: function(extension) {
            if (/docx?/.test(extension))
                return "fa-file-word-o";
            if (/pptx?/.test(extension))
                return "fa-file-powerpoint-o";
            if (/xlsx?/.test(extension))
                return "fa-file-excel-o";
            if (extension === "pdf")
                return "fa-file-pdf-o";
            return "fa-file-o";
        },
        isInside: function(element, array, value) {
            return !! ~ array[value].indexOf(element);
        },
        isEqual: function(e1, e2, opts) {
			if(e1 == e2)
				return opts.fn(this);
			else
				return opts.inverse(this);
		},
		is: function(a, b) {
			return a == b;
		},
		string: function(a) {
			return JSON.stringify(a);
		}
    }
});
app.use(multer({
    dest: "./public/uploads/",
    limits: { fileSize: 26214400 },
    rename: function() {
        return "upload" + Date.now();
    },
    onFileUploadStart: function(file) {
        latest = null;
        console.log("Uploading " + file.originalname);
    },
    onFileUploadComplete: function(file) {
        latest = file;
        console.log(file.originalname + " uploaded to " + file.path);
    },
    onFileSizeLimit: function(file) {
        console.log("Exceeded Size Limit: " + file.originalname);
        fs.unlink("./" + file.path);
    }
}));
morgan.token("date", function(req, res) {
    return require("console-stamp/node_modules/dateformat")(new Date(), "dd mmm HH:MM:ss");
});
require("console-stamp")(console, "dd mmm HH:MM:ss");

app.enable("case sensitive routing");
app.enable("strict routing");
app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");

// Strategies
passport.use("local-signin", new LocalStrategy({
        passReqToCallback: true
    },
    function(req, username, password, done) {
        var scope = {};
        func.localAuth(username, password)
        .then(function(user) {
            console.log("Signed in " + user.username);
            req.session.success = "Welcome back, " + user.username;
            scope.user = user;
            return func.addUser({"username": user.username, "time": moment().format()});
        })
        .then(function() {
            done(null, scope.user);
        })
        .fail(function(err) {
            console.log("Login of " + username + " failed: " + err);
            req.session.error = "An error was encountered";
            done(null, false);
        });
    }
));

passport.use("local-signup", new LocalStrategy({
        passReqToCallback: true
    }, function(req, username, password, done) {
        func.localReg(req, username, password)
        .then(function(user) {
            console.log("Registered " + user.username);
            req.session.success = "You have been successfully registered";
            done(null, user);
        })
        .fail(function(err) {
            console.log("Registration failed: " + err);
            req.session.error = "An error was encountered";
            done(null, false);
        });
    }
));

// Session
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});


// Settings
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride("X-HTTP-Method-Override"));
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: "hwachong"
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("./public"));
app.use(morgan("[:date] :method :url :status :res[content-length] - :remote-addr - :response-time ms"));

app.use(function(req, res, next) {
    ["error", "notice", "success"].forEach(function(e) {
        if (req.session[e]) {
            res.locals[e] = req.session[e];
            delete req.session[e];
        }
    });
    next();
});

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
            return func.addPost({
                "path": latest.path.slice(6),
                "filename": latest.name,
                "original": latest.originalname,
                "extension": latest.extension,
                "tags": (req.body.tags || "Untagged").split(","),
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
        res.render("post", {
            user: req.user,
            post: post
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
	var scope;
    func.commentCount(parseInt(req.body.postID))
    .then(function(count) {
		scope = count;
        return func.addComment(parseInt(req.body.postID), req.user.username, count + 1,
        {
            "user": req.user.username,
            "date": Date.now(),
            "text": req.body.comment,
            "icon": req.user.icon,
            "hidden": false
        });
    })
    .then(function(){
		res.send(scope);
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
    func.searchTags(req.query.query, 0)
    .then(function(posts) {
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
        res.direct("/");
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