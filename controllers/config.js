const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const exphbs = require("express-handlebars");
const localStrategy = require("passport-local");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const SQLiteSessionStore = require("../database/session-store.js");
const { format } = require("date-fns");
const settings = require("./settings.js");
const user = require("../models/user.js");
const { csrfMiddleware } = require("../middlewares/csrf.js");

module.exports = function (app, express) {
  require("console-stamp")(console, {
    pattern: settings.TIME_FORMAT,
    colors: {
      stamp: "cyan",
      label: "magenta",
    },
  });

  morgan.token("time", function () {
    return format(new Date(), settings.TIME_FORMAT);
  });

  // Security
  app.use(helmet());
  app.enable("case sensitive routing");
  app.enable("strict routing");
  app.disable("x-powered-by");
  // Session cookies are Secure in production, and the app itself only speaks HTTP, so
  // production must sit behind an HTTPS proxy that Express is told to trust.
  app.set("trust proxy", settings.TRUST_PROXY);
  if (app.get("env") === "production" && !settings.TRUST_PROXY) {
    console.warn("TRUST_PROXY is not set: no session cookie will be issued in production");
  }

  // Rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/signin", authLimiter);
  app.use("/signup", authLimiter);

  // Middleware
  app.use(compression());
  app.use(express.static("public"));
  app.use(
    morgan("[:time] :method :url :status :res[content-length] - :remote-addr - :response-time ms"),
  );
  app.use(cookieParser(settings.SECRET));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    session({
      secret: settings.SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      store: new SQLiteSessionStore(),
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(csrfMiddleware);

  // Strategies
  passport.use(
    "local-signin",
    new localStrategy({ passReqToCallback: true }, async function (req, username, password, done) {
      try {
        const userObj = await user.authenticate(username, password);
        console.info("Signed in", username);
        done(null, userObj);
      } catch (err) {
        console.error(err.message);
        req.session.error = err.message;
        done(null, false);
      }
    }),
  );

  passport.use(
    "local-signup",
    new localStrategy({ passReqToCallback: true }, async function (req, username, password, done) {
      try {
        const userObj = await user.add(req.body, username, password);
        console.info("Added user", username);
        done(null, userObj);
      } catch (err) {
        console.error(err.message);
        req.session.error = err.message;
        done(null, false);
      }
    }),
  );

  // Serialization
  passport.serializeUser(function (userObj, done) {
    done(null, userObj._id);
  });

  passport.deserializeUser(async function (id, done) {
    try {
      const userObj = await user.getByID(id);
      done(null, userObj);
    } catch (err) {
      console.error(err.message);
      done(err, false);
    }
  });

  const hbs = exphbs.create({
    defaultLayout: "default",
    helpers: {
      fileType: require("../helpers/fileType.js"),
      isInside: require("../helpers/isInside.js"),
      isEqual: require("../helpers/isEqual.js"),
      string: require("../helpers/string.js"),
      add: require("../helpers/add.js"),
    },
    partials: {
      post: require("../views/partials/post.handlebars"),
      comment: require("../views/partials/comment.handlebars"),
      alert: require("../views/partials/alert.handlebars"),
    },
  });

  app.engine("handlebars", hbs.engine);
  app.set("view engine", "handlebars");
};
