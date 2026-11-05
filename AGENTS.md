# NoteNote

Express 5 + Handlebars note-sharing site ("Share notes and earn karma"), first built at
Hackathon@SST 2015 and reworked in 2017. Users upload notes (PDF, Office files, images,
archives), tag and describe them, vote and comment on each other's posts, follow other users
for a home-page stream, and earn karma on a leaderboard. Users, posts and sessions are in SQLite
(better-sqlite3) at `database/app.db` (or `DB_PATH`); uploads go to `public/uploads/`. The site
is not deployed.

## Run and check

- Node: the version in `.node-version` (also the `engines` floor in `package.json`).
  `npm ci` may build better-sqlite3 with node-gyp, so it needs Python and `make` (slim Docker
  images lack them). On Docker use a Debian trixie image: bookworm's glibc is too old for
  better-sqlite3's prebuilt binary.
- `npm ci --engine-strict`, then copy `.env.example` to `.env` and set `SESSION_SECRET`
  (32+ random characters). Run `npm start` (or `npm run dev`) **from the repo root**.
- **Gate** (what CI runs; all must pass before a PR is ready):

  ```sh
  npm ci --engine-strict && npm run lint && npm run format:check && npm test && npm audit --omit=dev
  ```

- `npm test` boots the real `node app.js` in a temporary copy of the repo (your `database/` and
  `public/uploads/` are never touched) and drives it over HTTP with a cookie-jar client that
  scrapes the CSRF token and sends requests the way the pages and their jQuery calls do
  (`test/helpers/app.js`). No network is needed.

## Where things live

- `app.js`: startup. `controllers/settings.js`: env (port, secret check), upload limits and
  allowed file types.
- `controllers/config.js`: middleware (helmet, rate limits, sessions, passport strategies,
  CSRF token, Handlebars helpers and partials).
- `controllers/routes.js`: home, register, top, leaderboard, sign-in/up/out and the 404/500
  handlers; `posts.js` (upload, votes, comments, search, delete) and `users.js` (profiles,
  follow) beside it.
- `models/user.js`, `models/post.js`: SQLite tables and queries. `database/`: the connection
  and the session store.
- `middlewares/`: auth, CSRF (`csrf.js`), flash messages, multer upload config.
- `views/`: Handlebars templates. `public/js/custom/`: the page scripts (votes, comments,
  delete, follow).
- `test/`: `node:test` suites; `test/helpers/app.js` is the harness.
- `.github/workflows/ci.yml`: checks `test (floor)`, `test (lts)` and `audit` on every PR and
  push to `master`, weekly on Mondays; a failing scheduled run opens a "Scheduled CI failed"
  issue. `dependabot.yml`: monthly grouped updates. `dependabot-auto-merge.yml`: patch and minor
  Dependabot PRs merge themselves once the required checks pass.

## Conventions

- Damian merges. Agents work on branches and open or update PRs; they never merge, close PRs,
  push to `master` or change repository settings.
- One problem per commit, one theme per PR. Imperative, sentence-case subjects with no prefix,
  except dependency commits: `fix(deps): update <pkg> <old> -> <new> (GHSA-…)`.
- Commit bodies say what was wrong (citing the commit that caused it), the fix, and how it was
  verified: the result before and after. A behavioural fix adds a test that fails before it.
- Don't force-push a pushed branch; add commits, and merge the base in to update it.
- Stacked PRs say so in the description and give the merge order.
- Known gaps are `test.todo` entries named after the item they miss. Fixing one means dropping
  `.todo` in the same PR.
- The CSRF form field is `_csrf`; page scripts send the token in `X-CSRF-Token`.
- Escape on output: Handlebars `{{ }}` already escapes, so don't escape input before storing it.

## Decided against (don't re-propose)

- npm's audit "fix" for the dev-only eslint/minimatch advisory.
- Migrating old NeDB data into SQLite. There is no data worth migrating.
- Changing the Content-Security-Policy as a side effect of another fix. Moving the inline
  scripts into files (open PR #3) comes first, in its own PR.

## Known issues (don't re-investigate)

- `public/` and `views/` are resolved against the working directory, so the app only starts
  from the repo root.
- Requests with no body (the follow button, deleting a post or a comment) fail with 500:
  the CSRF check reads `req.body._csrf`, and Express 5 leaves `req.body` undefined. Sign-out is
  a GET link and leaves the stored session in place. Anyone can delete any comment, any vote
  value is accepted, and following an unknown user still updates the follower (open PR #1).
- helmet's default CSP blocks the inline scripts, including the one that adds the CSRF header to
  jQuery calls, so in a browser votes and comments are refused too (open PR #3).
- Comments are HTML-escaped before storage and again on output (open PR #4).
- Search passes `%` and `_` through as LIKE wildcards (open PR #5).
- With `NODE_ENV=production` the session cookie is `Secure` but `trust proxy` is never set, so
  behind an HTTPS proxy no cookie is issued; the rate limits are shared by everyone behind the
  proxy (open PR #6).
- Avatars point at the defunct api.adorable.io (open PR #8).
- The sign-in/sign-up rate limiter is mounted with `app.use("/signin")`, so it counts every
  method, not only POSTs.
- Errors raised before the router (for example a malformed JSON body) reach Express's default
  handler, which shows a stack trace outside production: the 404/500 handlers live inside
  `routes.js`.
- Sign-in redirects to the Referer without checking its origin; helmet's `no-referrer` policy
  means browsers send none, so it always lands on `/`.
- Sign-in says "User does not exist" or "Wrong password", so it reveals which usernames exist;
  usernames are checked only for length.
- `app.js` logs "Listening on port" before `listen()` has bound the port.
- `res.status(4xx).redirect(...)` calls send 302 (redirect overrides the status). Don't add
  more.
