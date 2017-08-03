var Promise = require("bluebird");
var nedb = require("nedb");
var bcryptjs = require("bcryptjs");
var users = new nedb({ filename: "./database/users", autoload: true });
Promise.promisifyAll(bcryptjs);
Promise.promisifyAll(users);
Promise.promisifyAll(users.find().constructor.prototype);

exports.add = function(body, username, password) {
    return users.findOneAsync({ username: username })
    .then(function(user) {
        if (user) throw Error("User already exists");
        if (password !== body.password2) throw Error("Password mismatch");
        return bcryptjs.hashAsync(password, 10);
    })
    .then(function(hash) {
        var user = {
            "name": body.name,
            "username": username,
            "hash": hash,
            "karma": 0,
            "followers": [],
            "following": [],
            "admin": false
        };
        return users.insertAsync(user);
    });
};

exports.authenticate = function(username, password) {
    return users.findOneAsync({ username: username })
    .then(function(user) {
        if (!user) throw Error("User does not exist");
        return bcryptjs.compareAsync(password, user.hash);
    })
    .then(function(res) {
        if (!res) throw Error("Wrong password");
        return user;
    });
};

// To Do: Check Existence of user
exports.addFollow = function(follower, following) {
    return users.findOneAsync({ username: follower })
    .then(function(user) {
        if (!user) throw Error("User does not exist");
        if (user.following.indexOf(following) === -1)
            user.following.push(following);
        else
            user.following.splice(following);
        return users.updateAsync({ username: follower },
            { $set: { following: user.following } });
    })
    .then(function() {
        return users.findOneAsync({ username: following} );
    })
    .then(function(user) {
        if (!user) throw Error("User does not exist");
        if (user.followers.indexOf(follower) === -1)
            user.followers.push(follower);
        else
            user.followers.splice(follower);
        return users.updateAsync({ username: following },
            { $set: { followers: user.followers } });
    });
};

exports.get = function(username) {
    return users.findOneAsync({ username: username });
};

exports.getByID = function(ID) {
    return users.findOneAsync({ _id: ID })
    .then(function(user) {
        if (!user) throw Error("User does not exist");
        return user;
    });
};

exports.all = function() {
    return users.find({})
    .sort({ karma: -1, username: 1 })
    .execAsync();
}
