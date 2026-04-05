document.addEventListener("DOMContentLoaded", function() {
    var closeButton = document.querySelector(".close-button");
    if (closeButton) {
        closeButton.addEventListener("click", hideEstablishmentWidget);
    }

    const avatarForm = document.getElementById("avatarForm");
    if (avatarForm) {
        avatarForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const selectedAvatar = document.querySelector('input[name="user_icon"]:checked');

            if (!selectedAvatar) {
                alert("Please choose an avatar first.");
                return;
            }

            try {
                const response = await fetch("/choose-avatar", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        user_icon: selectedAvatar.value
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert(data.message || "Avatar saved successfully!");
                    window.location.href = "/landingPage";
                } else {
                    alert(data.message || "Failed to save avatar.");
                }
            } catch (error) {
                console.error("Error saving avatar:", error);
                alert("An error occurred while saving your avatar.");
            }
        });
    }
});


// function to show logout dropdown in header
function toggleOptions(event) {
    event.stopPropagation();

    const button = event.currentTarget;
    const dropdown = button.nextElementSibling;

    if (!dropdown) return;

    document.querySelectorAll(".avatar-dropdown-content").forEach(menu => {
        if (menu !== dropdown) {
            menu.classList.remove("show");
        }
    });

    dropdown.classList.toggle("show");
}

document.addEventListener("click", function () {
    document.querySelectorAll(".avatar-dropdown-content").forEach(menu => {
        menu.classList.remove("show");
    });
});

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