const { csrfSync } = require("csrf-sync");

const csrfProtection = csrfSync({
  getTokenFromRequest: function (req) {
    return req.body._csrf || req.headers["x-csrf-token"];
  },
});

function csrfMiddleware(req, res, next) {
  res.locals.csrfToken = csrfProtection.generateToken(req);
  next();
}

function csrfValidate(req, res, next) {
  if (req.is("multipart/form-data")) {
    return next();
  }
  return csrfProtection.csrfSynchronisedProtection(req, res, function (err) {
    if (err) {
      return res.status(403).json({ error: "CSRF token invalid" });
    }
    next();
  });
}

function csrfValidateMultipart(req, res, next) {
  return csrfProtection.csrfSynchronisedProtection(req, res, function (err) {
    if (err) {
      return res.status(403).json({ error: "CSRF token invalid" });
    }
    next();
  });
}

module.exports = { csrfMiddleware, csrfValidate, csrfValidateMultipart };
