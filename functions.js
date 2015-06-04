var Datastore = require("nedb");
var bcrypt = require("bcrypt");
var randomcolor = require("randomcolor");
var userDB = new Datastore({filename: "./databases/users"});
var onlineDB = new Datastore({filename: "./databases/online"});
var Q = require("q");

exports.localReg = function(req, user, pass) {
    var deferred = Q.defer();
    user = user.toLowerCase();
    if (pass !== req.body.password2) deferred.reject("PASSWORD MISMATCH");
    else if (!/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(req.body.email))
        deferred.reject("TAMPERED EMAIL FIELD");
    else userDB.loadDatabase(function(err) {
        if (err) deferred.reject("DB LOAD ERROR");
        else userDB.findOne({username: user}, function(err, result) {
            if (err) deferred.reject("FIND ERROR");
            else if (result) deferred.reject("NAME IN USE");
            else bcrypt.genSalt(10, function(err, salt) {
                if (err) deferred.reject("SALT GEN ERROR");
                else bcrypt.hash(pass, salt, function(err, hash) {
                    if (err) deferred.reject("HASH ERROR");
                    else userDB.insert({
                        "username": user,
                        "password": hash,
                        "salt": salt,
                        "email": req.body.email,
                        "realname": req.body.realname,
                        "school": req.body.school,
                        "icon": randomcolor({ luminosity: "light" })
                    }, function(err, obj) {
                        if (err) deferred.reject("INSERT ERROR");
                        else deferred.resolve(obj);
                    });
                });
            });
        });
    });
    return deferred.promise;
};

exports.localAuth = function(user, pass) {
    var deferred = Q.defer();
    user = user.toLowerCase();
    userDB.loadDatabase(function(err) {
        if (err) deferred.reject("DB LOAD ERROR");
        else userDB.findOne({username: user}, function(err, result) {
            if (err) deferred.reject("FIND ERROR");
            else if (!result) deferred.reject("USER NOT FOUND");
            else bcrypt.hash(pass, result.salt, function(err, hash) {
                if (err) deferred.reject("HASH ERROR");
                else if (hash !== result.password) deferred.reject("WRONG PASSWORD");
                else deferred.resolve(user);
            });
        });
    });
    return deferred.promise;
};

exports.addUser = function(user) {
    var deferred = Q.defer();
    onlineDB.loadDatabase(function(err) {
        if (err) deferred.reject("DB LOAD ERROR");
        else onlineDB.findOne({username: user.username}, function(err, result) {
            if (err) deferred.reject("FIND ERROR");
            else if (result)
                onlineDB.update({username: user.username}, {$set: {sessions: result.sessions + 1}}, function(err) {
                    if (err) deferred.reject("UPDATE ERROR");
                    else deferred.resolve("SESSION COUNT INCREMENTED");
                });
            else
                onlineDB.insert({username: user.username, time: user.time, sessions: 1}, function(err) {
                    if (err) deferred.reject("SESSION ERROR");
                    else deferred.resolve("SESSION ADDED");
                });
        });
    });
    return deferred.promise;
};

exports.removeUser = function(user) {
    var deferred = Q.defer();
    onlineDB.loadDatabase(function(err) {
        if (err) deferred.reject("DB LOAD ERROR");
        else onlineDB.findOne({username: user}, function(err, result) {
            if (err) deferred.reject("FIND ERROR");
            if (result.sessions > 1)
                onlineDB.update({username: usr}, {$set: {sessions: result.sessions - 1}}, function(err) {
                    if (err) deferred.reject("UPDATE ERROR");
                    else deferred.resolve("SESSION COUNT DECREMENTED");
                });
            else
                onlineDB.remove({username: user}, {}, function(err) {
                    if (err) deferred.reject("SIGNOUT ERROR");
                    else deferred.resolve("SESSION REMOVED");
                });
        });
    });
    return deferred.promise;
};

exports.clearUsers = function() {
    var deferred = Q.defer();
    onlineDB.loadDatabase(function(err) {
        if (err) deferred.reject("DB LOAD ERROR");
        else onlineDB.remove({}, {}, function(err) {
            if (err) deferred.reject("CLEAR ERROR");
            else deferred.resolve("DB CLEARED");
        });
    });
    return deferred.promise;
};