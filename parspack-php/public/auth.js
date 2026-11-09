(() => {
  const $ = (id) => document.getElementById(id);
  const state = { csrf: window.AICF_CSRF || "" };
  const card = $("auth-card"), workspace = $("workspace"), message = $("message");
  const loginForm = $("login-form"), registerForm = $("register-form"), resetForm = $("reset-form");
  function notify(text, error = false) {
    message.textContent = text || "";
    message.classList.toggle("error", error);
  }
  function showMode(mode) {
    loginForm.classList.toggle("hidden", mode !== "login");
    registerForm.classList.toggle("hidden", mode !== "register");
    resetForm.classList.toggle("hidden", mode !== "reset");
    $("login-tab").classList.toggle("active", mode === "login");
    $("register-tab").classList.toggle("active", mode === "register");
    $("login-tab").classList.toggle("hidden", mode === "reset");
    $("register-tab").classList.toggle("hidden", mode === "reset");
    notify("");
  }
  async function request(path, data = null, method = "POST") {
    const options = { method, credentials: "same-origin", headers: { "Accept": "application/json" } };
    if (data !== null) {
      options.headers["Content-Type"] = "application/json";
      options.headers["X-CSRF-Token"] = state.csrf;
      options.body = JSON.stringify(data);
    }
    const response = await fetch(path, options);
    const result = await response.json().catch(() => ({}));
    if (result.csrfToken) state.csrf = result.csrfToken;
    if (!response.ok || result.ok === false) throw new Error(result.error?.message || "درخواست انجام نشد. دوباره تلاش کن.");
    return result;
  }
  async function showWorkspace() {
    const result = await request("/api/auth/me", null, "GET");
    card.classList.add("hidden"); workspace.classList.remove("hidden");
    $("welcome-message").textContent = "خوش آمدی " + (result.user?.display_name || result.user?.email || "");
  }
  $("login-tab").addEventListener("click", () => showMode("login"));
  $("register-tab").addEventListener("click", () => showMode("register"));
  $("forgot-button").addEventListener("click", async () => {
    const email = $("login-email").value.trim();
    if (!email) return notify("ابتدا ایمیل خود را وارد کن.", true);
    try {
      await request("/api/auth/password/request", { email });
      notify("اگر حساب فعالی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.");
    } catch (error) { notify(error.message, true); }
  });
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); notify("در حال ورود...");
    try {
      await request("/api/auth/login", { email: $("login-email").value.trim(), password: $("login-password").value });
      await showWorkspace();
    } catch (error) { notify(error.message, true); }
  });
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault(); notify("در حال ایجاد حساب...");
    try {
      const result = await request("/api/auth/register", {
        displayName: $("register-name").value.trim(),
        email: $("register-email").value.trim(),
        password: $("register-password").value
      });
      notify(result.message || "پیوند تأیید به ایمیل شما ارسال شد."); registerForm.reset();
    } catch (error) { notify(error.message, true); }
  });
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new URLSearchParams(location.search).get("reset_token") || "";
    try {
      const result = await request("/api/auth/password/reset", { token, password: $("reset-password").value });
      history.replaceState({}, "", "/"); showMode("login"); notify(result.message || "رمز عبور تغییر کرد."); resetForm.reset();
    } catch (error) { notify(error.message, true); }
  });
  $("logout-button").addEventListener("click", async () => {
    try {
      await request("/api/auth/logout", {}); workspace.classList.add("hidden"); card.classList.remove("hidden"); showMode("login");
    } catch (error) { notify(error.message, true); }
  });
  const resetToken = new URLSearchParams(location.search).get("reset_token");
  if (resetToken) showMode("reset");
  else request("/api/auth/me", null, "GET").then((result) => {
    card.classList.add("hidden"); workspace.classList.remove("hidden");
    $("welcome-message").textContent = "خوش آمدی " + (result.user?.display_name || result.user?.email || "");
  }).catch(() => {});
})();
