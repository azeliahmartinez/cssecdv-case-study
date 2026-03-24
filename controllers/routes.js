const express = require('express');
const sessionController = require('./sessionController');
const userModel = require('../models/User');
const reviewModel = require('../models/Review');
const establishmentModel = require('../models/Establishment');
const avatarModel = require('../models/Avatar');
const bcrypt = require('bcrypt');
const moment = require('moment');
const multer = require('multer');
const path = require('path');

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
        fileSize: 1024 * 1024 * 15 // 5MB max file size
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

    const userSearchQuery = {};

      userModel.find(userSearchQuery).lean().then(function(user_data){
      // Hash passwords before sending data to the client
      user_data.forEach(user => {
          user.password = hashPassword(user.password);
      });

      // Now user_data contains hashed passwords
      res.json(user_data);
  }).catch(err => {
      console.error('Error:', err);
      res.status(500).send('Internal Server Error');
  });
  
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
          userType: req.body.userType,
          following: [], 
          followers: []
        });

        return userInstance.save();
      })
      .then(function(user) {
        console.log('User created');
        req.session.username = req.body.username;
        req.session.name = req.body.name;
        resp.json({ success: true, message: 'User created successfully' });
      })
      .catch(function(error) {
        errorFn(error);
        resp.status(500).json({ status: 'error', message: 'Internal Server Error' });
      });
    });
  });

  // route for registration page (choosing an avatar)
  router.get('/registrationAvatar', function (req, res) {
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
  router.post('/choose-avatar', function(req, res) {
    console.log('\nAvatar saved successfully');
    const { username } = req.session;
    const { user_icon } = req.body;

    if (!username) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

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
  router.post('/read-user', function(req, resp) {
    try {
      const { username, password, rememberMe } = req.body; 

      console.log("\nREMEMBER ME CHECKED? " + rememberMe);

      userModel.findOne({ username }).then(function(user) {
        console.log("\nFinding user: ", username);

        if (user) {
          bcrypt.compare(password, user.password).then(function(passwordMatch) {
            if (passwordMatch) {
              req.session.username = user.username;
              req.session.name = user.name;
              req.session.user_icon = user.user_icon;
              req.session.userType = user.userType;
              if (rememberMe === 'on') {
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // sets expiry of user login (in seconds)
                const rememberMeToken = generateRememberMeToken();
                user.rememberMeToken = rememberMeToken;
                user.rememberMeTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
                user.save();

                resp.cookie('remember_me', rememberMeToken, {
                  expires: moment().add(30, 'days').toDate(), 
                  httpOnly: true,
                });
              }
              console.log("\nUser ", req.session.username, " Found");
              console.log("User Type:", req.session.userType);
              resp.json({ success: true });
            } else {
              console.log("\nPasswords do not match for user: ", username);
              resp.json({ success: false });
            }
          });
        } else {
          console.log("\nUser not found: ", username);
          resp.json({ success: false });
        }
      }).catch(function(error) {
        console.error("Error finding user:", error);
        resp.status(500).json({ success: false, error: "Internal Server Error" });
      });
    } catch (error) {
      console.error("Error processing login:", error);
      resp.status(500).json({ success: false, error: "Internal Server Error" });
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

  // route for getting forgot password page
  router.get('/forgotpassword', function (req, res) {
    console.log('\nCurrently at Forgot Password Page');
    res.render('forgotpassword', {
      layout: 'index',
      title: 'Forgot Password',
    });
  });

  // route for updating the database of new password when forgotten
  router.post('/forgot-password', function(req, resp) {
    const { username, newPassword } = req.body;
    const saltRounds = 10; 

    bcrypt.hash(newPassword, saltRounds).then(function(hashedPassword) {
        userModel.findOne({ username }).then(function(user) {
            if (user) {
              user.password = hashedPassword;
              return user.save();
            } else {
              console.log("\nUser not found with username: ", username);
              return Promise.reject({ success: false, message: 'Username not found' });
            }
          })
          .then(function(updatedUser) {
            console.log("\nPassword updated successfully for user: ", updatedUser.username);
  
            req.session.username = updatedUser.username;
            req.session.user_icon = updatedUser.user_icon;
            req.session.userType = updatedUser.userType;
            console.log("\nUser ", req.session.username, " Found");
            console.log("User Type:", req.session.userType);
            console.log("\n");
            resp.json({ success: true, message: 'Password updated successfully' });
          })
          .catch(function(error) {
            errorFn(error);
            resp.status(500).json({ status: 'error', message: 'Internal Server Error' });
          });
      })
      .catch(function(error) {
        errorFn(error);
        resp.status(500).json({ status: 'error', message: 'Internal Server Error' });
      });
  });
  
  // route for user view homepage
  router.get('/landingPage', isLoggedIn, function (req, resp) {
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
    const searchQuery = {};
    let headlineLocation = 'List of Establishments';

    establishmentModel.find(searchQuery).lean().then(function(establishment_data){
      establishment_data.forEach(function(establishment) {
        establishment.isMetro = establishment.establishment_address.includes('Metro Manila');
      });

      resp.render('viewEstablishments', {
        layout: 'index',
        title: 'Cofeed',
        establishment: establishment_data,
        headlineLocation: headlineLocation,
        currentUser: req.session.username,
        currentUserIcon: req.session.user_icon
      });
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
        currentUserIcon: req.session.user_icon
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

  // Route to create establishment (not fully functioning)
  router.post('/create-establishment', (req, res) => {
    const {
      banner_image,
      establishment_name,
      establishment_address,
      establishment_description,
      price_range,
      establishment_ratings,
      services_offered,
      establishment_schedule,
      contact_details_FB,
      contact_details_IG,
      establishment_images,
      establishment_map,
      establishment_owner,
      owner_username,
    } = req.body;

    const newEstablishment = new establishmentModel({
      banner_image,
      establishment_name,
      establishment_address,
      establishment_description,
      price_range,
      establishment_ratings,
      services_offered: services_offered.split(','), // If they are comma-separated in the form
      establishment_schedule: establishment_schedule.split(','),
      contact_details_FB,
      contact_details_IG,
      establishment_images: establishment_images.split(','),
      establishment_map,
      establishment_owner,
      owner_username,
    });

    newEstablishment.save()
      .then(establishment => {
        const establishmentUrl = `/establishment/${encodeURIComponent(establishment.establishment_name)}`;
        res.json({ success: true, message: 'Establishment created successfully!', establishmentId: establishment._id });
      })
      .catch(error => {
        console.error('Error creating establishment:', error);
        res.status(500).json({ success: false, message: 'An error occurred while creating the establishment.' });
      });
  });
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
          resp.render('establishment', {
            layout: 'index',
            title: establishmentName,
            reviewData: review_data,
            establishment: establishment_data,
            reviewCount: reviewCount,
            currentUser: req.session.username,
            currentUserIcon: req.session.user_icon,
            currentUserType: req.session.userType,
            selectedRatingFilter: ratingFilter,
            establishmentRating: establishment_data.establishment_ratings,
            ratingDistribution: JSON.stringify(ratingDistribution)
          });
        });
      });
    });


  // Route for editing establishment details
  router.post('/edit-establishment/:establishmentId', (req, res) => {
    const establishmentId = req.params.establishmentId;
    const updatedEstablishmentName = req.body.establishment_name;
    const updatedEstablishmentAddress = req.body.establishment_address;
    const updatedEstablishmentDescription = req.body.establishment_description;

    // Find the establishment by its ID and update its details
    establishmentModel.findByIdAndUpdate(establishmentId, {
      establishment_name: updatedEstablishmentName,
      establishment_address: updatedEstablishmentAddress,
      establishment_description: updatedEstablishmentDescription
    }, { new: true })
      .then(updatedEstablishment => {
        if (!updatedEstablishment) {
          return res.status(404).json({
            success: false,
            message: 'Establishment not found'
          });
        }

        console.log("\nEstablishment updated with establishment ID:", establishmentId);
        
        // Update the reviews with the new establishment name
        return reviewModel.updateMany({ place_name: updatedEstablishment.establishment_name }, { $set: { place_name: updatedEstablishmentName } })
          .then(() => {
            res.json({ success: true });
          })
          .catch(error => {
            console.error('Error updating reviews:', error);
            res.status(500).json({
              success: false,
              message: 'Error updating reviews'
            });
          });
      })
      .catch(error => {
        console.error('Error updating establishment:', error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });
  });


  // AAAAAAA ESTAB SAVES TO FAVORITES !!!!!!! TIME CHECK 2:18AM
  router.post('/add-to-favorites', function(req, res) {
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
  router.post('/submit-review', upload.single('review_photo'), function(req, res){
    try {
        const { rating, review_title, place_name, caption } = req.body;
        const review_photo = req.file ? req.file.filename : null;
        console.log('Uploaded file:', req.file);
        console.log('Uploaded filename:', review_photo);
        
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

      newReview.save().then(() => {
        return userModel.findOneAndUpdate(
        { username: req.session.username },
        { $push: { createdreview: { review_photo, place_name, review_title } } }
        );
      })
      .then(() => {
        console.log('\nReview submitted');
        establishmentModel.find({ establishment_name: place_name }).lean().then(function(establishment_data){
          calculateAndUpdateRatings(establishment_data);
        }).catch(function(error) {
          console.error('Error fetching establishments:', error);
          res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
        });
        res.json({ success: true, message: 'Review submitted successfully!' });
      })
      .catch(error => {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
    }
  });

  // route for edit review 
  router.post('/edit-review/:reviewId', function(req, res) {
    const reviewId = req.params.reviewId;
    const updatedTitle = req.body.review_title;
    const updatedDescription = req.body.caption;
    const updatedRating = req.body.rating;

    // Update the review in the database
    reviewModel.findByIdAndUpdate(reviewId, {
        review_title: updatedTitle,
        caption: updatedDescription,
        rating: updatedRating
    }, { new: true })
    .then(updatedReview => {
        res.json({ success: true, message: 'Review edited successfully!' });
    })
    .catch(error => {
        console.error('Error editing review:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing your request.' });
    });
  });

  // Route to post comment
  router.post('/submit-comment', (req, res) => {
    
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
  router.post('/follow/:username', async function(req, res) {
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
  router.post('/unfollow/:username', async function(req, res) {
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
  router.post('/update-user', upload.single('user_icon'), function(req, resp) {
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
  router.post('/remove-review', async (req, res) => {
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