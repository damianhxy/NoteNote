var compression = require("compression");
var morgan = require("morgan");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var exphbs = require("express-handlebars");
var localStrategy = require("passport-local");
var session = require("express-session");
var nedbStore = require("express-nedb-session")(session);
var passport = require("passport");
var dateFormat = require("dateformat");
var settings = require("./settings.js");
var flash = require("express-flash");

var user = require("../models/user.js");

module.exports = function(app, express) {
    require("console-stamp")(console, {
        pattern: settings.TIME_FORMAT,
        colors: {
            stamp: "cyan",
            label: "magenta"
        }
    });

    morgan.token("time", function() {
        return dateFormat(new Date(), settings.TIME_FORMAT);
    });

    // Middleware
    app.use(compression());
    app.use(express.static("public"));
    app.use(morgan("[:time] :method :url :status :res[content-length] - :remote-addr - :response-time ms"));
    app.use(cookieParser(settings.SECRET));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(session({
        secret: settings.SECRET,
        resave: false,
        saveUninitialized: false,
        store: new nedbStore({ filename: "nedb_sessionstore" })
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    // Strategies
    passport.use("local-signin", new localStrategy(
        { passReqToCallback: true },
        function(req, username, password, done) {
            return user.authenticate(username, password)
            .then(function(user) {
                console.log("Signed in", username);
                done(null, user);
            })
            .catch(function(err) {
                console.error(err.message);
                done(null, false, { message: err.message });
            });
        }
    ));

    passport.use("local-signup", new localStrategy(
        { passReqToCallback: true },
        function(req, username, password, done) {
            return user.add(req.body, username, password)
            .then(function(user) {
                console.log("Added user", username);
                done(null, user);
            })
            .catch(function(err) {
                console.error(err.message);
                done(null, false, { message: err.message });
            });
        }
    ));

    // Serialization
    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function(id, done) {
        user.getByID(id)
        .then(function(user) {
            done(null, user);
        })
        .catch(function(err) {
            console.error(err.message);
            done(err, false);
        });
    });

    var hbs = exphbs.create({
        defaultLayout: "default",
        helpers: {
            fileType: require("../helpers/fileType.js"),
            isInside: require("../helpers/isInside.js"),
            isEqual: require("../helpers/isEqual.js"),
    		string: require("../helpers/string.js"),
            add: require("../helpers/add.js")
        },
        partials: {
            post: require("../views/partials/post.handlebars"),
            comment: require("../views/partials/comment.handlebars")
        }
    });

    app.enable("case sensitive routing");
    app.enable("strict routing");
    app.disable("x-powered-by");
    app.engine("handlebars", hbs.engine);
    app.set("view engine", "handlebars");
};
