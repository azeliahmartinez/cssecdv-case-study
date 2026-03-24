document.addEventListener("DOMContentLoaded", function() {
    var closeButton = document.querySelector(".close-button");
    if (closeButton) {
        closeButton.addEventListener("click", hideEstablishmentWidget);
    }
});


// function to show logout dropdown in header
function toggleOptions(event) {
    const dropdown = event.target.nextElementSibling;
    dropdown.classList.add("show");
}

// function when logging out
function logout() {
    window.location.href = "/logout";
}

// function to redirect to someone's profile
function redirectToProfile(userName) {
    window.location.href = '/profile/' + encodeURIComponent(userName);
}

// function to show the edit widget
function showEditWidget() {
    var editWidget = document.getElementById("edit-widget");
    editWidget.style.display = "block";
}

// function to hide the edit widget
function hideEditWidget() {
    var editWidget = document.getElementById("edit-widget");
    editWidget.style.display = "none";
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