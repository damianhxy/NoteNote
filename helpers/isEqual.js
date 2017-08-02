module.exports = function(e1, e2, opts) {
    if (e1 === e2)
        return opts.fn(this);
    return opts.inverse(this);
};
