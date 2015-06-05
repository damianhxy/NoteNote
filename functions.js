var Datastore = require("nedb");
var bcrypt = require("bcrypt");
var randomcolor = require("randomcolor");
var fs = require("fs");
var userDB = new Datastore({filename: "./databases/users"});
var onlineDB = new Datastore({filename: "./databases/online"});
var postDB = new Datastore({filename: "./databases/posts"});
var Q = require("q");

// Auth
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
						"icon": randomcolor({ luminosity: "light" }),
						"karma": 0,
						"followees": [user], // Following them
						"followers": [], // Being followed
						"joined": Date.now()
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
				else deferred.resolve(result);
			});
		});
	});
	return deferred.promise;
};

// Online Users
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
				onlineDB.update({username: user}, {$set: {sessions: result.sessions - 1}}, function(err) {
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

exports.getPostCount = function() {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("DB LOAD ERROR");
		else postDB.count({}, function(err, cnt) {
			if (err) deferred.reject("COUNT ERROR");
			else deferred.resolve(cnt);
		});
	});
	return deferred.promise;
};

exports.updateKarma = function(user, change) {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("DB LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			if (!result) deferred.reject("NOT FOUND");
			else {
				result.karma += change;
				userDB.update({username: user}, {$set: result}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve("UPDATE SUCCESS");
				});
			}
		});
	});
	return deferred.promise;
};

// Link to File Path, Tag, User, Date, Votes, Comment, ID, Hidden, Text, Icon
exports.addPost = function(post) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("DB LOAD ERROR");
		else postDB.insert(post, function(err) {
			if (err) deferred.reject("INSERT ERROR");
			else deferred.resolve("INSERT SUCCESS");
		});
	});
	return deferred.promise;
};

exports.deletePost = function(post) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("DB LOAD ERROR");
		else postDB.update({id: post}, {$set: {hidden: true}}, function(err, result) {
			if (err) deferred.reject("UPDATE ERROR");
			else deferred.resolve("UPDATE SUCCESS");
		});
	});
	return deferred.promise;
};

exports.getPostByID = function(post) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.findOne({id: post}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else deferred.resolve(result);
		});
	});
	return deferred.promise;
};

exports.vote = function(post, user, value) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("DB LOAD ERROR");
		else postDB.findOne({id: post}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else {
				var original = "0";
				if (~ result.votes["-1"].indexOf(user)) original = "-1";
				else if (~ result.votes["1"].indexOf(user)) original = "1";
				if (original !== "0" && original !== value) // Remove old value
					result.votes[original].some(function(e, i) {
						if (e === user)
							return result.votes[original].splice(i, 1); // Coerce to True
						return false;
					});
				if (value !== "0") // Check if voted
					result.votes[value].push(user);
				result.karma += parseInt(value) - parseInt(original); // Update Karma
				postDB.update({id: post}, {$set: result}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve({
						"user": result.user,
						"diff": parseInt(value) - parseInt(original)
					}); // Difference
				});
			}
		});
	});
	return deferred.promise;
};

exports.commentCount = function(post) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.findOne({id: post}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else deferred.resolve(result.comments.length);
		});
	});
	return deferred.promise;
};

// User, Date Posted, ID, Text, Icon, Hidden
exports.addComment = function(post, user, ID, comment) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.findOne({id: post}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else {
				result.comments.push(comment);
				postDB.update({id: post}, {$set: {comments: result.comments}}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve("UPDATE SUCCESS");
				});
			}
		});
	});
	return deferred.promise;
};

exports.deleteComment = function(post, user, commentID) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.findOne({id: post}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else if (result.comments[commentID].user !== user)
				deferred.reject("NOT OWNER");
			else {
				result.comments[commentID].hidden = true;
				postDB.update({id: post}, {$set: {comments: result.comments}}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve("UPDATE SUCCESS");
				});
			}
		});
	});
	return deferred.promise;
};

exports.userExists = function(user) {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else if (!result) deferred.reject("NOT FOUND");
			else deferred.resolve("FOUND");
		});
	});
	return deferred.promise;
};

exports.toggleFollow = function(user, target) { // User following target
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else {
				var pos = result.followees.indexOf(target);
				if (~ pos)
					result.followees.splice(pos, 1);
				else
					result.followees.push(target);
				userDB.update({username: user}, {$set: {followees: result.followees}}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve("UPDATE SUCCESS");
				});
			}
		});
	});
	return deferred.promise;
};

exports.toggleFollowed = function(user, target) { // User followed by target
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else {
				var pos = result.followers.indexOf(target);
				if (~ pos)
					result.followers.splice(pos, 1);
				else
					result.followers.push(target);
				userDB.update({username: user}, {$set: {followers: result.followers}}, function(err) {
					if (err) deferred.reject("UPDATE ERROR");
					else deferred.resolve("UPDATE SUCCESS");
				});
			}
		});
	});
	return deferred.promise;
};

exports.getFollowing = function(user) {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result.followees);
		});
	});
	return deferred.promise;
};

exports.getFollowed = function(user) {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result.followers);
		});
	});
	return deferred.promise;
}
// Truncate to 20
exports.filterPosts = function(user, offset, mask) { // Return all the posts objects
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.find({
			$where: function() { return !! ~ mask.indexOf(this.user) }, hidden: false
		}).skip(offset).limit(20).sort({date: -1}).exec(function(err, posts) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(posts);
		});
	});
	return deferred.promise;
};

// Truncate to 20
exports.getUserPosts = function(user, offset) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.find({
			$where: function() { return this.user === user },
			hidden: false
		}).skip(offset).limit(20).exec(function(err, posts) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(posts);
		});
	});
	return deferred.promise;
};

exports.getUsers = function() {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.find({}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result);
		});
	});
	return deferred.promise;
};

// Truncate to 20
exports.searchTags = function(tag, offset) {
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.find({
			$where: function() { return !! ~ this.tags.indexOf(tag) }, hidden: false
		}).skip(offset).limit(20).exec(function(err, posts) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(posts);
		});
	});
	return deferred.promise;
};

exports.getUserByID = function(user) {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.findOne({username: user}, function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result);
		});
	});
	return deferred.promise;
};

exports.leaderboard = function() {
	var deferred = Q.defer();
	userDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else userDB.find({}).sort({karma: -1, joined: -1}).limit(20).exec(function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result);
		});
	});
	return deferred.promise;
};

exports.getTopPosts = function() { // Limit to 20
	var deferred = Q.defer();
	postDB.loadDatabase(function(err) {
		if (err) deferred.reject("LOAD ERROR");
		else postDB.find({hidden: false}).sort({karma: -1, date: -1, user: 1}).limit(20).exec(function(err, result) {
			if (err) deferred.reject("FIND ERROR");
			else deferred.resolve(result);
		});
	});
	return deferred.promise;
}