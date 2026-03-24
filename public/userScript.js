// function to make password visible or not
function togglePasswordVisibility(passwordFieldId, toggleIconId) {
    let passwordField = document.getElementById(passwordFieldId);
    let toggleIcon = document.getElementById(toggleIconId);

    if (passwordField.type === "password") {
        passwordField.type = "text";
        toggleIcon.src = "https://i.imgocean.com/eye-openf95409e2a49605ae.png";
    } else {
        passwordField.type = "password";
        toggleIcon.src = "https://i.imgocean.com/eye-close6c91a6ac25495e1f.png";
    }
}

// function when submitting the form of a new registered user
function submitForm() {
    let nameString = document.forms["create-user"]["name"].value;
    let emailString = document.forms["create-user"]["email"].value;
    let usernameString = document.forms["create-user"]["username"].value;
    let bioString = document.forms["create-user"]["bio"].value;
    let pass1String = document.forms["create-user"]["password"].value;
    let pass2String = document.forms["create-user"]["password2"].value;
    let userType = document.querySelector('input[name="userType"]:checked').value;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

    if (nameString.length < 1) {
        alert("Name cannot be empty");
        return false;
    } else if (emailString.length < 1) {
        alert("Email cannot be empty");
        return false;
    } else if (usernameString.length < 1) {
        alert("Username cannot be empty");
        return false;
    } else if (pass1String !== pass2String) {
        alert("Passwords do not match!");
        return false;
    }

    if (!passwordRegex.test(pass1String)) {
        alert("Password must contain at least 8 characters, including at least one uppercase letter, one lowercase letter, and one number.");
        return false;
    }

    // making a POST request to the server to create a new user
    fetch('/create-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nameString,
            username: usernameString,
            bio: bioString,
            email: emailString,
            password: pass1String,
            userType: userType
        })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;        
        } else {
            return response.json(); // parsing the JSON response
        }
    })
    .then(data => {
        if (data && data.success) {
            alert(data.message);
            window.location.href = 'registrationAvatar';
        } else {
            alert('Failed to create user: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while creating the user.');
    });

    return false;
}

// function to submit the form and choose an avatar for the user
function submitAvatarForm(currentUser) {
    let selectedAvatarURL = document.querySelector('input[name="avatar"]:checked').value;

    fetch('/choose-avatar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: currentUser,
            user_icon: selectedAvatarURL
        })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;        
        } else {
            return response.json(); // parsing the JSON response
        }
    })
    .then(data => {
        if (data && data.success) {
            alert(data.message);
            window.location.href = 'login'; 
        } else {
            alert('Failed to choose avatar: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while choosing the avatar.');
    });

    return false;
}

// function when submitting the form of a user logging in
function submitLoginForm() {
    let usernameString = document.getElementById("username-field").value;
    let passString = document.getElementById("password-field").value;
    let rememberMe = document.getElementById("remember-me").checked;

    if (usernameString.length < 1) {
        alert("Username cannot be empty");
        return false;
    } else if (passString.length < 1) {
        alert("Password cannot be empty");
        return false;
    }

    // making a POST request to the server to log in
    fetch('/read-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: usernameString,
            password: passString,
            rememberMe: rememberMe ? 'on' : 'off'
        })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;        
        } else {
            return response.json(); // parsing the JSON response
        }
    })
    .then(data => {
        if (data && data.success) {
            window.location.href = 'landingPage';
        } else {
            alert('username and password do not match');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while creating the user.');
    });

    return false;
}

// function when submitting form for forgotten new password
function submitForgotPasswordForm() {
    let usernameString = document.getElementById("username-field").value;
    let passString = document.getElementById("password-field").value;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    
    if (usernameString.length < 1) {
        alert("Username cannot be empty");
        return false;
    } else if (passString.length < 1) {
        alert("Password cannot be empty");
        return false;
    }

    if (!passwordRegex.test(passString)) {
        alert("Password must contain at least 8 characters, including at least one uppercase letter, one lowercase letter, and one number.");
        return false;
    }

    // making a POST request to the server to update password
    fetch('/forgot-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: usernameString,
            password: passString
        })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;        
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.success) {
            alert(data.message);
            window.location.href = 'landingPage';
        } else {
            alert(data.message); 
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while updating the password.');
    });

    return false;
}

// profile page script 

// function when updating user information
function updatingUserForm() {
    let nameString = document.getElementById("name-field").value;
    let usernameString = document.getElementById("username-field").value;
    let bioString = document.getElementById("bio-field").value;
    let passString = document.getElementById("password-field").value;
    let iconString = document.getElementById("photo-upload").value;

    // making a POST request to the server to update password
    fetch('/update-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nameString,
            username: usernameString,
            bio: bioString,
            password: passString,
            password2: passString,
            user_icon: iconString
        })
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;        
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (data && data.success) {
            sessionStorage.setItem('username', usernameString);
            alert(data.message);
            updateProfilePage(data.userData);
            hideEditProfileWidget();
        } else {
            alert(data.message); 
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });

    return false;
}

// function to show followers list
function showFollowers() {
    let followersWidget = document.getElementById("followers-widget");
    followersWidget.classList.toggle("visible");
}

// function to hide followers list
function hideFollowers() {
    let followersWidget = document.getElementById("followers-widget");
    followersWidget.classList.remove("visible");
}

// function to show following list
function showFollowing() {
    let followingWidget = document.getElementById("following-widget");
    followingWidget.classList.toggle("visible");
}

// function to hide following list
function hideFollowing() {
    let followingWidget = document.getElementById("following-widget");
    followingWidget.classList.remove("visible");
}

// function to show list of reviewed places
function showListReview() {
    let listReviewWidget = document.getElementById("listreview-widget");
    listReviewWidget.classList.toggle("visible");
}

// function to hide list of reviewed places
function hideListReview() {
    let listReviewWidget = document.getElementById("listreview-widget");
    listReviewWidget.classList.remove("visible");
}

// function to update profile page with new data
function updateProfilePage(userData) {
    document.getElementById("name-field").innerText = userData.name;
    document.getElementById("username-field").innerText = userData.username;
    document.getElementById("bio-field").innerText = userData.bio;
}

// 
function unlikeWidget(establishmentName) {
    // Confirm action with the user (optional)
    if (confirm('Are you sure you want to remove this from favorites?')) {
        // Send AJAX request to remove from favorites
        fetch('/remove-from-favorites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ establishment_name: establishmentName }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Response from server:', data);
            if (data.success) {
                // Reload the page upon successful removal from favorites
                window.location.reload();
            } else {
                alert('Failed to remove from favorites: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while removing from favorites.');
        });
    }
}


// function to follow a user
function followUser(username) {
    fetch(`/follow/${username}`, { method: 'POST' })
    .then(response => {
        if (response.ok) {
            updateFollowUI(true);
            alert(`You followed ${username}`);
        } else {
            console.error('Error following user:', response.statusText);
        }
    })
    .catch(error => console.error('Error following user:', error));
}

// function to unfollow a user
function unfollowUser(username) {
    fetch(`/unfollow/${username}`, { method: 'POST' })
    .then(response => {
        if (response.ok) {
            updateFollowUI(false);
            alert(`You unfollowed ${username}`);
        } else {
            console.error('Error unfollowing user:', response.statusText);
        }
    })
    .catch(error => console.error('Error unfollowing user:', error));
}

// function to update UI after following/unfollowing
function updateFollowUI(isFollowing) {
    const followBtnContainer = document.getElementById('follow-btn-container');
    if (isFollowing) {
        followBtnContainer.innerHTML = '<button id="unfollow-btn" onclick="unfollowUser()">Unfollow</button>';
    } else {
        followBtnContainer.innerHTML = '<button id="follow-btn" onclick="followUser()">Follow</button>';
    }
}

function removeReview(reviewPhoto) {
    if (confirm('Are you sure you want to delete this review?')) {
        fetch('/remove-review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ review_photo: reviewPhoto }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Reload the page upon successful review removal
                window.location.reload();
            } else {
                alert('Failed to remove review!');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while removing review.');
        });
    }
}





