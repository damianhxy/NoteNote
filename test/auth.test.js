// Registration, sign-in and sign-out as they work today. Every test here shares one app, so it
// stays under the shared sign-in/sign-up limit (20 POSTs per 15 minutes per address).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start, Client, flash, PASSWORD } = require("./helpers/app.js");

let app;
before(async function () {
  app = await start();
});
after(() => app.stop());

test("a visitor gets the landing page with the sign-in form", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /<form method="POST" action="\/signin">/);
  assert.match(res.text, /<input type="hidden" name="_csrf" value="[^"]+">/);
  assert.ok(client.csrfToken);
});

test("the register page has the sign-up form", async function () {
  const res = await new Client(app.baseUrl).get("/register");
  assert.equal(res.status, 200);
  assert.match(res.text, /<form method="POST" action="\/signup">/);
  assert.match(res.text, /name="password2"/);
});

test("sign-up creates the account and signs the user in", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.signUp("alice", { name: "Alice Tan" });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/");
  const home = await client.get("/");
  assert.equal(home.status, 200);
  assert.match(home.text, /<a href="\/users\/alice"><i class="fa fa-user"><\/i> alice<\/a>/);
  assert.match(home.text, /There are no notes/);
  assert.equal(await client.isSignedIn(), true);
});

test("sign-up refuses a taken username", async function () {
  const client = new Client(app.baseUrl);
  await client.signUp("bob");
  const second = new Client(app.baseUrl);
  const res = await second.signUp("bob");
  assert.equal(res.location, "/register");
  assert.equal(flash((await second.get("/register")).text).error, "User already exists");
  assert.equal(await second.isSignedIn(), false);
});

test("sign-up refuses mismatched passwords, short usernames and short passwords", async function () {
  const cases = [
    ["carol", { password2: "something-else" }, "Password mismatch"],
    ["cj", {}, "Username must be at least 3 characters"],
    ["carol", { password: "12345", password2: "12345" }, "Password must be at least 6 characters"],
  ];
  for (const [username, fields, message] of cases) {
    const client = new Client(app.baseUrl);
    const res = await client.signUp(username, fields);
    assert.equal(res.location, "/register", message);
    assert.equal(flash((await client.get("/register")).text).error, message);
    assert.equal(await client.isSignedIn(), false, message);
  }
});

test("sign-in with the right password", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.signIn("alice");
  assert.equal(res.status, 302);
  assert.equal(res.location, "/");
  assert.equal(await client.isSignedIn(), true);
});

test("sign-in with a wrong password", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.signIn("alice", "wrong-password");
  assert.equal(res.location, "/");
  assert.equal(flash((await client.get("/")).text).error, "Wrong password");
  assert.equal(await client.isSignedIn(), false);
});

test("sign-in with an unknown user", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.signIn("nobody", PASSWORD);
  assert.equal(res.location, "/");
  assert.equal(flash((await client.get("/")).text).error, "User does not exist");
  assert.equal(await client.isSignedIn(), false);
});

test("signed-in pages send a visitor back to / with 'Please sign in'", async function () {
  for (const url of ["/posts/upload", "/posts/search?query=x", "/users/alice"]) {
    const client = new Client(app.baseUrl);
    const res = await client.get(url);
    assert.equal(res.status, 302, url);
    assert.equal(res.location, "/", url);
    assert.equal(flash((await client.get("/")).text).error, "Please sign in", url);
  }
});

test("the sign-out link signs the user out", async function () {
  const client = new Client(app.baseUrl);
  await client.signIn("alice");
  const res = await client.get("/signout");
  assert.equal(res.status, 302);
  assert.equal(res.location, "/");
  assert.equal(await client.isSignedIn(), false);
});

test("an unknown path is a 404", async function () {
  const res = await new Client(app.baseUrl).get("/no-such-page");
  assert.equal(res.status, 404);
  assert.equal(res.text, "Page Not Found");
});
