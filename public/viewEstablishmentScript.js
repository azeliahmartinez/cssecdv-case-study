document.addEventListener("DOMContentLoaded", function() {
  
  // ⭐ STAR DISPLAY
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

  // 📊 PROGRESS BARS
  const progressBars = document.getElementById('progressBars');
  if (progressBars) {
    var reviewCount = parseInt(progressBars.dataset.reviewCount);
    var ratingDistribution = JSON.parse(progressBars.dataset.ratingDistribution);

    for (var rating = 5; rating >= 1; rating--) {
      var progressBar = document.createElement('div');
      progressBar.classList.add('progress-bar');

      var width = (ratingDistribution[rating] || 0) / reviewCount * 100;
      progressBar.style.width = width + '%';

      var stars = '';
      for (var i = 1; i <= 5; i++) {
        stars += i <= rating
          ? '<span class="fa fa-star checked"></span>'
          : '<span class="fa fa-star"></span>';
      }

      progressBar.innerHTML = stars + ` (${ratingDistribution[rating] || 0})`;
      progressBars.appendChild(progressBar);
    }
  }

  // 📅 DATE AUTO
  let today = new Date();
  document.querySelector("#post-date")?.value = formatDate(today);

  updateStarRatings();
  initStarRatings();
  initEditReviewStars();

  // ⭐ CLICK RATING
  document.querySelectorAll('.review-rating .fa-star').forEach(star => {
    star.addEventListener('click', function() {
      highlightStars(parseInt(this.dataset.rating));
    });
  });

});


// =========================
// 🏢 CREATE ESTABLISHMENT
// =========================
function createEstablishment() {
  const form = document.getElementById('create-establishment-form');
  const formData = new FormData(form);

  fetch('/create-establishment', {
    method: 'POST',
    body: new URLSearchParams(formData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      window.location.href = '/owner/establishments';
    } else {
      alert(data.message);
    }
  })
  .catch(err => console.error(err));

  return false;
}


// =========================
// ✏️ EDIT ESTABLISHMENT
// =========================
function editEstablishment(establishmentId) {
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
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Updated successfully!');
      location.reload();
    } else {
      alert('Update failed');
    }
  })
  .catch(err => console.error(err));
}


// =========================
// 🗑 DELETE ESTABLISHMENT
// =========================
function deleteEstablishment(id) {
  if (!confirm("Are you sure you want to delete this establishment?")) return;

  fetch(`/delete-establishment/${id}`, {
    method: "POST"
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert("Deleted successfully!");
      window.location.href = "/owner/establishments";
    } else {
      alert("Delete failed");
    }
  })
  .catch(err => console.error(err));
}


// =========================
// ⭐ REVIEW SYSTEM
// =========================
function submitReview() {
  const formData = new FormData();
  const fileInput = document.getElementById('photo-upload').files[0];

  formData.append('review_photo', fileInput);
  formData.append('review_title', document.getElementById('review-title').value);
  formData.append('place_name', document.getElementById('review-location').value);
  formData.append('caption', document.getElementById('review-description').value);
  formData.append('rating', getStarRating());

  fetch('/submit-review', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert("Review posted!");
      location.reload();
    }
  })
  .catch(err => console.error(err));
}


// =========================
// ⭐ STAR HELPERS
// =========================
function highlightStars(rating) {
  document.querySelectorAll('.review-rating .fa-star').forEach((star, index) => {
    star.classList.toggle('checked', index < rating);
  });
}

function getStarRating() {
  return document.querySelectorAll('.review-rating .fa-star.checked').length;
}


// =========================
// 🧰 UTILITIES
// =========================
function formatDate(date) {
  return date.toISOString().slice(0, 16);
}

function redirectToEstablishment(name) {
  window.location.href = '/establishment/' + encodeURIComponent(name);
}


// =========================
// 🪟 MODALS
// =========================
function showEstablishmentWidget() {
  document.getElementById("create-establishment-widget").style.display = "block";
}

function hideEstablishmentWidget() {
  document.getElementById("create-establishment-widget").style.display = "none";
}