const session = require('express-session');
const express = require('express');

const server = express();

server.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

server.use(function (req, res, next) {
  const userSession = req.session || {};

  res.locals.isLoggedIn = !!userSession.username;
  res.locals.isLoggedOut = !userSession.username;
  res.locals.currentUser = userSession.username || null;
  res.locals.currentUserType = userSession.userType || null;

  res.locals.isAdmin = userSession.userType === 'admin';
  res.locals.isOwner = userSession.userType === 'owner';
  res.locals.isRater = userSession.userType === 'rater';

  next();
});

module.exports = server;