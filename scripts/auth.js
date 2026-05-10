// Shared auth validation for the static Saver prototype.
// This keeps login/register behavior consistent until a real backend is added.

(function () {
  const form = document.querySelector("[data-auth-form]");
  if (!form) return;

  const formType = form.dataset.authForm;
  const submitButton = form.querySelector("button[type='submit']");
  const googleButton = document.querySelector("[data-google-auth]");

  const rules = {
    login: [
      ["email", validateEmail],
      ["password", validatePassword],
    ],
    register: [
      ["fullName", validateName],
      ["email", validateEmail],
      ["password", validatePassword],
      ["confirmPassword", validatePasswordMatch],
      ["terms", validateTerms],
    ],
  };

  function field(name) {
    return form.querySelector(`[name="${name}"]`);
  }

  function value(name) {
    const input = field(name);
    return input ? input.value.trim() : "";
  }

  function validateName() {
    return value("fullName").length >= 2 ? "" : "Please enter your full name.";
  }

  function validateEmail() {
    const email = value("email");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Please enter a valid email address.";
  }

  function validatePassword() {
    return value("password").length >= 8 ? "" : "Password must be at least 8 characters.";
  }

  function validatePasswordMatch() {
    return value("password") === value("confirmPassword") ? "" : "Passwords do not match.";
  }

  function validateTerms() {
    const terms = field("terms");
    return terms && terms.checked ? "" : "Please accept the terms to continue.";
  }

  function setError(input, message) {
    const wrapper = input.closest("[data-field]") || input.parentElement;
    const error = wrapper.querySelector("[data-error]");

    input.style.boxShadow = message ? "0 0 0 2px #ba1a1a" : "";

    if (error) {
      error.textContent = message;
      error.classList.toggle("hidden", !message);
    }
  }

  function setStatus(message, isError = false) {
    const status = form.querySelector("[data-form-status]");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("hidden", !message);
    status.classList.toggle("text-error", isError);
    status.classList.toggle("text-primary-container", !isError);
  }

  function validateForm() {
    let firstInvalid = null;
    let valid = true;

    for (const [name, validator] of rules[formType] || []) {
      const input = field(name);
      if (!input) continue;

      const message = validator();
      setError(input, message);

      if (message && !firstInvalid) {
        firstInvalid = input;
        valid = false;
      }
    }

    if (firstInvalid) firstInvalid.focus();
    return valid;
  }

  form.addEventListener("input", (event) => {
    const input = event.target;
    if (!input.name) return;

    const activeRule = (rules[formType] || []).find(([name]) => name === input.name);
    if (!activeRule) return;

    setError(input, activeRule[1]());

    if (input.name === "password" && field("confirmPassword")?.value) {
      setError(field("confirmPassword"), validatePasswordMatch());
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("");

    if (!validateForm()) {
      setStatus("Fix the highlighted fields and try again.", true);
      return;
    }

    localStorage.setItem("saverUserEmail", value("email"));
    if (value("fullName")) localStorage.setItem("saverUserName", value("fullName"));

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = formType === "register" ? "Creating account..." : "Logging in...";
    }

    setStatus("Looks good. Taking you to verification...");
    const destination = formType === "register" ? "verify.html" : "onboarding.html";
    window.setTimeout(() => {
      window.location.href = destination;
    }, 650);
  });

  if (googleButton) {
    googleButton.addEventListener("click", () => {
      localStorage.setItem("saverAuthProvider", "google");
      window.location.href = "onboarding.html";
    });
  }
})();
