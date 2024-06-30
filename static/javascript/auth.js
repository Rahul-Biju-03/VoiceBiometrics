var usernamePointer = document.querySelector('#usernamePointer');
var passwordPointer = document.querySelector('#passwordPointer');
var authToggle = document.querySelector('#authToggle');
var passwordField = document.querySelector('#passwordField');
var togglePasswordIcon = document.querySelector('.toggle-password');
var passwordInput = document.querySelector('#password-field');

usernamePointer.style.display = 'none';
passwordPointer.style.display = 'none';

authToggle.addEventListener('change', function () {
  if (authToggle.checked) {
    passwordField.style.display = 'block'; // Show password field
  } else {
    passwordField.style.display = 'none'; // Hide password field
  }
});

window.onload = function (event) {
  document.querySelector('#mainForm').addEventListener('keydown', function (event) {
    if (event.keyCode === 13) {
      document.querySelector('#nextButton').click();
    }
  });

  togglePasswordIcon.addEventListener('click', function () {
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
    } else {
      passwordInput.type = 'password';
    }
  });

  document.querySelector('#nextButton').addEventListener('click', function () {
    var us = document.querySelector('input[name="username"]').value;
    var pass = document.querySelector('input[name="password"]').value;
    var isPasswordAuth = authToggle.checked;

    var loginCreds = {
      username: us,
      password: pass,
      isPasswordAuth: isPasswordAuth
    };

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        console.log("Response : ", xhr.response);
        
        if (xhr.status == 404) {
          usernamePointer.style.display = '';
        } else if (xhr.status == 401) {
          passwordPointer.style.display = '';
          window.location.href = '/auth_result?auth=fail';
        } else if (xhr.status == 200) {
          if (isPasswordAuth) {
            window.location.href = '/auth_result?auth=success';
          } else {
            window.location.href = '/voice';
          }
        }
      }
    };

    xhr.open("POST", "/auth", true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.send(JSON.stringify(loginCreds));
    console.log("Your http message has been sent.");
    console.log("You clicked the login Next button");
  });
};
