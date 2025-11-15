'use strict';

(function () {
  const page = document.body.dataset.page;

  if (page === 'verify') {
    initVerifyPage();
  } else if (page === 'login') {
    initLoginPage();
  } else if (page === 'mark') {
    initMarkAttendancePage();
  }

  function initVerifyPage() {
    const form = document.querySelector('#verify-form');
    const inputs = Array.from(document.querySelectorAll('.code-inputs input'));
    const errorBox = document.querySelector('#verify-error');
    const submitButton = form.querySelector('button[type="submit"]');

    inputs.forEach((input, index) => {
      input.addEventListener('input', (event) => {
        const value = event.target.value.replace(/[^0-9]/g, '');
        event.target.value = value.slice(-1);
        if (value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = inputs.map((input) => input.value).join('');
      if (code.length !== 6) {
        showError('Please enter all six digits.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Verifying…';

      try {
        const response = await fetch('/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const payload = await response.json();
        if (payload.success) {
          window.location.href = '/login';
        } else {
          showError(payload.error || 'Invalid code.');
          inputs.forEach((input) => {
            input.value = '';
          });
          inputs[0].focus();
        }
      } catch (error) {
        showError('Network error. Please retry.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Verify code';
      }
    });

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
      setTimeout(() => {
        errorBox.hidden = true;
      }, 4000);
    }
  }

  function initLoginPage() {
    const form = document.querySelector('#login-form');
    const errorBox = document.querySelector('#login-error');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in…';

      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const payload = await response.json();
        if (payload.success) {
          window.location.href = '/mark-attendance';
        } else {
          showError(payload.error || 'Unable to sign in.');
        }
      } catch (error) {
        showError('Network error. Please retry.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Sign in and continue';
      }
    });

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
  }

  function initMarkAttendancePage() {
    const button = document.querySelector('#mark-button');
    const errorBox = document.querySelector('#mark-error');

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Recording…';
      errorBox.hidden = true;

      try {
        const response = await fetch('/mark-attendance', { method: 'POST' });
        const payload = await response.json();
        if (payload.success) {
          window.location.href = '/success';
        } else {
          showError(payload.error || 'Unable to record attendance.');
        }
      } catch (error) {
        showError('Network error. Please retry.');
      } finally {
        button.disabled = false;
        button.textContent = 'Confirm attendance';
      }
    });

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
  }
})();
