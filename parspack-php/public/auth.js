(() => {
  const $ = (id) => document.getElementById(id);
  const state = { csrf: window.AICF_CSRF || "", generated: null, historyItems: [], brands: [], cursor: null, hasMore: false };
  const card = $("auth-card"), workspace = $("workspace"), message = $("message");
  const loginForm = $("login-form"), registerForm = $("register-form"), resetForm = $("reset-form");
  const genMessage = $("generation-message"), workMessage = $("workspace-message");
  const notify = (el, text, error = false) => { el.textContent = text || ""; el.classList.toggle("error", error); };
  function showMode(mode) {
    loginForm.classList.toggle("hidden", mode !== "login");
    registerForm.classList.toggle("hidden", mode !== "register");
    resetForm.classList.toggle("hidden", mode !== "reset");
    $("login-tab").classList.toggle("active", mode === "login");
    $("register-tab").classList.toggle("active", mode === "register");
    $("login-tab").classList.toggle("hidden", mode === "reset");
    $("register-tab").classList.toggle("hidden", mode === "reset");
    notify(message, "");
  }
  async function request(path, data = null, method = "POST") {
    const options = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
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
  function renderContent(content) {
    state.generated = content;
    $("generated-output").classList.remove("hidden");
    $("output-caption").textContent = content.caption || "";
    $("output-reel").textContent = content.reel || "";
    $("output-stories").textContent = Array.isArray(content.stories) ? content.stories.map((s, i) => (i + 1) + ". " + s).join("\n\n") : "";
    $("output-ad").textContent = content.ad || "";
  }
  function renderHistory() {
    const host = $("history-items");
    host.replaceChildren();
    if (!state.historyItems.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "هنوز محتوایی در کتابخانه ذخیره نشده است.";
      host.append(empty);
    } else {
      for (const item of state.historyItems) {
        const row = document.createElement("div"); row.className = "history-row";
        const info = document.createElement("div");
        const title = document.createElement("div"); title.className = "history-title";
        title.textContent = item.product?.name || item.product?.businessName || "محتوای ذخیره‌شده";
        const date = document.createElement("div"); date.className = "history-date"; date.textContent = item.created_at || "";
        info.append(title, date);
        const actions = document.createElement("div"); actions.className = "history-actions";
        for (const [action, label] of [["open", "مشاهده"], ["delete", "حذف"]]) {
          const button = document.createElement("button"); button.type = "button"; button.textContent = label;
          button.dataset.action = action; button.dataset.id = item.id; actions.append(button);
        }
        row.append(info, actions); host.append(row);
      }
    }
    $("history-more").classList.toggle("hidden", !state.hasMore);
  }
  async function loadHistory(reset = true) {
    const params = new URLSearchParams({ limit: "20" });
    const q = $("history-search").value.trim();
    if (q) params.set("q", q);
    if (!reset && state.cursor) params.set("cursor", state.cursor);
    const result = await request("/api/history?" + params.toString(), null, "GET");
    if (reset) state.historyItems = [];
    state.historyItems.push(...(result.items || []));
    state.cursor = result.nextCursor || null;
    state.hasMore = Boolean(result.hasMore);
    renderHistory();
  }
  function renderMedia(items) {
    const host = $("media-items");
    host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "هنوز تصویری تولید نشده است.";
      host.append(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "media-card";
      const image = document.createElement("img");
      image.src = "/api/media/" + encodeURIComponent(item.id);
      image.alt = "تصویر تولیدشده";
      image.loading = "lazy";
      const footer = document.createElement("div");
      footer.className = "media-footer";
      const meta = document.createElement("span");
      meta.textContent = item.aspect_ratio + " · " + item.created_at;
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "حذف"; remove.dataset.mediaDelete = item.id;
      footer.append(meta, remove);
      card.append(image, footer);
      host.append(card);
    }
  }
  async function loadMedia() {
    const result = await request("/api/media", null, "GET");
    renderMedia(result.items || []);
  }
  function renderBrands(profiles) {
    state.brands = profiles;
    const host = $("brand-items");
    const select = $("brand-profile-id");
    const selected = select.value;
    select.replaceChildren();
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = "بدون پروفایل"; select.append(empty);
    for (const profile of profiles) {
      const option = document.createElement("option");
      option.value = profile.id; option.textContent = profile.name + (profile.is_default ? " · پیش‌فرض" : "");
      select.append(option);
    }
    select.value = profiles.some((item) => item.id === selected) ? selected : (profiles.find((item) => item.is_default)?.id || "");
    const selectedProfile = profiles.find((item) => item.id === select.value);
    if (selectedProfile) $("business-type").value = selectedProfile.business_type;
    host.replaceChildren();
    if (!profiles.length) {
      const emptyState = document.createElement("div"); emptyState.className = "history-empty";
      emptyState.textContent = "هنوز پروفایل برندی ذخیره نشده است."; host.append(emptyState); return;
    }
    for (const profile of profiles) {
      const row = document.createElement("div"); row.className = "history-row";
      const title = document.createElement("div"); title.className = "history-title";
      title.textContent = profile.name + (profile.is_default ? " · پیش‌فرض" : "");
      const actions = document.createElement("div"); actions.className = "history-actions";
      if (!profile.is_default) {
        const makeDefault = document.createElement("button"); makeDefault.type = "button";
        makeDefault.textContent = "پیش‌فرض"; makeDefault.dataset.brandDefault = profile.id; actions.append(makeDefault);
      }
      const remove = document.createElement("button"); remove.type = "button";
      remove.textContent = "حذف"; remove.dataset.brandDelete = profile.id; actions.append(remove);
      row.append(title, actions); host.append(row);
    }
  }
  async function loadBrands() {
    const result = await request("/api/brands", null, "GET");
    renderBrands(result.profiles || []);
  }
  function renderCalendar(items) {
    const host = $("calendar-items"); host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div"); empty.className = "history-empty";
      empty.textContent = "برای ۳۰ روز آینده برنامه‌ای ثبت نشده است."; host.append(empty); return;
    }
    for (const item of items) {
      const row = document.createElement("div"); row.className = "history-row";
      const info = document.createElement("div");
      const title = document.createElement("div"); title.className = "history-title";
      title.textContent = item.product?.name || item.product?.businessName || "محتوای زمان‌بندی‌شده";
      const date = document.createElement("div"); date.className = "history-date";
      date.textContent = item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }) : "";
      info.append(title, date); row.append(info); host.append(row);
    }
  }
  async function loadCalendar() {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 30 * 86400000).toISOString();
    const params = new URLSearchParams({ start, end });
    const result = await request("/api/calendar?" + params.toString(), null, "GET");
    renderCalendar(result.items || []);
  }
  async function loadWorkspaceUser() {
    const result = await request("/api/auth/me", null, "GET");
    card.classList.add("hidden"); workspace.classList.remove("hidden");
    $("welcome-message").textContent = "خوش آمدی " + (result.user?.display_name || result.user?.email || "");
    const needsConsent = !result.user?.ai_data_notice_accepted_at;
    $("ai-consent").classList.toggle("hidden", !needsConsent);
    $("app-modules").classList.toggle("hidden", needsConsent);
    if (!needsConsent) {
      try { await loadHistory(true); await loadMedia(); await loadBrands(); await loadCalendar(); }
      catch (error) { notify(workMessage, error.message, true); }
    }
  }
  $("login-tab").addEventListener("click", () => showMode("login"));
  $("register-tab").addEventListener("click", () => showMode("register"));
  $("forgot-button").addEventListener("click", async () => {
    const email = $("login-email").value.trim();
    if (!email) return notify(message, "ابتدا ایمیل خود را وارد کن.", true);
    try {
      await request("/api/auth/password/request", { email });
      notify(message, "اگر حساب فعالی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.");
    } catch (error) { notify(message, error.message, true); }
  });
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); notify(message, "در حال ورود...");
    try {
      await request("/api/auth/login", { email: $("login-email").value.trim(), password: $("login-password").value });
      await loadWorkspaceUser();
    } catch (error) { notify(message, error.message, true); }
  });
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault(); notify(message, "در حال ایجاد حساب...");
    try {
      const result = await request("/api/auth/register", {
        displayName: $("register-name").value.trim(),
        email: $("register-email").value.trim(),
        password: $("register-password").value
      });
      notify(message, result.message || "پیوند تأیید به ایمیل شما ارسال شد."); registerForm.reset();
    } catch (error) { notify(message, error.message, true); }
  });
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new URLSearchParams(location.search).get("reset_token") || "";
    try {
      const result = await request("/api/auth/password/reset", { token, password: $("reset-password").value });
      history.replaceState({}, "", "/"); showMode("login"); notify(message, result.message || "رمز عبور تغییر کرد."); resetForm.reset();
    } catch (error) { notify(message, error.message, true); }
  });
  $("accept-ai-notice").addEventListener("click", async () => {
    try {
      await request("/api/auth/ai-data-notice/accept", {});
      $("ai-consent").classList.add("hidden"); $("app-modules").classList.remove("hidden");
      notify(workMessage, "تأیید پردازش داده ثبت شد."); await loadHistory(true); await loadMedia(); await loadBrands(); await loadCalendar();
    } catch (error) { notify(workMessage, error.message, true); }
  });
  $("logout-button").addEventListener("click", async () => {
    try { await request("/api/auth/logout", {}); location.reload(); }
    catch (error) { notify(workMessage, error.message, true); }
  });
  $("generate-form").addEventListener("submit", async (event) => {
    event.preventDefault(); notify(genMessage, "در حال تولید محتوا...");
    const submit = $("generate-form").querySelector('button[type="submit"]'); submit.disabled = true;
    try {
      const fields = Object.fromEntries(new FormData($("generate-form")).entries());
      const scheduledAt = fields.scheduledAt ? new Date(fields.scheduledAt + ":00+03:30").toISOString() : "";
      const product = { ...fields, _factoryMeta: { tags: [], folder: "عمومی", favorite: false, scheduledAt, reviewStatus: "draft" } };
      const generated = await request("/api/generate", { ...fields, brandProfile: {} });
      renderContent(generated.content);
      try {
        await request("/api/history", { product, content: generated.content });
        notify(genMessage, "محتوا تولید و در کتابخانه ذخیره شد."); await loadHistory(true); await loadCalendar();
      } catch (error) { notify(genMessage, "محتوا تولید شد، اما ذخیره نشد: " + error.message, true); }
    } catch (error) { notify(genMessage, error.message, true); }
    finally { submit.disabled = false; }
  });
  $("brand-profile-id").addEventListener("change", () => {
    const profile = state.brands.find((item) => item.id === $("brand-profile-id").value);
    if (profile) $("business-type").value = profile.business_type;
  });
  $("brand-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    notify($("brand-message"), "در حال ذخیره پروفایل...");
    const data = Object.fromEntries(new FormData($("brand-form")).entries());
    try {
      await request("/api/brands", data);
      $("brand-form").reset();
      notify($("brand-message"), "پروفایل برند ذخیره شد.");
      await loadBrands();
    } catch (error) { notify($("brand-message"), error.message, true); }
  });
  $("brand-items").addEventListener("click", async (event) => {
    const makeDefault = event.target.closest("[data-brand-default]");
    const remove = event.target.closest("[data-brand-delete]");
    try {
      if (makeDefault) {
        await request("/api/brands/" + encodeURIComponent(makeDefault.dataset.brandDefault) + "/default", {});
        await loadBrands(); notify($("brand-message"), "پروفایل پیش‌فرض تغییر کرد.");
      } else if (remove && confirm("این پروفایل برند حذف شود؟")) {
        await request("/api/brands/" + encodeURIComponent(remove.dataset.brandDelete), {}, "DELETE");
        await loadBrands(); notify($("brand-message"), "پروفایل حذف شد.");
      }
    } catch (error) { notify($("brand-message"), error.message, true); }
  });
  $("image-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = $("image-prompt").value.trim();
    notify($("media-message"), "در حال تولید تصویر...");
    const submit = $("image-form").querySelector('button[type="submit"]'); submit.disabled = true;
    try {
      await request("/api/media/generate", { prompt, aspect_ratio: $("image-ratio").value });
      notify($("media-message"), "تصویر تولید و در فضای خصوصی ذخیره شد.");
      $("image-prompt").value = "";
      await loadMedia();
    } catch (error) { notify($("media-message"), error.message, true); }
    finally { submit.disabled = false; }
  });
  $("media-items").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-media-delete]");
    if (!button || !confirm("این تصویر حذف شود؟")) return;
    try {
      await request("/api/media/" + encodeURIComponent(button.dataset.mediaDelete), {}, "DELETE");
      await loadMedia();
    } catch (error) { notify($("media-message"), error.message, true); }
  });
  $("generated-output").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button || !state.generated) return;
    const key = button.dataset.copy;
    const value = key === "stories" ? state.generated.stories.join("\n\n") : state.generated[key];
    try { await navigator.clipboard.writeText(value || ""); notify(genMessage, "متن کپی شد."); }
    catch { notify(genMessage, "کپی خودکار در این مرورگر در دسترس نیست.", true); }
  });
  $("history-items").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const item = state.historyItems.find((entry) => entry.id === button.dataset.id); if (!item) return;
    if (button.dataset.action === "open") {
      renderContent(item.content); $("generated-output").scrollIntoView({ behavior: "smooth", block: "start" }); return;
    }
    if (button.dataset.action === "delete" && confirm("این محتوا از کتابخانه حذف شود؟")) {
      try {
        await request("/api/history/" + encodeURIComponent(item.id), {}, "DELETE");
        state.historyItems = state.historyItems.filter((entry) => entry.id !== item.id); renderHistory();
      } catch (error) { notify(workMessage, error.message, true); }
    }
  });
  $("history-search").addEventListener("change", () => loadHistory(true).catch((error) => notify(workMessage, error.message, true)));
  $("history-more").addEventListener("click", () => loadHistory(false).catch((error) => notify(workMessage, error.message, true)));

  if (new URLSearchParams(location.search).get("reset_token")) showMode("reset");
  else loadWorkspaceUser().catch(() => {});
})();
