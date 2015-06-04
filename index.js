var exphbs = require("express-handlebars");
var express = require("express");
var moment = require("./public/lib/moment.js");
var morgan = require("morgan");

var app = express();
var hbs = exphbs.create({
    defaultLayout: "default"
});
morgan.token("date", function(req, res) {
    return require("console-stamp/node_modules/dateformat")(new Date(), "dd mmm HH:MM:ss");
});
require("console-stamp")(console, "dd mmm HH:MM:ss");

app.enable("case sensitive routing");
app.enable("strict routing");
app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");

app.use(express.static(__dirname + "/public"));
app.use(morgan("[:date] :method :url :status :res[content-length] - :remote-addr - :response-time ms"));

// Routes

app.listen(8080);
console.info("Listening on port 8080 in " + app.get("env") + " mode.");