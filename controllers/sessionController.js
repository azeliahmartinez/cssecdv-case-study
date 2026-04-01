const session = require('express-session');
const express = require('express');

const server = express();

// ✅ Session setup (SAFE)
server.use(session({
    secret: 'private_key',
    resave: false,
    saveUninitialized: false // 🔥 important fix
}));

// ✅ SAFE middleware (no more crash)
server.use(function(req, res, next) {

    // 🔥 ALWAYS ensure session exists
    const userSession = req.session || {};

    if (userSession.username) {
        res.locals.isLoggedIn = true;
        res.locals.isLoggedOut = false;

        if (userSession.userType === 'owner') {
            res.locals.isOwner = true;
            res.locals.isRater = false;
        } 
        else if (userSession.userType === 'rater') {
            res.locals.isOwner = false;
            res.locals.isRater = true;
        } 
        else {
            res.locals.isOwner = false;
            res.locals.isRater = false;
        }

    } else {
        res.locals.isLoggedIn = false;
        res.locals.isLoggedOut = true;
        res.locals.isOwner = false;
        res.locals.isRater = false;
    }

    next();
});

module.exports = server;