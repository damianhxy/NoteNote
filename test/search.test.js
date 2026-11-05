// Search from the search bar: GET /posts/search?query=, matching tags or descriptions.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start, Client, cards } = require("./helpers/app.js");

let app;
let alice;
const ids = {};
before(async function () {
  app = await start();
  alice = new Client(app.baseUrl);
  await alice.signUp("alice");
  ids.physics = await alice.uploadPost({
    name: "Physics",
    text: "Kinematics",
    tags: "physics, jc1",
  });
  ids.chem = await alice.uploadPost({ name: "Chem", text: "Organic reactions", tags: "chemistry" });
  ids.effort = await alice.uploadPost({ name: "Effort", text: "100% effort", tags: "misc" });
  ids.abc = await alice.uploadPost({ name: "Letters", text: "abc", tags: "letters" });
});
after(() => app.stop());

const search = async (query) =>
  cards((await alice.get("/posts/search?query=" + encodeURIComponent(query))).text)
    .map((c) => c.id)
    .sort();

test("the search bar is on the home page", async function () {
  assert.match((await alice.get("/")).text, /<form method="GET" action="\/posts\/search">/);
});

test("search matches tags", async function () {
  assert.deepEqual(await search("chemistry"), [ids.chem]);
  assert.deepEqual(await search("jc1"), [ids.physics]);
});

test("search matches descriptions, ignoring ASCII case", async function () {
  assert.deepEqual(await search("kinematics"), [ids.physics]);
  assert.deepEqual(await search("ORGANIC"), [ids.chem]);
});

test("a post matching both its tag and description is listed once", async function () {
  assert.deepEqual(await search("letters"), [ids.abc]);
  assert.deepEqual(await search("abc"), [ids.abc]);
});

test("a search with no match shows an empty page", async function () {
  const res = await alice.get("/posts/search?query=nothing-like-this");
  assert.equal(res.status, 200);
  assert.match(res.text, /There are no notes/);
});

test("an empty search lists every post", async function () {
  assert.deepEqual(await search(""), Object.values(ids).sort());
});

test.todo("3.9 SQL LIKE: % and _ in a query match literally", async function () {
  assert.deepEqual(await search("100%"), [ids.effort]);
  assert.deepEqual(await search("a_c"), []);
});
