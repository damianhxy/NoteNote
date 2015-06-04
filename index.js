var exphbs = require("express-handlebars");
var express = require("express");
var moment = require("./public/lib/moment.js");
var morgan = require("morgan");
var passport = require("passport");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var methodOverride = require("method-override");
var session = require("express-session");
var LocalStrategy = require("passport-local");
var func = require("./functions.js");

var app = express();
var hbs = exphbs.create({
    defaultLayout: "default"
});
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
    }, function(req, username, password, done) {
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
app.use(express.static(__dirname + "/public"));
app.use(morgan("[:date] :method :url :status :res[content-length] - :remote-addr - :response-time ms"));

app.use(function(req, res, next) {
    ["error", "notice", "success"].each(function(e) {
        if (req.session[e]) {
            res.locals[e] = req.session[e];
            delete req.session[e];
        }
    });
    next();
});

// Routes
app.get("/", function(req, res, next) {
    res.render("index");
});

app.post("/signin", function(req, res, next) {

});

app.post("/signup", function(req, res, next) {

});

app.get("/logout", function(req, res, next) {
    if (!req.user) {
        req.session.error = "You're not even logged in";
        res.redirect("/");
    } else func.removeUser(req.user.username)
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

app.use(function(req, res, next) {
    res.status(404).send("404 Not Found.");
});

app.use(function(err, req, res, next) {
    console.log(err);
    console.trace();
    res.status(500).send(500).send("500 Internal Server Error: " + err);
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