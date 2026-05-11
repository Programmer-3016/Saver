// Shared auth validation and Supabase Auth wiring for login/register.

(function () {
  const form = document.querySelector("[data-auth-form]");
  if (!form) return;

  const formType = form.dataset.authForm;
  const submitButton = form.querySelector("button[type='submit']");
  const googleButton = document.querySelector("[data-google-auth]");
  const supabaseAuth = window.saverSupabase;

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

    const originalText = setButtonLoading(
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

        setStatus("Account created. Check your email to confirm your account, then log in.");
        restoreButton(submitButton, originalText);
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
      setStatus(error.message || "Authentication failed. Please try again.", true);
      restoreButton(submitButton, originalText);
    }
  }

  async function continueWithGoogle() {
    setStatus("");

    if (!hasSupabaseAuth()) {
      showSupabaseConfigMessage();
      return;
    }

    const originalText = setButtonLoading(googleButton, "Opening Google...");

    const { error } = await supabaseAuth.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: supabaseAuth.pageUrl("onboarding.html"),
      },
    });

    if (error) {
      setStatus(error.message || "Google sign-in failed. Please try again.", true);
      restoreButton(googleButton, originalText);
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
})();
