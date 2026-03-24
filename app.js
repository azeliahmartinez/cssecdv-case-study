// command prompt (node js)
// npm init
// npm i express express-handlebars body-parser mongoose express-session bcrypt moment
// node app.js -- after, check the browser --> localhost:3000

// command prompt (git)
// git pull
// git add .
// git commit -m "message"
// git push origin main

// express
const express = require('express');
const server = express();

// bodyparser
const bodyParser = require('body-parser');
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// handlebars
const handlebars = require('express-handlebars');

server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
  extname: 'hbs',
  helpers: {
    // helper to compare two values
    eq: function (arg1, arg2) {
      // pang debug lang
      console.log('arg1:', arg1);
      console.log('arg2:', arg2);

      // compare
      const result = arg1 === arg2;

      // check if true or false yung pag compare
      console.log('Comparison result:', result);

      return result;
  }
},
}));

// Define the isFollowingUser helper function
function isFollowingUser(loggedInUser, targetUser, options) {
  if (!loggedInUser || !loggedInUser.following) {
      // Handle undefined cases
      return options.inverse(this);
  }

  // Logic to check if loggedInUser follows targetUser
  const isFollowing = loggedInUser.following.includes(targetUser);
  return isFollowing ? options.fn(this) : options.inverse(this);
}

// Include the helper in your Handlebars engine configuration
server.engine(
  'hbs',
  handlebars.engine({
      extname: 'hbs',
      helpers: {
          eq: function (arg1, arg2) {
              // Helper logic for eq
              return arg1 === arg2;
          },
          isFollowingUser: isFollowingUser, // Include the isFollowingUser helper here
      },
  })
);

// manage user sessions
const session = require('./controllers/sessionController');
server.use(session);

// routes
const routes = require('./controllers/routes');
server.use('/', routes.addRoutes(server));

// public folder
server.use(express.static('public'));

// mongoose
const mongoose = require('mongoose');
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI);

mongoose.connection.on('connected', () => {
  console.log('\nDatabase connected successfully\n');
  importedFiles.length = 0;
  importJSONFilesToDB();
});

mongoose.connection.on('error', (err) => {
  console.error('Database connection error:', err);
});

// database models
const userModel = require('./models/User');
const reviewModel = require('./models/Review');
const establishmentModel = require('./models/Establishment');
const avatarModel = require('./models/Avatar');

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

// hashing passwords
const bcrypt = require('bcrypt');
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// loading json files into the db
const fs = require('fs');
const path = require('path');
const modelsFolder = path.join(__dirname, 'models');

// array to keep track of imported files
const importedFiles = [];

// function to compare items based on uniqueness 
function compareItems(existingItem, newItem, itemType) {
  switch (itemType) {
    case 'userData':
      return existingItem.username === newItem.username;
    case 'reviewData':
      const existingDate = new Date(existingItem.date_posted).toISOString();
      const newDate = new Date(newItem.date_posted).toISOString();
      return (
        existingItem.username === newItem.username &&
        existingItem.place_name === newItem.place_name &&
        existingDate === newDate
      );
    case 'establishmentData':
      return existingItem.establishment_name === newItem.establishment_name;
    case 'avatarData':
      return existingItem.user_icon === newItem.user_icon;
    default:
      return false;
  }
}

// function to import json files to db
function importJSONFilesToDB() {
  try {
    const files = fs.readdirSync(modelsFolder);
    const fileCount = files.length;
    let processedFiles = 0;

    files.forEach(function (file) {
      if (file.endsWith('.json') && !importedFiles.includes(file)) {
        importedFiles.push(file); 
        const filePath = path.join(modelsFolder, file);
        const data = require(filePath);
        let model;
        if (file.startsWith('user')) {
          data.forEach(function (user) {
            user.password = hashPassword(user.password);
          });
          model = userModel;
        } else if (file.startsWith('review')) {
          model = reviewModel;
        } else if (file.startsWith('establishment')) {
          model = establishmentModel;
        } else if (file.startsWith('avatar')) {
          model = avatarModel;
        }

        model.find().then(function (existingData) {
          const newData = data.filter(function (newItem) {
            return !existingData.some(function (existingItem) {
              return compareItems(existingItem, newItem, file.split('.')[0]);
            });
          });

          console.log(`\nNew data for ${file}:`);
          if (newData.length > 0) {
            model.create(newData).then(function () {
              console.log(`Data from ${file} imported successfully.`);
              processedFiles++;
              if (processedFiles === fileCount) {
                establishmentModel.find({}).lean().then(function(establishment_data){
                  calculateAndUpdateRatings(establishment_data);
                }).catch(function(error) {
                  console.error('Error fetching establishments:', error);
                });
                console.log('\nAll JSON files imported successfully.');
              }
            }).catch(function (err) {
              console.error(`Error importing data from ${file}:`, err);
            });
          } else {
            console.log(`No new data to import from ${file}.`);
            processedFiles++;
            if (processedFiles === fileCount) {
              console.log('\nAll JSON files imported successfully.');
            }
          }
        }).catch(function (err) {
          console.error(`Error finding existing data for ${file}:`, err);
        });
      } else {
        processedFiles++;
        if (processedFiles === fileCount) {
          console.log('\nAll JSON files imported successfully.');
        }
      }
    });
  } catch (err) {
    console.error('Error reading models folder:', err);
  }
}

// closing the database
function finalClose() {
  console.log('\nClose connection at the end!');
  mongoose.connection.close();
  process.exit();
}

process.on('SIGTERM', finalClose);  //general termination signal
process.on('SIGINT', finalClose);   //catches when ctrl + c is used
process.on('SIGQUIT', finalClose); //catches other termination commands

const port = process.env.PORT | 3000;
server.listen(port, function () {
  console.log('\nListening at port ' + port);
});