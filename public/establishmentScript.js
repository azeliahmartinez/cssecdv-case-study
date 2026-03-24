document.addEventListener("DOMContentLoaded", function() {
  
  // stars for establishment_ratings
  var starRatingContainers = document.querySelectorAll(".star-rating-container");
  starRatingContainers.forEach(function(container) {
    var establishmentRating = parseFloat(container.dataset.rating);
    var fullStars = Math.floor(establishmentRating);
    var hasHalfStar = establishmentRating - fullStars >= 0.5;

    var starsHtml = '';
    for (var i = 0; i < fullStars; i++) {
      starsHtml += '<span class="fa fa-star checked"></span>';
    }
    if (hasHalfStar) {
      starsHtml += '<span class="fa fa-star-half-o checked"></span>';
    }
    for (var j = 0; j < 5 - Math.ceil(establishmentRating); j++) {
      starsHtml += '<span class="fa fa-star"></span>';
    }

    container.querySelector('.star-rating').innerHTML = starsHtml;
  });

  // progress bar for reviews
  var reviewCount = parseInt(document.getElementById('progressBars').dataset.reviewCount);
  var ratingDistribution = JSON.parse(document.getElementById('progressBars').dataset.ratingDistribution);
  var progressBarsContainer = document.getElementById('progressBars');

  for (var rating = 5; rating >= 1; rating--) {
    var progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');
    var width = (ratingDistribution[rating] || 0) / reviewCount * 100;
    progressBar.style.width = width + '%';

    var stars = '';
    for (var i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars += '<span class="progress-star fa fa-star checked"></span>';
      } else {
        stars += '<span class="progress-star fa fa-star"></span>';
      }
    }
    var reviewText = '(' + (ratingDistribution[rating] || 0) + ')';
    progressBar.innerHTML = stars + ' ' + reviewText;

    progressBarsContainer.appendChild(progressBar);
  }

  // Set the Create Post's date to the current date
  let today = new Date();
  let formattedDate = formatDate(today);

  document.querySelector("input#post-date").value = formattedDate;
  updateStarRatings();

  // add to favorite establishment
  const favoriteButtons = document.querySelectorAll('.favorite');
  favoriteButtons.forEach(button => {
    button.addEventListener('click', function(event) {
      const establishment_name = event.target.dataset.establishment_name;
      addToFavorites(establishment_name);
    });
  });

  // writing a review
  const reviewForm = document.getElementById('post-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', submitReview);
  }

  // edit review form
  const editreviewForms = document.querySelectorAll('[id^="editForm-"]');
  editreviewForms.forEach(function(form) {
    form.addEventListener('submit', function(event) {
      const reviewId = this.dataset.reviewId;

      if (editreviewForms) {
        event.preventDefault();
      }
    });
  });

  document.querySelectorAll('.review-rating .fa-star').forEach(function(star) {
    star.addEventListener('click', function() {
        const rating = parseInt(this.getAttribute('data-rating'));
        highlightStars(rating);
    });
  });
  
  initStarRatings(); //write review star rating 
  initEditReviewStars();

   document.querySelectorAll('.post-comment-button').forEach(button => {
    button.addEventListener('click', function() {
        const reviewContainer = this.closest('.comment-box');
        const reviewId = reviewContainer.getAttribute('data-review-id'); 
        const commentInput = reviewContainer.querySelector('.comment-input');

        if (commentInput.value.trim() === '') {
            alert('Comment cannot be empty.');
            return;
        }

        submitComment(reviewId, commentInput.value);
        commentInput.value = ''; // Clear the input field after submitting
    });
    });
  
  });

  function createEstablishment() {
    const form = document.getElementById('create-establishment-form');
    const formData = new FormData(form);
    
    fetch('/create-establishment', {
      method: 'POST',
      body: new URLSearchParams(formData)
    })
    .then(response => response.json())
    .then(data => {
      if(data.success) {
        // Redirect to the new establishment page
        window.location.href = data.redirect;
      } else {
        alert(data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
    
    return false;
  }
  

// function to add establishment to current user's favorites
function addToFavorites(establishment_name) {
  fetch('/add-to-favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ establishment_name }),
  })
  .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add to favorites. Please try again.');
      }
      return response.json();
  })
  .then(data => {
      console.log(data);
      if (data.success) {
        alert('Added to favorites!');
      } else {
        alert(data.message);
      }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('An error occurred while processing your request.');
  });
}

// initialize write review star rating
function initStarRatings() {
  const writeReviewStars = document.querySelectorAll('.write-review-rating .fa');
  writeReviewStars.forEach(star => {
    star.addEventListener('click', function(e) {
      updateStars(writeReviewStars, e.target.dataset.rating);
    });
  });
}

// initialize edit review star rating
function initEditReviewStars() {
  const editReviewStars = document.querySelectorAll('.edit-review-rating .fa');
  editReviewStars.forEach(star => {
    star.addEventListener('click', function(e) {
      updateStars(editReviewStars, e.target.dataset.rating);
    });
  });
}


function updateStars(starSet, ratingValue) {
  starSet.forEach((star, index) => {
    if (index < ratingValue) {
      star.classList.add('highlighted');
    } else {
      star.classList.remove('highlighted');
    }
  });
}

// function to expand text area
function autoExpand(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// write a review date
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Add this function to reload the photo preview when the page loads
window.onload = function() {
  const photoPreview = document.getElementById('photo-preview');
  const reviewPhoto = "{{review_photo}}"; 

  if (reviewPhoto) {
      const img = photoPreview.querySelector('.review-photo');
      img.src = '/uploads/' + reviewPhoto;
  }
}

// Function to preview the selected photo
function previewPhoto(event) {
  const fileInput = event.target;
  const photoPreview = document.getElementById('photo-preview');

  photoPreview.innerHTML = '';

  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();

    reader.onload = function (e) {
      
      const previewImage = document.createElement('img');
      previewImage.setAttribute('src', e.target.result);
      previewImage.setAttribute('alt', 'Preview');
      previewImage.classList.add('preview-image');

      photoPreview.prepend(previewImage);
    };

    reader.readAsDataURL(fileInput.files[0]);
  }
}

// function to redirect to establishment page when the respective name is clicked
function redirectToEstablishment(establishmentName) {
  window.location.href = '/establishment/' + encodeURIComponent(establishmentName);
}

// function to update star rating in the review section
function updateStarRatings() {
  
  // Target only review ratings
  const ratingContainers = document.querySelectorAll('.dynamic-star-rating');
  ratingContainers.forEach(container => {
    const rating = parseInt(container.getAttribute('data-rating'), 10);
    container.innerHTML = getStarsHTML(rating);
  });
}

// function to display the rating number to stars from review
function getStarsHTML(rating) {
  let starsHTML = '';
  for (let i = 1; i <= 5; i++) {
    starsHTML += i <= rating ? '<span class="fa fa-star checked"></span>' : '<span class="fa fa-star"></span>';
  }
  return starsHTML;
}

// function when filtering reviews by its ratings
function applyRatingFilter(rating) {
  window.location.href = window.location.pathname + '?rating=' + rating;
}

// function to handle write a review
function submitReview() {
  const formData = new FormData();
  const fileInput = document.getElementById('photo-upload').files[0];
  const review_title = document.getElementById('review-title').value;
  const place_name = document.getElementById('review-location').value;
  const caption = document.getElementById('review-description').value;
  const rating = getStarRating();
  const reviewsCountElement = document.getElementById('reviews-count');

  if (rating === 0) {
      alert('Please select a star rating.');
      return;
  }

  formData.append('review_photo', fileInput);
  formData.append('review_title', review_title);
  formData.append('place_name', place_name);
  formData.append('caption', caption);
  formData.append('rating', rating);

  fetch('/submit-review', {
      method: 'POST',
      body: formData
  })
  .then(response => {
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      return response.json();
  })
  .then(data => {
      if (data && data.success) {
          alert(data.message);

          if (reviewsCountElement) {
              const newReviewCount = parseInt(reviewsCountElement.innerText.split(' ')[0]) + 1;
              reviewsCountElement.innerText = newReviewCount + ' reviews';
          }
      } else {
          alert('Failed to create review: ' + data.message);
      }
  })
  .catch(error => {
      console.error('Error submitting review:', error);
  });
}


// function to highlight selected stars in writing a review
function highlightStars(rating) {
  const stars = document.querySelectorAll('.review-rating .fa-star');
  stars.forEach(function(star, index) {
      if (index < rating) {
        star.classList.add('checked');
      } else {
        star.classList.remove('checked');
      }
  });
}

// function to retrieve the selected star rating in writing a review
function getStarRating() {
  const stars = document.querySelectorAll('.review-rating .fa-star.checked');
  return stars.length; 
}

// function to post comment asynchronously
function submitComment(reviewId) {
  const commentInput = document.querySelector('.comment-input');
  const comment = commentInput.value;

  const formData = { reviewId, comment };

  fetch('/submit-comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Comment posted successfully!');
      appendCommentToUI(data.newComment);
      commentInput.value = ''; 
    } else {
      alert('Failed to submit comment: ' + (data.message || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error submitting comment:', error);
    alert('An error occurred while submitting the comment.');
  });
}


// function to display the comment data in the comment section template
function appendCommentToUI(comment) {
  // commentSection (review_partial.hbs) is the container where comments are displayed.
  const commentSection = document.getElementById('commentSection');


  const commentDiv = document.createElement('div');
  commentDiv.classList.add('user-profile-establishment');


  const img = document.createElement('img');
  img.src = comment.user_icon;
  img.alt = 'User Icon';
  commentDiv.appendChild(img);


  const profileTextDiv = document.createElement('div');
  profileTextDiv.classList.add('profile-text');


  const usernameSpan = document.createElement('span');
  usernameSpan.classList.add('username');
  usernameSpan.textContent = comment.username;
  profileTextDiv.appendChild(usernameSpan);


  const commentSpan = document.createElement('span');
  commentSpan.classList.add('comment-box');
  commentSpan.textContent = comment.comment;
  profileTextDiv.appendChild(commentSpan);


  commentDiv.appendChild(profileTextDiv);

  commentSection.appendChild(commentDiv);
}


// function to show edit review widget
function showEditReviewWidget(reviewId) {
  const editWidget = document.getElementById(`edit-widget-${reviewId}`);
  editWidget.style.display = 'block';
}

// function to hide edit review widget
function hideEditReviewWidget(reviewId) {
  const editWidget = document.getElementById(`edit-widget-${reviewId}`);
  editWidget.style.display = "none";;
}

// function to edit review
function editReview(reviewId) {
  const review_title = document.getElementById('review_title').value;
  const caption = document.getElementById('caption').value;

  fetch(`/edit-review/${reviewId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      review_title: review_title,
      caption: caption
  })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data && data.success) {
      alert(data.message);
      hideEditReviewWidget(reviewId);
    } else {
      alert('Failed to edit review: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error editing review:', error);
  });
}

// Function to update establishment details via AJAX
function editEstablishment(establishmentId) {
  // Retrieve updated establishment details from form inputs
  const establishmentName = document.getElementById('establishment_name').value;
  const establishmentAddress = document.getElementById('establishment_address').value;
  const establishmentDescription = document.getElementById('establishment_description').value;

  fetch(`/edit-establishment/${establishmentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      establishment_name: establishmentName,
      establishment_address: establishmentAddress,
      establishment_description: establishmentDescription
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Establishment details updated successfully!');
      const newUrl = window.location.href.replace(/establishment\/[^/]+/, `establishment/${establishmentName}`);
      history.pushState({}, '', newUrl);
      
      window.location.reload();
    } else {
      alert('Failed to update establishment details: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error updating establishment details:', error);
    alert('An error occurred while updating establishment details.');
  });
}

// function to show the create establishment widget
function showEstablishmentWidget() {
  var establishmentWidget = document.getElementById("create-establishment-widget");
  establishmentWidget.style.display = "block";
}

// function to hide the create establishment widget
function hideEstablishmentWidget() {
  var establishmentWidget = document.getElementById("create-establishment-widget");
  establishmentWidget.style.display = "none";
}