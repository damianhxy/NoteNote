const crypto = require("crypto");

const TOKEN_LENGTH = 32;

function generateToken(session) {
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomBytes(TOKEN_LENGTH).toString("hex");
  }
  return session.csrfToken;
}

function csrfMiddleware(req, res, next) {
  res.locals.csrfToken = generateToken(req.session);
  next();
}

function csrfValidate(req, res, next) {
  const token = req.body._csrf || req.headers["x-csrf-token"];
  if (!token || !req.session.csrfToken) {
    return res.status(403).json({ error: "CSRF token missing" });
  }
  const tokenBuf = Buffer.from(token, "hex");
  const sessionBuf = Buffer.from(req.session.csrfToken, "hex");
  if (tokenBuf.length !== sessionBuf.length || !crypto.timingSafeEqual(tokenBuf, sessionBuf)) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
}

module.exports = { csrfMiddleware, csrfValidate };
