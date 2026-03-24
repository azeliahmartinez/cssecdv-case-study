const session = require('express-session');
const express = require('express');

const server = express();

server.use(session({
    secret: 'private_key', 
    // prevents session data from being saved on every request
    resave: false,
    saveUninitialized: true
}));

/// Middleware to set isLoggedIn, isOwner, and isRater based on session
server.use(function(req, res, next) {
    if (req.session.username) {
        // User is logged in
        res.locals.isLoggedIn = true;
        res.locals.isLoggedOut = false;

        // Check if user is an owner or a rater
        if (req.session.userType === 'owner') {
            res.locals.isOwner = true;
            res.locals.isRater = false;
        } else if (req.session.userType === 'rater') {
            res.locals.isOwner = false;
            res.locals.isRater = true;
        } else {
            // If userType is neither 'owner' nor 'rater', set both to false
            res.locals.isOwner = false;
            res.locals.isRater = false;
        }
    } else {
        // User is NOT logged in
        res.locals.isLoggedIn = false;
        res.locals.isLoggedOut = true;
        res.locals.isOwner = false;
        res.locals.isRater = false;
    }
    next();
});

  


module.exports = server;