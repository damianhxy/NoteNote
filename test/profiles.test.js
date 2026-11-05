// Profiles, following and the karma leaderboard.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start, Client, flash, cards } = require("./helpers/app.js");

let app;
let alice;
let bob;
before(async function () {
  app = await start();
  alice = new Client(app.baseUrl);
  await alice.signUp("alice");
  bob = new Client(app.baseUrl);
  await bob.signUp("bob");
});
after(() => app.stop());

const counts = (text) => ({
  karma: Number(text.match(/<span id="karmacount">(-?\d+)<\/span>/)[1]),
  followers: Number(text.match(/<span id="followercount">(\d+)<\/span>/)[1]),
  following: Number(text.match(/\| (\d+) following/)[1]),
});

test("a profile shows the user's counts and posts, newest first", async function () {
  const first = await bob.uploadPost({ name: "Bob one" });
  await new Promise((resolve) => setTimeout(resolve, 1100)); // post dates have 1 s resolution
  const second = await bob.uploadPost({ name: "Bob two" });
  const res = await alice.get("/users/bob");
  assert.equal(res.status, 200);
  assert.match(res.text, /<p class="cardname">bob<\/p>/);
  assert.deepEqual(counts(res.text), { karma: 0, followers: 0, following: 0 });
  assert.deepEqual(
    cards(res.text).map((c) => c.id),
    [second, first],
  );
  assert.match(res.text, /<script src="\/js\/custom\/profile.js"><\/script>/);
});

test("the follow button shows on other profiles, not your own", async function () {
  assert.match(
    (await alice.get("/users/bob")).text,
    /<span class="cardfollow" data-fvalue="1" data-ftoggle="false" data-ftarget="bob">Follow<\/span>/,
  );
  assert.doesNotMatch((await alice.get("/users/alice")).text, /class="cardfollow"/);
});

test("an unknown profile sends the user home with 'User not found'", async function () {
  const res = await alice.get("/users/nobody");
  assert.equal(res.location, "/");
  assert.equal(flash((await alice.get("/")).text).error, "User not found");
});

// profile.js follows with $.post(url) and no body, which 500s today (the todo in
// baseline.test.js). With the token in a form body the route works.
test("following toggles, and updates both users' counts", async function () {
  await alice.get("/users/bob");
  assert.equal((await alice.post("/users/follow/bob")).status, 200);
  let bobPage = (await alice.get("/users/bob")).text;
  assert.equal(counts(bobPage).followers, 1);
  assert.match(bobPage, /data-ftoggle="true" data-ftarget="bob"/);
  assert.equal(counts((await alice.get("/users/alice")).text).following, 1);

  assert.equal((await alice.post("/users/follow/bob")).status, 200);
  bobPage = (await alice.get("/users/bob")).text;
  assert.equal(counts(bobPage).followers, 0);
  assert.equal(counts((await alice.get("/users/alice")).text).following, 0);
});

test("following yourself fails", async function () {
  await alice.get("/users/alice");
  const res = await alice.post("/users/follow/alice");
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.text), { error: "Follow failed" });
  assert.equal(counts((await alice.get("/users/alice")).text).following, 0);
});

test("following needs the CSRF token", async function () {
  const res = await alice.request("POST", "/users/follow/bob", { form: { confirm: "1" } });
  assert.equal(res.status, 403);
  assert.equal(counts((await alice.get("/users/bob")).text).followers, 0);
});

test("the leaderboard ranks users by karma, then name, for everyone", async function () {
  const carol = new Client(app.baseUrl);
  await carol.signUp("carol");
  const id = await carol.uploadPost({ name: "Popular" });
  for (const voter of [alice, bob]) {
    await voter.get("/posts/" + id);
    await voter.ajax("POST", "/posts/vote/" + id, { val: 1 });
  }
  const res = await new Client(app.baseUrl).get("/leaderboard");
  assert.equal(res.status, 200);
  const rows = [
    ...res.text.matchAll(
      /<td>(\d+)<\/td>\s*<td><a href="\/users\/(\w+)">\w+<\/a><\/td>\s*<td>(-?\d+)<\/td>/g,
    ),
  ].map(([, rank, name, karma]) => [Number(rank), name, Number(karma)]);
  assert.deepEqual(rows, [
    [1, "carol", 2],
    [2, "alice", 0],
    [3, "bob", 0],
  ]);
});

test.todo(
  "3.9 IDs and lookups: following an unknown user changes nobody's list",
  async function () {
    await alice.get("/users/alice");
    await alice.post("/users/follow/ghost");
    assert.equal(counts((await alice.get("/users/alice")).text).following, 0);
  },
);
