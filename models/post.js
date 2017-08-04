var Promise = require("bluebird");
var fs = require("fs");
var nedb = require("nedb");
var moment = require("moment-timezone");
var settings = require("../controllers/settings.js");
var posts = new nedb({ filename: "./database/posts", autoload: true });
Promise.promisifyAll(fs);
Promise.promisifyAll(posts);
Promise.promisifyAll(posts.find().constructor.prototype);

exports.add = function(req) {
    var tags = req.body.tags ? req.body.tags.split(",") : ["untagged"];
    var post = {
        username: req.user.username,
        name: req.body.name,
        path: req.file.path.slice(6),
        description: req.body.text,
        date: moment.tz("Asia/Singapore").format(),
        datePretty: moment.tz("Asia/Singapore").format(settings.POST_TIME_FORMAT),
        tags: tags,
        karma: 0,
        upvotes: [],
        downvotes: []
    };
    return posts.insertAsync(post);
};

exports.search = function(search) {
    return posts.findAsync({
        $where: function() {
            return this.tags.indexOf(search) !== -1 || this.description.indexOf(search) !== -1;
        }
    });
}

exports.findByUser = function(username) {
    return posts.findAsync({ username: username });
}

exports.get = function(ID) {
    return posts.findOneAsync({ _id: ID });
}

exports.delete = function(ID, username) {
    return posts.findOneAsync({ _id: ID })
    .then(function(post) {
        if (post.username !== username) throw Error("Unauthorised");
        return fs.unlinkAsync("public/" + post.path);
    })
    .then(posts.removeAsync({ _id: ID }));
}

exports.vote = function(ID, username, value) {
    return posts.findOneAsync({ _id: ID })
    .then(function(post) {
        var oldValue = 0;
        if (post.upvotes.indexOf(username) !== -1) {
            post.upvotes.splice(post.upvotes.indexOf(username), 1);
            oldValue = 1;
        } else if (post.downvotes.indexOf(username) !== -1) {
            post.downvotes.splice(post.downvotes.indexOf(username), 1);
            oldValue = -1;
        }
        if (value === 1) {
            post.upvotes.push(username);
        } else if (value === -1) {
            post.downvotes.push(username);
        }
        post.karma += value - oldValue;
        return posts.updateAsync({ _id: ID }, post)
        .then(function() {
            return [post.username, value - oldValue];
        });
    });
};

exports.getStream = function(following, start, end) {
    return posts.find({
        $where: function() {
            return following.indexOf(this.username) !== -1;
        }
    })
    .sort({ date: -1 })
    .skip(start)
    .limit(end - start + 1)
    .execAsync();
}

exports.top = function() {
    return posts.find({})
    .sort({ karma: -1 })
    .limit(20)
    .execAsync();
}
