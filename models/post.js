var Promise = require("bluebird");
var nedb = require("nedb");
var moment = require("moment-timezone");
var settings = require("../controllers/settings.js");
var posts = new nedb({ filename: "./database/posts", autoload: true });
Promise.promisifyAll(posts);
Promise.promisifyAll(posts.find().constructor.prototype);

exports.add = function(req) {
    var tags = req.body.tags ? req.body.tags.split(",") : ["untagged"];
    var post = {
        username: req.user.username,
        name: req.body.name,
        path: req.file.path.slice(6),
        description: req.body.text,
        time: moment.tz("Asia/Singapore").format(),
        timePretty: moment.tz("Asia/Singapore").format(settings.TIME_FORMAT),
        tags: tags,
        karma: 0,
        upvotes: [],
        downvotes: []
    };
    return posts.insertAsync(post);
};

exports.findByUser = function(username) {
    return posts.findAsync({ username: username });
}

exports.top = function() {
    return posts.find({})
    .sort({ karma: -1 })
    .limit(20)
    .execAsync();
}
