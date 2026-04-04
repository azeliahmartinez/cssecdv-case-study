const express = require('express');
const sessionController = require('./sessionController');
const userModel = require('../models/User');
const reviewModel = require('../models/Review');
const establishmentModel = require('../models/Establishment');
const avatarModel = require('../models/Avatar');
const auditModel = require('../models/Audit');
const bcrypt = require('bcrypt');

const moment = require('moment');
const multer = require('multer');
const path = require('path');
const { requireAuth, requireRole } = require('./authMiddleware');
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
async function logAction(req, actionText) {
  try {
    await auditModel.create({
      action: actionText,
      user: req?.session?.username || 'System',
      role: req?.session?.userType || 'System',
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Define storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize multer upload
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 15 // 15MB max file size
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Define the errorFn function
const errorFn = function (error) {
  console.error('Error:', error);
};

 /*
// function to check if current user is logged in or not
function isLoggedIn(req, res, next) {
  if (req.session.username) {
    next();
  } else {
    res.clearCookie('remember_me');
    res.redirect('/'); 
  }
}
// function to check if current user is owner
function isOwner(req, res, next) {
  if (req.session.username && req.session.userType === 'owner') {
    // user is logged in and is an owner
    next();
  } else {
    res.redirect('/');
  }
}

// function to check if current user is owner
function isRater(req, res, next) {
  if (req.session.username && req.session.userType === 'rater') {
    // user is logged in and is a rater
    next();
  } else {
    res.redirect('/');
  }
}
*/

// function to calculate and update establishment ratings
function calculateAndUpdateRatings(establishment_data) {
  let establishmentUpdatedRating = 0;
  establishment_data.forEach(function(establishment) {
    let totalRating = 0;
    let reviewCount = 0;

    reviewModel.find({ place_name: establishment.establishment_name }).lean().then(function(reviews) {
      reviewCount = reviews.length;
      reviews.forEach(function(review) {
        totalRating += parseInt(review.rating);
      });
      establishment.establishment_ratings = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

      establishmentModel.findOneAndUpdate({ establishment_name: establishment.establishment_name }, { establishment_ratings: establishment.establishment_ratings }, { new: true }).then(function(updatedEstablishment) {
        establishmentUpdatedRating++;
        if (establishmentUpdatedRating === establishment.length) {
          console.log('All establishments ratings have been updated.');
        }
      }).catch(function(error) {
        console.error('Error updating establishment with rating:', error);
      });
    }).catch(function(error) {
      console.error('Error fetching reviews for establishment:', error);
    });
  });
}

// Function to generate a remember me token
function generateRememberMeToken() {
  const tokenLength = 32; 
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; 
  let token = '';

  for (let i = 0; i < tokenLength; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return token;
}

function addRoutes(server) {
  const router = express.Router();

  // route for search bar functionality
  router.get('/search', function(req, resp) {
    let key = req.query.key;
    console.log('\nCurrently searching ' + key);

    try {
      establishmentModel.find({
          $or: [
            { "establishment_name": { $regex: key, $options: "i" } },
            { "establishment_address": { $regex: key, $options: "i" } }
          ]
      }).lean().then(function(data) {
          resp.render('viewEstablishments', { 
            layout: 'index',
            establishment: data,
            key: key 
          });
      })
      .catch(function(error) {
        console.error(error);
      });
    } catch (error) {
        console.error(error);
    }
  });

  // route for non-user view homepage
  router.get('/', function (req, resp) {
    console.log('\nCurrently at Home Page');

    // calculate the date one week ago from the current date
    const oneWeekAgo = moment().subtract(7, 'days').toDate();
  
    // search query to find reviews posted in the past week
    const searchQuery = { date_posted: { $gte: oneWeekAgo } };
  
    reviewModel.find(searchQuery).lean().then(function (review_data) {
      const noRecentReviews = review_data.length === 0;

      resp.render('main', {
        layout: 'index',
        title: 'Cofeed',
        'review-data': review_data,
        currentUser: req.session.username,
        currentUserIcon: req.session.user_icon,
        noRecentReviews: noRecentReviews 
      });
    }).catch(function(error) {
      console.error('Error fetching reviews:', error);
      resp.redirect('/error');
    });
  });
    
  // route for registration page
  router.get('/registration', function (req, res) {
    console.log('\nCurrently at Registration Page');
    res.render('registration', {
      layout: 'index',
      title: 'Registration',
    });
  });

  // route for creating user in the database
  router.post('/create-user', function(req, resp) {
  const saltRounds = 10;

  userModel.findOne({ username: req.body.username }).then(existingUser => {
    if (existingUser) {
      return resp.status(400).json({ status: 'error', message: 'Username already exists. Please choose another one.' });
    }

    bcrypt.hash(req.body.password, saltRounds).then(function(hashedPassword) {
      const userInstance = userModel({
        name: req.body.name,
        username: req.body.username,
        bio: req.body.bio,
        email: req.body.email,
        password: hashedPassword,
        userType: 'rater', // force public registration to Role B only
        following: [],
        followers: []
      });

      return userInstance.save();
    })
    .then(function(user) {
      console.log('User created');
      req.session.username = user.username;
      req.session.name = user.name;
      req.session.user_icon = user.user_icon;
      req.session.userType = user.userType;
      resp.json({ success: true, message: 'User created successfully' });
    })
    .catch(function(error) {
      errorFn(error);
      resp.status(500).json({ status: 'error', message: 'Internal Server Error' });
    });
  });
});

  // route for registration page (choosing an avatar)
  router.get('/registrationAvatar', requireAuth, function (req, res) {
    console.log('\nCurrently choosing an avatar');
    const { username } = req.session; 
    const searchQuery = {};

    console.log('\nUser ', username);

    userModel.findOne({ username: username }).then(user =>{
      avatarModel.find(searchQuery).lean().then(function(avatars){
        res.render('registrationAvatar', {
          layout: 'index',
          title: 'Registration Avatar',
          username: username,
          user_icon: avatars
        });
      });
    });
  });

  // route for saving the avatar chosen by the user in the database
  router.post('/choose-avatar', requireAuth, function(req, res) {
    console.log('\nAvatar saved successfully');
    const { username } = req.session;
    const { user_icon } = req.body;


    userModel.findOne({ username: username }).then(user => {
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.user_icon = user_icon;

      return user.save();
    })
    .then(() => {
      console.log('Avatar saved for user:', username);
      res.json({ success: true, message: 'Avatar saved successfully'});
    })
    .catch(error => {
      console.error('Error saving avatar:', error);
      res.status(500).json({ success: false, message: 'Failed to save avatar' });
    });
  });

  router.post('/upload', (req, res) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            // Handle Multer errors
            return res.status(500).json({ error: err.message });
        } else if (err) {
            // Handle other errors
            return res.status(500).json({ error: err.message });
        }
        // File uploaded successfully
        res.json({ message: 'File uploaded successfully!' });
    });
  });

  // route for login page
  router.get('/login', function (req, res) {
    console.log('\nCurrently at Login Page');
    res.render('login', {
      layout: 'index',
      title: 'Login',
    });
  });
  // route for reading user from the database to login
router.post('/read-user', async function(req, resp) {
  try {
    const { username, password, rememberMe } = req.body;

    const user = await userModel.findOne({ username });

    if (!user) {
      return resp.json({ success: false, message: 'Invalid credentials' });
    }

    // CHECK IF ACCOUNT IS LOCKED
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return resp.json({
        success: false,
        message: 'Account is locked. Try again later.'
      });
    }
    user.lastLoginAttemptAt = new Date();
    const passwordMatch = await bcrypt.compare(password, user.password);

    // WRONG PASSWORD
    if (!passwordMatch) {
      user.loginAttempts += 1;
      user.lastLoginSuccess = false;

      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + (15 * 60 * 1000);

        await logAction(req, `Account locked: ${user.username}`);
      }

      await user.save();

      return resp.json({
        success: false,
        message: `Invalid credentials. ${5 - user.loginAttempts} attempts left`
      });
    }

    // SUCCESS LOGIN

    // RESET LOCK
    user.loginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    // 🔐 STORE PREVIOUS LOGIN INFO BEFORE OVERWRITING
    const lastLoginInfo = {
      time: user.lastLoginAttemptAt,
      success: user.lastLoginSuccess
    };

    // 🔐 UPDATE CURRENT LOGIN STATE
    user.lastLoginAt = new Date();
    user.lastLoginSuccess = true;
    user.loginAttempts = 0;
    user.lockUntil = null;

await user.save();
    // SESSION SETUP
    req.session.username = user.username;
    req.session.name = user.name;
    req.session.user_icon = user.userType === 'admin'
      ? '/images/admin-icon.png'
      : user.user_icon;
    req.session.userType = user.userType;

    // REMEMBER ME
    if (rememberMe === 'on') {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21;

      const rememberMeToken = generateRememberMeToken();
      user.rememberMeToken = rememberMeToken;
      user.rememberMeTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await user.save();

      resp.cookie('remember_me', rememberMeToken, {
        expires: moment().add(30, 'days').toDate(),
        httpOnly: true,
      });
    }

    await logAction(req, `User logged in: ${req.session.username}`);

    // REDIRECT
    if (user.userType === 'admin') {
      resp.json({ 
        success: true, 
        redirect: '/admin/dashboard',
        lastLoginInfo 
      });
    } else {
      resp.json({ 
        success: true, 
        redirect: '/landingPage',
        lastLoginInfo 
      });
    }

  } catch (error) {
    console.error(error);
    resp.status(500).json({ success: false });
  }
});

    // logout route
    router.get('/logout', function(req, res) {
      req.session.destroy(function(error) {
        if (error) {
          console.error('Error destroying session:', error);
          res.status(500).json({ success: false, message: 'Failed to logout' });
        } else {
          res.redirect('/');
        }
      });
    });

  // SHOW FORGOT PASSWORD PAGE
router.get('/forgotpassword', function (req, res) {
  res.render('forgotpassword', {
    layout: 'index',
    title: 'Password',
    isLoggedIn: !!req.session.username
  });
});

 router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: 'Email not found' });
    }

    // GENERATE OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ STORE IN SESSION INSTEAD OF DB
    req.session.resetOTP = otp;
    req.session.resetEmail = email;
    req.session.resetOTPExpires = Date.now() + (10 * 60 * 1000);

    console.log(`OTP for ${email}: ${otp}`);

    return res.json({
      success: true,
      message: 'OTP sent (check console)'
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.post('/verify-reset', async (req, res) => {
  const { email, otp, password } = req.body;

  const cleanOTP = String(otp).trim();

  // CHECK SESSION INSTEAD OF DB
  if (
    req.session.resetEmail !== email ||
    req.session.resetOTP !== cleanOTP ||
    req.session.resetOTPExpires < Date.now()
  ) {
    return res.json({ success: false, message: 'Invalid or expired OTP' });
  }

  // FIND USER AFTER VALIDATION
  const user = await userModel.findOne({ email });

if (!user) {
  return res.json({ success: false, message: 'User not found' });
}
  if (!user) {
    return res.json({ success: false, message: 'Invalid or expired OTP' });
  }
  // EMPTY CHECK
if (!password || password.trim().length === 0) {
  return res.json({
    success: false,
    message: 'Password cannot be empty'
  });
}

// PASSWORD COMPLEXITY (SAME AS REGISTRATION)
if (!PASSWORD_REGEX.test(password)) {
  return res.json({
    success: false,
    message: 'Password must contain uppercase, lowercase, number, and 8+ chars'
  });
}

  // PREVENT FREQUENT CHANGE (SAME AS CHANGE PASSWORD)
  if (user.passwordChangedAt) {
    const oneDay = 24 * 60 * 60 * 1000;
    const timeSinceLastChange = Date.now() - new Date(user.passwordChangedAt).getTime();

    if (timeSinceLastChange < oneDay) {
      return res.json({
        success: false,
        message: 'You can only change your password once every 24 hours'
      });
    }
  }

  // PASSWORD REUSE CHECK (SAME AS CHANGE PASSWORD)
  const isReused = await Promise.all(
    (user.passwordHistory || []).map(p => bcrypt.compare(password, p))
  );

  if (isReused.includes(true)) {
    return res.json({
      success: false,
      message: 'Cannot reuse previous passwords'
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);


  if (!user.passwordHistory) user.passwordHistory = [];

  user.passwordHistory.push(user.password);

  if (user.passwordHistory.length > 3) {
    user.passwordHistory.shift();
  }

  user.password = hashedPassword;
  user.passwordChangedAt = Date.now();

  await user.save();

  req.session.resetOTP = null;
  req.session.resetEmail = null;
  req.session.resetOTPExpires = null;

  await logAction(null, `Password reset with OTP: ${email}`);

  res.json({ success: true, message: 'Password reset successful' });
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await userModel.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.send("Invalid or expired token");
    }

    res.render('resetPassword', {
      layout: 'index',
      title: 'Reset Password'
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    const user = await userModel.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.json({ success: false, message: 'Invalid or expired token' });
    }

    // PREVENT FREQUENT PASSWORD CHANGE (1 DAY RULE)
    if (user.passwordChangedAt) {
      const oneDay = 24 * 60 * 60 * 1000;
      const timeSinceLastChange = Date.now() - new Date(user.passwordChangedAt).getTime();

      if (timeSinceLastChange < oneDay) {
        return res.json({
          success: false,
          message: 'You can only change your password once every 24 hours'
        });
      }
    }

    // PASSWORD COMPLEXITY
    if (!PASSWORD_REGEX.test(password)) {
      return res.json({
        success: false,
        message: 'Password must contain uppercase, lowercase, number, and 8+ chars'
      });
    }

    // PASSWORD REUSE CHECK
    const isReused = await Promise.all(
      (user.passwordHistory || []).map(p => bcrypt.compare(password, p))
    );

    if (isReused.includes(true)) {
      return res.json({
        success: false,
        message: 'Cannot reuse previous passwords'
      });
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // SAVE HISTORY
    if (!user.passwordHistory) user.passwordHistory = [];

    user.passwordHistory.push(user.password);
    if (user.passwordHistory.length > 3) {
      user.passwordHistory.shift();
    }

    user.password = hashedPassword;
    user.passwordChangedAt = Date.now();

    // CLEAR TOKEN
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    // SAFE LOG (no session user)
    await logAction(null, `Password reset via email: ${user.email}`);

    return res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.post('/change-password', requireAuth, async function(req, resp) {
  try {
    const { currentPassword, newPassword } = req.body;
    const username = req.session.username;

    const user = await userModel.findOne({ username });

    if (!user) {
      return resp.json({ success: false, message: 'User not found' });
    }

    // 🚫 PREVENT FREQUENT PASSWORD CHANGE (1 DAY RULE)
    if (user.passwordChangedAt) {
      const oneDay = 24 * 60 * 60 * 1000;
      const timeSinceLastChange = Date.now() - new Date(user.passwordChangedAt).getTime();

      if (timeSinceLastChange < oneDay) {
        return resp.json({
          success: false,
          message: 'You can only change your password once every 24 hours'
        });
      }
    }
    // VERIFY CURRENT PASSWORD
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return resp.json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // PASSWORD COMPLEXITY
    if (!PASSWORD_REGEX.test(newPassword)) {
      return resp.json({
        success: false,
        message: 'Password must contain uppercase, lowercase, number, and 8+ chars'
      });
    }

    // PASSWORD REUSE
    const isReused = await Promise.all(
      (user.passwordHistory || []).map(p => bcrypt.compare(newPassword, p))
    );

    if (isReused.includes(true)) {
      return resp.json({
        success: false,
        message: 'Cannot reuse previous passwords'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.passwordHistory.push(user.password);
    if (user.passwordHistory.length > 3) {
      user.passwordHistory.shift();
    }

    user.password = hashedPassword;
    user.passwordChangedAt = Date.now();

    await user.save();

    await logAction(req, `Password changed`);

    return resp.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (err) {
    console.error(err);
    resp.status(500).json({ success: false });
  }
});
  
router.get('/change-password-page', requireAuth, function (req, res) {
  res.render('changePassword', {
    layout: 'index',
    title: 'Change Password'
  });
});

  // route for user view homepage
  router.get('/landingPage', requireAuth, function (req, resp) {
    console.log('\nCurrently at Landing Page');
    const loggedInUser = req.session.username;
    const searchQuery = {username: loggedInUser};
    
    const oneWeekAgo = moment().subtract(7, 'days').toDate();
    
    const searchRatingQuery = { establishment_ratings: { $gte: 4, $lte: 5 } };

    userModel.findOne(searchQuery).lean().then(function(user_data) {
      if (!user_data) {
        console.log('User data not found.');
        resp.redirect('/error');
        return;
      }
      const followingList = user_data.following || [];
      const reviewSearchQuery = { date_posted: { $gte: oneWeekAgo }, username: { $in: followingList } };

      reviewModel.find({ reviewSearchQuery }).lean().then(function(review_data){
        establishmentModel.find(searchRatingQuery).sort({ establishment_ratings: 1 }).lean().then(function(establishment_data){
          const noRecentReviewsFromFriends = review_data.length === 0;
          resp.render('landingPage', {
            layout: 'index',
            title: 'Cofeed',
            'review-data': review_data,
            'establishment-data': establishment_data,
            currentUser: req.session.username,
            currentUserName: req.session.name,
            currentUserIcon: req.session.user_icon,
            currentUserType: req.session.userType,
            noRecentReviewsFromFriends: noRecentReviewsFromFriends
          });
        });
      }).catch(function(error) {
      });
    });
  });

  // route for view establishments
  router.get('/viewEstablishments', function(req, resp){
    console.log('\nCurrently at View Establishments Page');

    establishmentModel.find({}).lean().then(function(establishment_data){

      resp.render('viewEstablishments', {
        layout: 'index',
        title: 'Cofeed',
        establishment: establishment_data,
        headlineLocation: 'List of Establishments',
        currentUser: req.session.username,
        currentUserIcon: req.session.user_icon,
        currentUserType: req.session.userType
      });

    }).catch(err => {
      console.error(err);
      resp.status(500).send("Error loading establishments");
    });
  });

  // route for view establishments with filters
  router.post('/viewEstablishments', function(req, resp){
    console.log('\nFilters Applied');
    let searchQuery = {};
    let headlineLocation = '';

    // filter by price
    const priceRanges = req.body.price_range;
    if (priceRanges && priceRanges.length > 0) {
      searchQuery.price_range = { $in: priceRanges };
      console.log('\nCurrently searching establishments with price range: ', priceRanges);
    }

    // filter by services offered
    const servicesOffered = req.body.services_offered;
    if (servicesOffered && servicesOffered.length > 0) {
      searchQuery.services_offered = { $in: servicesOffered };
      console.log('\nCurrently searching establishments with services offered: ', servicesOffered);
    }

    // filter by area
    const selectedArea = req.body.area; 
    if (selectedArea) {
      searchQuery.establishment_address = selectedArea === 'metro' ? /Metro Manila/ : { $not: /Metro Manila/ };
      console.log('\nCurrently searching establishments in ', selectedArea);
    }

    // filter by location
    const location = req.body.location; 
    if (location) {
      searchQuery.establishment_address = { $regex: new RegExp(location, 'i') };
      console.log('\nCurrently searching establishments in ', location);
    }

    establishmentModel.find(searchQuery).lean().then(function(establishment_data){
      if (establishment_data.length === 0) {
        headlineLocation = 'No establishments found matching the criteria.';
        console.log('\nNo establishments found matching the filter applied');
      } else {
          establishment_data.forEach(function(establishment) {
            establishment.isMetro = establishment.establishment_address.includes('Metro Manila');
          });
  
          let isMetroEstablishmentPresent = false;
          let isNonMetroEstablishmentPresent = false;
  
          establishment_data.forEach(function(establishment) {
            if (establishment.isMetro) {
              isMetroEstablishmentPresent = true;
            } else {
              isNonMetroEstablishmentPresent = true;
            }
          });
  
          if (location) {
            headlineLocation = 'Establishments in ' + location;
          } else if (isMetroEstablishmentPresent && isNonMetroEstablishmentPresent) {
            headlineLocation = 'Establishments in Metro Manila and Outside Metro Manila';
            console.log('\nCurrently searching establishments both in Metro Manila and Outside Metro Manila');
          } else if (isMetroEstablishmentPresent) {
            headlineLocation = 'Establishments in Metro Manila';
          } else {
            headlineLocation = 'Establishments Outside Metro Manila';
          }
        
      }

      resp.render('viewEstablishments', {
        layout: 'index',
        title: 'Cofeed',
        establishment: establishment_data,
        headlineLocation: headlineLocation,
        currentUser: req.session.username,
        currentUserIcon: req.session.user_icon,
        currentUserType: req.session.userType
      });
    });  
  });

  // route for sorting establishments
  router.post('/sortEstablishments', function(req, resp){
    console.log('\nSorting Applied');
    const sortOption = req.body.sortOption;
    let sortQuery = {};
    let headlineLocation = '';

    if (sortOption === 'latest') {
      sortQuery = { establishment_name: 1 }; 
      headlineLocation = 'Browse Establishments Alphabetically';
    } else if (sortOption === 'rating-high') {
      sortQuery = { establishment_ratings: -1 }; 
      headlineLocation = 'Discover Highly Rated Establishments';
    } else if (sortOption === 'rating-low') {
      sortQuery = { establishment_ratings: 1 }; 
      headlineLocation = 'Discover Hidden Gems';
    }

    establishmentModel.find({}).sort(sortQuery).lean().then(function(establishment_data){
      resp.json({ establishment_data, headlineLocation });
    });    
  });

  // Route to create establishment (
router.post('/create-establishment',
  requireRole('owner', 'admin'),
  async (req, res) => {

  try {
    const {
      banner_image,
      establishment_name,
      establishment_address,
      establishment_description,
      price_range,
      services_offered,
      establishment_schedule,
      contact_details_FB,
      contact_details_IG,
      establishment_images,
      establishment_map
    } = req.body;

    const newEstablishment = new establishmentModel({
      banner_image,
      establishment_name,
      establishment_address,
      establishment_description,
      price_range,
      establishment_ratings: 0,

      services_offered: Array.isArray(services_offered)
        ? services_offered
        : services_offered ? services_offered.split(',') : [],

      establishment_schedule: Array.isArray(establishment_schedule)
        ? establishment_schedule
        : establishment_schedule ? establishment_schedule.split(',') : [],

      establishment_images: Array.isArray(establishment_images)
        ? establishment_images
        : establishment_images ? establishment_images.split(',') : [],

      contact_details_FB,
      contact_details_IG,
      establishment_map,

      // ✅ AUTO OWNER
      establishment_owner: req.session.name,
      owner_username: req.session.username
    });

    // 🔥 SAVE (NO .then)
    const est = await newEstablishment.save();

    // 🔥 AUDIT LOG (NOW WORKS)
    await logAction(req, `Created establishment: ${est.establishment_name}`);

    console.log("CREATED ESTABLISHMENT:", est);

    res.json({
      success: true,
      message: 'Establishment created successfully!',
      establishmentId: est._id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.get('/owner/establishments', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const establishments = req.session.userType === 'admin'
      ? await establishmentModel.find({}).lean()
      : await establishmentModel.find({ owner_username: req.session.username }).lean();

    res.render('ownerDashboard', {
      layout: 'index',
      establishments,
      currentUser: req.session.username
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading establishments');
  }
});

// =========================
// ADMIN ROUTES
// =========================

// Admin Dashboard
router.get('/admin/dashboard',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const users = await userModel.find().lean();
      const establishments = await establishmentModel.find().lean();
      const logs = await auditModel.find().sort({ timestamp: -1 }).lean();

    res.render('adminDashboard', {
      layout: 'index',
      users,
      establishments,
      logs, //THIS IS THE FIX
      currentUser: req.session.username,
      currentUserIcon: req.session.user_icon,
      currentUserType: req.session.userType
    });

    } catch (err) {
      console.error(err);
      res.status(500).send('Admin dashboard error');
    }
});

// Delete User (Admin only)
router.post('/admin/delete-user/:id',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const user = await userModel.findById(req.params.id);

      await userModel.findByIdAndDelete(req.params.id);

      await logAction(req, `Deleted user: ${user.username}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
});

// Admin creates admin or owner account
router.post('/admin/create-user',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { name, username, email, password, userType } = req.body;

      if (!name || !username || !email || !password || !userType) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      if (!['admin', 'owner'].includes(userType)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      const existingUser = await userModel.findOne({
        $or: [{ username }, { email }]
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await userModel.create({
        name,
        username,
        bio: '',
        email,
        password: hashedPassword,
        userType,
        following: [],
        followers: [],
        favoriteplace: [],
        createdreview: []
      });
      await logAction(req, `Created user: ${username} (${userType})`);
      return res.json({ success: true, message: 'User created successfully' });
      
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

// Admin changes a user's role
router.post('/admin/change-role',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { userId, newRole } = req.body;

      if (!userId || !newRole) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      if (!['admin', 'owner', 'rater'].includes(newRole)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      const user = await userModel.findById(userId);

      await userModel.findByIdAndUpdate(userId, { userType: newRole });
      await logAction(req, `Changed role of ${user.username} to ${newRole}`);

      return res.json({ success: true, message: 'Role updated successfully' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Failed to update role' });
    }
});

router.get('/admin/audit',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {

  try {
    const { user, role, action, startDate, endDate } = req.query;

    let filter = {};

    if (user) {
      filter.user = { $regex: user, $options: 'i' };
    }

    if (role) {
      filter.role = role;
    }

    if (action) {
      filter.action = { $regex: action, $options: 'i' };
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await auditModel
      .find(filter)
      .sort({ timestamp: -1 })
      .lean();

    res.render('audit', {
      layout: 'index',
      logs,
      currentUser: req.session.username,
      currentUserType: req.session.userType
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Audit page error');
  }
});

async function checkOwnership(req, res, next) {
  try {
    // ✅ allow admin immediately
    if (req.session.userType === 'admin') {
      return next();
    }

    const est = await establishmentModel.findById(req.params.establishmentId).lean();

    if (!est) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (est.owner_username !== req.session.username) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    return next();

  } catch (err) {
    console.error('Ownership check error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

    // read establishment
    router.get('/establishment/:name', function (req, resp) {
      const establishmentName = req.params.name;
      const establishmentSearchQuery = { establishment_name: establishmentName };
      const reviewSearchQuery = { place_name: establishmentName};
      const ratingFilter = req.query.rating;
      console.log('\nCurrently at Establishment Page: ' + establishmentName);
      console.log('Username:', req.session.username);
      
      establishmentModel.findOne(establishmentSearchQuery).lean().then(function(establishment_data) {
        reviewModel.find(reviewSearchQuery).lean().then(function(review_data){
          if (!establishment_data) {
            console.log('Establishment data not found.');
            resp.redirect('/error');
            return;
          }

          const reviewCount = review_data.length;

          if (ratingFilter) {
            review_data = review_data.filter(review => review.rating.toString() === ratingFilter);
          }

          const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          
          review_data.forEach(function (review) {
            ratingDistribution[review.rating]++;
          });

          console.log('Rating Distribution:', ratingDistribution);

          //console.log('Establishment Data:', establishment_data);
          //console.log('Review Data: ', review_data);
          const isOwnerOfThisEstablishment =
          req.session.userType === 'admin' ||
          establishment_data.owner_username === req.session.username;

          resp.render('establishment', {
            layout: 'index',
            title: establishmentName,
            reviewData: review_data,
            establishment: establishment_data,
            reviewCount: reviewCount,
            currentUser: req.session.username,
            currentUserIcon: req.session.user_icon,
            currentUserType: req.session.userType,
              // ✅ ADD THIS
            isOwner: req.session.userType === 'owner' || req.session.userType === 'admin',
            isOwnerOfThisEstablishment: isOwnerOfThisEstablishment,
            selectedRatingFilter: ratingFilter,
            establishmentRating: establishment_data.establishment_ratings,
            ratingDistribution: JSON.stringify(ratingDistribution)
          });
        });
      });
    });


  // Route for editing establishment details
router.post('/edit-establishment/:establishmentId',
  requireRole('owner', 'admin'),
  checkOwnership,
  async (req, res) => {

  try {
    const updated = await establishmentModel.findByIdAndUpdate(
      req.params.establishmentId,
      req.body,
      { new: true }
    );

    await logAction(req, `Edited establishment: ${updated.establishment_name}`);


    res.json({ success: true, updated });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

router.post('/delete-establishment/:establishmentId',
  requireRole('owner', 'admin'),
  checkOwnership,
  async (req, res) => {

  try {
    const est = await establishmentModel.findById(req.params.establishmentId);

    await establishmentModel.findByIdAndDelete(req.params.establishmentId);

    await logAction(req, `Deleted establishment: ${est.establishment_name}`);

    res.json({ success: true });
  
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


  // AAAAAAA ESTAB SAVES TO FAVORITES !!!!!!! TIME CHECK 2:18AM
  router.post('/add-to-favorites', requireAuth, function(req, res) {
    try {
      console.log('Request body:', req.body); 
  
      // retrieve the establishment name from the request body
      const establishment_name = req.body.establishment_name;
      console.log('Establishment name:', establishment_name);
  
      const username = req.session.username;
      console.log('Username:', username);
  
      // find the user document in the database
      userModel.findOne({ username }).then(function(user) {
          console.log('User found:', user);
  
          // check if the user exists
          if (!user) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
          }
  
          // update the user's favorite establishments
          if (!user.favoriteplace.includes(establishment_name)) {
            user.favoriteplace.push(establishment_name);
            console.log('Favorite place added:', establishment_name);
            return user.save();
          } else {
            // establishment already in favorites
            console.log('Establishment is already a favorite.');
            return Promise.reject({ success: false, message: 'Establishment is already a favorite.' });
          }
        })
        .then(function() {
          return res.json({ success: true, message: 'Added to favorites!' });
        })
        .catch(function(error) {
          console.error('Error:', error);
          return res.status(500).json({ success: false, message: 'An error occurred' });
        });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ success: false, message: 'An error occurred' });
    }
  });
  
  // route for writing a review
  router.post('/submit-review',
  requireAuth,
  upload.single('review_photo'),
  async function(req, res) {

  try {
    const { rating, review_title, place_name, caption } = req.body;
    const review_photo = req.file ? req.file.filename : null;

    console.log('Uploaded file:', req.file);

    const newReview = new reviewModel({
      user_photo: req.session.user_icon,
      display_name: req.session.name,
      username: req.session.username,
      rating,
      review_photo: './uploads/' + review_photo,
      review_title,
      place_name,
      caption,
      date_posted: new Date()
    });

    // ✅ SAVE REVIEW
    await newReview.save();

    // ✅ UPDATE USER REVIEWS
    await userModel.findOneAndUpdate(
      { username: req.session.username },
      { $push: { createdreview: { review_photo, place_name, review_title } } }
    );

    // 🔥 AUDIT LOG
    await logAction(req, `Posted review on: ${place_name}`);

    console.log('\nReview submitted');

    // ✅ UPDATE RATINGS
    const establishment_data = await establishmentModel.find({ establishment_name: place_name }).lean();
    calculateAndUpdateRatings(establishment_data);

    res.json({
      success: true,
      message: 'Review submitted successfully!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request.'
    });
  }
});

  // route for edit review 
  router.post('/edit-review/:reviewId',
  requireAuth,
  async function(req, res) {

    const review = await reviewModel.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ success: false });
    }

    if (
      review.username !== req.session.username &&
      req.session.userType !== 'admin'
    ) {
      return res.status(403).json({ success: false });
    }

    const updated = await reviewModel.findByIdAndUpdate(
      req.params.reviewId,
      {
        review_title: req.body.review_title,
        caption: req.body.caption,
        rating: req.body.rating
      },
      { new: true }
    );

    res.json({ success: true, updated });
});

  // Route to post comment
  router.post('/submit-comment', requireAuth, (req, res) => {
    
    const { reviewId, comment } = req.body;

    reviewModel.findByIdAndUpdate(reviewId, {
        $push: {
            comments: {
                user_icon: req.session.user_icon,
                username: req.session.username,
                comment: comment,
            }
        }
    }, { new: true })
    .then(review => {
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        const newComment = {
            user_icon: req.session.user_icon,
            username: req.session.username,
            comment: comment
        };

        res.json({ success: true, newComment: newComment });
    })
    .catch(error => {
        console.error('Error submitting comment:', error);
        res.status(500).json({ success: false, message: 'Error submitting comment' });
    });
});


  // route for profile
  router.get('/profile/:name', function (req, resp) {
    if (req.session.userType === 'admin') {
      return resp.redirect('/admin/dashboard');
    }

    const userName = req.params.name;
    const searchQuery = { username: userName };
    console.log('\nCurrently at Profile Page of ' + userName);
  
    const loggedInUser = req.session.username;

    userModel.findOne(searchQuery).lean().then(function(user_data) {
      if (!user_data) {
        console.log('User data not found.');
        resp.redirect('/error');
        return;
      }

    const followingList = user_data.following || [];
    const followerList = user_data.followers || [];

    console.log("\nFOLLOWING: " +followingList);
    console.log("\nFOLLOWERS: " +followerList);

    const reviewSearchQuery = {username : user_data.username};

    userModel.find({username : {$in : followingList}}).lean().then(function(following_data){
      userModel.find({username : {$in : followerList}}).lean().then(function(follower_data){
        reviewModel.find(reviewSearchQuery).lean().then(function(review_data) {
          const favoritePlaces = user_data.favoriteplace || []; 
          const establishmentSearchQuery = { establishment_name: { $in: favoritePlaces } };
          
          establishmentModel.find(establishmentSearchQuery).lean().then(function(establishment_data){
            
            const isOwnProfile = user_data.username === req.session.username;
            const isFollowing = loggedInUser && user_data.followers.includes(loggedInUser);
    
            const favoritePlacesCount = favoritePlaces.length;
            const createdReviewCount = review_data.length;
            const noFavoritePlaces = favoritePlacesCount === 0;
            const noCreatedReviews = createdReviewCount === 0;
    
            // console.log('User Data:', user_data);
            // console.log('Establishment Data:', establishment_data);
            resp.render(isOwnProfile ? 'myProfile' : 'profile', {
              layout: 'index',
              title: user_data.name,
              'user-data': user_data,
              'establishment-data': establishment_data,
              'review-data': review_data,
              currentUser: req.session.username,
              currentUserIcon: req.session.user_icon,
              user: user_data,
              following : following_data,
              followers : follower_data,
              isFollowing: isFollowing,
              favoritePlacesCount: favoritePlacesCount,
              createdReviewCount: createdReviewCount,
              noFavoritePlaces: noFavoritePlaces,
              noCreatedReviews: noCreatedReviews
            });
          });
        });
      })
    })

    
    }).catch(errorFn);
  });

  // route to follow a user
  router.post('/follow/:username', requireAuth, async function(req, res) {
    try {
        const loggedInUser = req.session.username;
        const usernameToFollow = req.params.username;

        const updateLoggedInUser = userModel.findOneAndUpdate(
            { username: loggedInUser },
            { $addToSet: { following: usernameToFollow } }, // Add to following list
            { new: true }
        );

        const updateFollowedUser = userModel.findOneAndUpdate(
            { username: usernameToFollow },
            { $addToSet: { followers: loggedInUser } }, // Add to following list
            { new: true }
        );

        const [loggedInUserUpdated, followedUserUpdated] = await Promise.all([updateLoggedInUser, updateFollowedUser]);

        if (!loggedInUserUpdated || !followedUserUpdated) {
            return res.status(404).send('User not found.');
        }

        if (loggedInUserUpdated.following.length === 0) {
          await userModel.findOneAndUpdate(
              { username: loggedInUser },
              { following: [] } // Set following list to empty array
          );
      }

        res.send(loggedInUserUpdated);
    } catch (err) {
        console.error('Error following user:', err);
        res.status(500).send('Error following user.');
    }
  });

  // route to unfollow a user
  router.post('/unfollow/:username', requireAuth, async function(req, res) {
    try {
        const loggedInUser = req.session.username;
        const usernameToUnfollow = req.params.username;

        const updateLoggedInUser = userModel.findOneAndUpdate(
            { username: loggedInUser },
            { $pull: { following: usernameToUnfollow } }, // Remove from following list
            { new: true }
        );

        const updateUnfollowedUser = userModel.findOneAndUpdate(
            { username: usernameToUnfollow },
            { $pull: { followers: loggedInUser } }, // Remove from followers list
            { new: true }
        );

        const [loggedInUserUpdated, unfollowedUserUpdated] = await Promise.all([updateLoggedInUser, updateUnfollowedUser]);

        if (!loggedInUserUpdated || !unfollowedUserUpdated) {
            return res.status(404).send('User not found.');
        }

        if (unfollowedUserUpdated.followers.length === 0) {
          await userModel.findOneAndUpdate(
              { username: usernameToUnfollow },
              { followers: [] } 
          );
        }

        if (loggedInUserUpdated.following.length === 0) {
          await userModel.findOneAndUpdate(
              { username: loggedInUser },
              { following: [] } // Set following list to empty array
          );
      }

        res.send(loggedInUserUpdated);
    } catch (err) {
        console.error('Error unfollowing user:', err);
        res.status(500).send('Error unfollowing user.');
    }
  });

  // route for updating user's information on profile page
  router.post('/update-user', requireAuth, upload.single('user_icon'), function(req, resp) {
    const updateQuery = { username: req.session.username };
    

    userModel.findOne(updateQuery).then(function(user) {
      // if user found
      if (user && user._id) {
        const { name, username, bio, password } = req.body;
        const icon = req.file ? req.file.filename : null;
        console.log('Uploaded file:', req.file);
        console.log('Uploaded filename:', icon);

        // Hash the password
        bcrypt.hash(password, 10, function(err, hashedPassword) {
          if (err) {
            console.error('Error hashing password:', err);
            return resp.status(500).json({ success: false, message: 'Failed to update user information' });
          }

          // updating user information
          const oldUsername = user.username; 
          user.name = name;
          user.username = username;
          user.bio = bio;
          user.user_icon = './uploads/' + icon;

          // saving the updated user information
          user.save().then(function(result) {
            req.session.username = user.username;
            req.session.user_icon = user.user_icon;
            req.session.userType = user.userType;

            // update reviewData with new username
            const reviewUpdateQuery = { username: oldUsername }; // Find reviews by old username
            const reviewUpdateFields = { username: username }; // Update username to new username
            reviewModel.updateMany(reviewUpdateQuery, { $set: reviewUpdateFields }).then(function(reviewUpdateResult) {
              console.log('Reviews updated with new username:', reviewUpdateResult);
              // Redirect to profile page after updating both user and reviews
              return resp.redirect('/profile/' + user.username);
            }).catch(function(reviewError) {
              console.error('Error updating reviews:', reviewError);
              return resp.status(500).json({ success: false, message: 'Failed to update reviews' });
            });
          }).catch(function(error) {
            console.error('Error saving user:', error);
            return resp.status(500).json({ success: false, message: 'Failed to update user information' });
          });
        });
      } else {
        return resp.status(404).json({ success: false, message: 'User not found' });
      }
    }).catch(function(error) {
      console.error('Error finding user:', error);
      return resp.status(500).json({ success: false, message: 'Internal Server Error' });
    });
  });

  //router to remove establishment from user'sfavorites
  router.post('/remove-from-favorites', function(req, res) {
    try {
      console.log('Request body:', req.body); 

      // Retrieve the establishment name from the request body
      const establishment_name = req.body.establishment_name;
      console.log('Establishment name:', establishment_name);

      const username = req.session.username;
      console.log('Username:', username);

      // Find the user document in the database
      userModel.findOne({ username }).then(function(user) {
          console.log('User found:', user);

          // Check if the user exists
          if (!user) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
          }

          // Update the user's favorite establishments
          const index = user.favoriteplace.indexOf(establishment_name);
          if (index !== -1) {
            user.favoriteplace.splice(index, 1);
            console.log('Favorite place removed:', establishment_name);
            return user.save();
          } else {
            // Establishment not found in favorites
            console.log('Establishment not found in favorites.');
            return Promise.reject({ success: false, message: 'Establishment not found in favorites.' });
          }
        })
        .then(function() {
          return res.json({ success: true, message: 'Removed from favorites!' });
        })
        .catch(function(error) {
          console.error('Error:', error);
          return res.status(500).json({ success: false, message: 'An error occurred' });
        });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ success: false, message: 'An error occurred' });
    }
  });

  //router to delete a review
  router.post('/remove-review', requireAuth, async (req, res) => {
    try {
        const reviewPhoto = req.body.review_photo;

        // Delete the review
        const deletedReview = await reviewModel.findOneAndDelete({ review_photo: reviewPhoto });

        if (!deletedReview) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // Remove the review from the createdreview array in user data
        await userModel.updateMany(
            {},
            { $pull: { createdreview: { review_photo: reviewPhoto } } }
        );

        return res.json({ success: true, message: 'Review removed successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

  return router;
}

module.exports = {
  addRoutes: addRoutes,
};