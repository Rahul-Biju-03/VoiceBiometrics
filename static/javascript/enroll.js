var usernamePointer = document.querySelector('#usernamePointer');
var passwordPointer = document.querySelector('#passwordPointer');
var repasswordPointer = document.querySelector('#repasswordPointer');

usernamePointer.style.display = 'none';
passwordPointer.style.display = 'none';
repasswordPointer.style.display = 'none';

var togglePasswordIcons = document.querySelectorAll('.toggle-password');

togglePasswordIcons.forEach(function (icon) {
  icon.addEventListener('click', function () {
    var input = document.querySelector(icon.getAttribute('toggle'));
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.toggle('fa-eye');
      icon.classList.toggle('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.toggle('fa-eye');
      icon.classList.toggle('fa-eye-slash');
    }
  });
});

window.onload = function (event) {
  document.querySelector('#mainForm').addEventListener('keydown', function (event) {
    if (event.keyCode === 13) {
      document.querySelector('#nextButton').click();
    }
  });

  function isValidUsername(username) {
    var pattern = /^[a-zA-Z0-9.\-_$@*!]{3,30}$/;
    return pattern.test(username);
  }

  function validateCredentialsFormat(loginCreds) {
    var passedCheck = true;
    var passwordField = document.querySelector('#passwordField');
    var repasswordField = document.querySelector('#repasswordField');
    var userField = document.querySelector('#userField');

    if (loginCreds.password.length < 6) {
      passwordPointer.style.display = '';
      passwordField.classList.add('error');
      passedCheck = false;
    } else {
      passwordField.classList.remove('error');
      passwordPointer.style.display = 'none';
    }

    if (loginCreds.repassword !== loginCreds.password) {
      repasswordPointer.style.display = '';
      repasswordField.classList.add('error');
      passedCheck = false;
    } else {
      repasswordPointer.style.display = 'none';
      repasswordField.classList.remove('error');
    }

    if (!isValidUsername(loginCreds.username)) {
      usernamePointer.style.display = '';
      userField.classList.add('error');
      passedCheck = false;
    } else {
      usernamePointer.style.display = 'none';
      userField.classList.remove('error');
    }

    return passedCheck;
  }

  document.querySelector('#nextButton').addEventListener('click', function () {
    var us = document.querySelector('input[name="username"]').value;
    var pass = document.querySelector('input[name="password"]').value;
    var repass = document.querySelector('input[name="repassword"]').value;

    var loginCreds = {
      username: us,
      password: pass,
      repassword: repass
    };

    if (validateCredentialsFormat(loginCreds)) {
      console.log("Valid Credentials have been entered ...\n Proceeding to sending data");

      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
          console.log("(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)")
          window.location.href = '/voice';
        }
      }

      xhr.open("POST", "/enroll", true);
      xhr.setRequestHeader("Content-type", "application/json");
      xhr.send(JSON.stringify(loginCreds));

      console.log("Your http message has been sent.");
    } else {
      console.log("Invalid credentials have been entered ...\nPlease try again ...");
    }

    console.log("username : ", us);
    console.log("password : ", pass);
    console.log("repassword : ", repass);
    console.log("You clicked the login Next button");
  });
};
