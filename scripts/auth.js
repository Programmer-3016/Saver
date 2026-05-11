// Shared auth validation and Supabase Auth wiring for login/register/reset.

(function () {
  const form = document.querySelector("[data-auth-form]");
  if (!form) return;

  const formType = form.dataset.authForm;
  const submitButton = form.querySelector("button[type='submit']");
  const googleButton = document.querySelector("[data-google-auth]");
  const passwordResetButton = document.querySelector("[data-password-reset]");
  const supabaseAuth = window.saverSupabase;
  let submitButtonState = null;
  let googleButtonState = null;
  let passwordResetButtonState = null;
  let awaitingEmailConfirmation = false;

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
    reset: [
      ["password", validatePassword],
      ["confirmPassword", validatePasswordMatch],
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
    return value("fullName").replace(/\s+/g, " ").length >= 2 ? "" : "Please enter your full name.";
  }

  function validateEmail() {
    const email = value("email");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Please enter a valid email address.";
  }

  function validatePassword() {
    return value("password").length >= 8 ? "" : "Password must be at least 8 characters.";
  }

  function validatePasswordMatch() {
    if (!value("confirmPassword")) return "Please confirm your password.";
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
    input.setAttribute("aria-invalid", String(Boolean(message)));

    if (error) {
      if (!error.id && input.id) error.id = `${input.id}-error`;
      if (error.id) input.setAttribute("aria-describedby", error.id);
      error.setAttribute("role", "alert");
      error.textContent = message;
      error.classList.toggle("hidden", !message);
    }

    if (!message) input.removeAttribute("aria-describedby");
  }

  function setStatus(message, isError = false) {
    const status = form.querySelector("[data-form-status]");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("hidden", !message);
    status.classList.toggle("text-error", isError);
    status.classList.toggle("text-primary-container", !isError);
  }

  function hasSupabaseAuth() {
    return Boolean(supabaseAuth?.isConfigured && supabaseAuth.client?.auth);
  }

  function setButtonLoading(button, loadingText) {
    if (!button) return "";

    const originalState = {
      html: button.innerHTML,
      text: button.textContent.trim(),
    };
    button.disabled = true;
    button.textContent = loadingText;
    return originalState;
  }

  function restoreButton(button, originalState) {
    if (!button) return;

    button.disabled = false;
    if (originalState?.html) button.innerHTML = originalState.html;
    else if (originalState?.text) button.textContent = originalState.text;
  }

  function restoreTransientState() {
    if (awaitingEmailConfirmation) return;

    restoreButton(submitButton, submitButtonState);
    restoreButton(googleButton, googleButtonState);
    restoreButton(passwordResetButton, passwordResetButtonState);
    submitButtonState = null;
    googleButtonState = null;
    passwordResetButtonState = null;
  }

  function resetEmailConfirmationState() {
    if (!awaitingEmailConfirmation || formType !== "register") return;

    awaitingEmailConfirmation = false;
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }

  function showEmailConfirmationState() {
    awaitingEmailConfirmation = true;
    restoreButton(submitButton, submitButtonState);
    submitButtonState = null;
    submitButton.disabled = true;
    submitButton.textContent = "Check your email";
  }

  function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const inputId = button.getAttribute("aria-controls");
      const input = inputId ? document.getElementById(inputId) : null;
      const icon = button.querySelector(".material-symbols-outlined");

      if (!input) return;

      button.addEventListener("click", () => {
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
        if (icon) icon.textContent = shouldShow ? "visibility_off" : "visibility";
      });
    });
  }

  function friendlyAuthError(error) {
    const message = error?.message || "Authentication failed. Please try again.";
    const lowerMessage = message.toLowerCase();
    const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);

    if (waitMatch && lowerMessage.includes("security purposes")) {
      return `Please wait ${waitMatch[1]} seconds before trying again. This protects your account from repeated signup requests.`;
    }

    if (lowerMessage.includes("email rate limit") || lowerMessage.includes("rate limit")) {
      return "Too many confirmation emails were requested. Please wait a minute, then check Inbox and Spam before trying again.";
    }

    if (lowerMessage.includes("already registered") || lowerMessage.includes("already exists")) {
      return "This email already has an account. Please log in instead.";
    }

    if (lowerMessage.includes("email not confirmed")) {
      return "Please confirm your email first, then log in.";
    }

    if (lowerMessage.includes("invalid login credentials")) {
      return "Email or password is incorrect.";
    }

    return message;
  }

  function persistUserProfile(user) {
    const email = user?.email || value("email");
    const fullName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.display_name ||
      value("fullName");

    if (email) localStorage.setItem("saverUserEmail", email);
    if (fullName) localStorage.setItem("saverUserName", fullName);
  }

  function showSupabaseConfigMessage() {
    setStatus(
      "Supabase is not configured yet. Add your project URL and anon key in supabase/config.js.",
      true,
    );
  }

  async function submitWithSupabase() {
    if (!hasSupabaseAuth()) {
      showSupabaseConfigMessage();
      return;
    }

    if (formType === "reset") {
      await updatePasswordWithSupabase();
      return;
    }

    submitButtonState = setButtonLoading(
      submitButton,
      formType === "register" ? "Creating account..." : "Logging in...",
    );

    try {
      if (formType === "register") {
        const { data, error } = await supabaseAuth.client.auth.signUp({
          email: value("email"),
          password: value("password"),
          options: {
            data: {
              full_name: value("fullName"),
            },
            emailRedirectTo: supabaseAuth.pageUrl("onboarding.html"),
          },
        });

        if (error) throw error;

        persistUserProfile(data.user);

        if (data.session) {
          setStatus("Account created. Opening setup...");
          window.location.href = "onboarding.html";
          return;
        }

        setStatus(
          `If ${value("email")} is new, check your inbox for a confirmation link. If you already signed in before, log in or continue with Google.`,
        );
        showEmailConfirmationState();
        return;
      }

      const { data, error } = await supabaseAuth.client.auth.signInWithPassword({
        email: value("email"),
        password: value("password"),
      });

      if (error) throw error;

      persistUserProfile(data.user);
      setStatus("Login successful. Opening setup...");
      window.location.href = "onboarding.html";
    } catch (error) {
      setStatus(friendlyAuthError(error), true);
      restoreButton(submitButton, submitButtonState);
      submitButtonState = null;
    }
  }

  async function requestPasswordReset() {
    setStatus("");

    if (!hasSupabaseAuth()) {
      showSupabaseConfigMessage();
      return;
    }

    const emailInput = field("email");
    const emailError = validateEmail();

    if (emailError) {
      setError(emailInput, "Enter your email first so we can send reset instructions.");
      emailInput.focus();
      return;
    }

    passwordResetButtonState = setButtonLoading(passwordResetButton, "Sending...");

    try {
      const { error } = await supabaseAuth.client.auth.resetPasswordForEmail(value("email"), {
        redirectTo: supabaseAuth.pageUrl("reset-password.html"),
      });

      if (error) throw error;

      setStatus(
        "If password login is available for this email, reset instructions have been sent. Google users can continue with Google.",
      );
    } catch (error) {
      setStatus(friendlyAuthError(error), true);
    } finally {
      restoreButton(passwordResetButton, passwordResetButtonState);
      passwordResetButtonState = null;
    }
  }

  async function updatePasswordWithSupabase() {
    submitButtonState = setButtonLoading(submitButton, "Updating password...");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.client.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "Open the password reset link from your email again, then set a new password.",
        );
      }

      const { error } = await supabaseAuth.client.auth.updateUser({
        password: value("password"),
      });

      if (error) throw error;

      setStatus("Password updated. Redirecting to login...");
      await supabaseAuth.client.auth.signOut();
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (error) {
      setStatus(friendlyAuthError(error), true);
      restoreButton(submitButton, submitButtonState);
      submitButtonState = null;
    }
  }

  async function continueWithGoogle() {
    setStatus("");

    if (!hasSupabaseAuth()) {
      showSupabaseConfigMessage();
      return;
    }

    googleButtonState = setButtonLoading(googleButton, "Opening Google...");

    const { error } = await supabaseAuth.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: supabaseAuth.pageUrl("onboarding.html"),
      },
    });

    if (error) {
      setStatus(friendlyAuthError(error), true);
      restoreButton(googleButton, googleButtonState);
      googleButtonState = null;
    }
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
    resetEmailConfirmationState();

    const activeRule = (rules[formType] || []).find(([name]) => name === input.name);
    if (!activeRule) return;

    setError(input, activeRule[1]());

    if (input.name === "password" && field("confirmPassword")?.value) {
      setError(field("confirmPassword"), validatePasswordMatch());
    }
  });

  form.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.name) return;
    resetEmailConfirmationState();

    const activeRule = (rules[formType] || []).find(([name]) => name === input.name);
    if (!activeRule) return;

    setError(input, activeRule[1]());
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("");

    if (!validateForm()) {
      setStatus("Fix the highlighted fields and try again.", true);
      return;
    }

    submitWithSupabase();
  });

  if (googleButton) {
    googleButton.addEventListener("click", continueWithGoogle);
  }

  if (passwordResetButton) {
    passwordResetButton.addEventListener("click", requestPasswordReset);
  }

  initPasswordToggles();

  window.addEventListener("pageshow", (event) => {
    if (
      event.persisted ||
      submitButton?.disabled ||
      googleButton?.disabled ||
      passwordResetButton?.disabled
    ) {
      restoreTransientState();
    }
  });
})();
