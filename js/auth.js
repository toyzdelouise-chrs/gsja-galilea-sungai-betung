(function () {
  function getSupabaseClient() {
    if (
      typeof supabaseClient !== "undefined" &&
      supabaseClient &&
      supabaseClient.auth
    ) {
      return supabaseClient;
    }

    if (
      typeof supabase !== "undefined" &&
      supabase &&
      supabase.auth &&
      typeof supabase.auth.signInWithPassword === "function"
    ) {
      return supabase;
    }

    return null;
  }

  function setStatus(messageEl, text, isError = true) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.style.color = isError ? "#b91c1c" : "#15803d";
  }

  async function redirectIfAlreadyLoggedIn(targetUrl = "dashboard.html") {
    const client = getSupabaseClient();
    if (!client) return;

    const { data, error } = await client.auth.getSession();
    if (!error && data && data.session) {
      window.location.href = targetUrl;
    }
  }

  function initLoginForm(options = {}) {
    const formId = options.formId || "loginForm";
    const emailId = options.emailId || "email";
    const passwordId = options.passwordId || "password";
    const buttonId = options.buttonId || "loginBtn";
    const messageId = options.messageId || "loginMessage";
    const redirectTo = options.redirectTo || "dashboard.html";

    const form = document.getElementById(formId);
    const emailInput = document.getElementById(emailId);
    const passwordInput = document.getElementById(passwordId);
    const submitBtn = document.getElementById(buttonId);
    const messageEl = document.getElementById(messageId);

    if (!form) return;

    const client = getSupabaseClient();
    if (!client) {
      setStatus(
        messageEl,
        "Klien Supabase belum siap. Periksa isi js/supabase-config.js.",
      );
    }

    redirectIfAlreadyLoggedIn(redirectTo);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!email || !password) {
        setStatus(messageEl, "Email dan password wajib diisi.");
        return;
      }

      const activeClient = getSupabaseClient();
      if (!activeClient) {
        setStatus(messageEl, "Konfigurasi Supabase belum ditemukan.");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      setStatus(messageEl, "Sedang memproses login...", false);

      try {
        const { data, error } = await activeClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatus(messageEl, "Login gagal: " + error.message);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        if (!data || !data.session) {
          setStatus(messageEl, "Sesi login tidak ditemukan. Coba lagi.");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        setStatus(
          messageEl,
          "Login berhasil! Mengalihkan ke Dashboard...",
          false,
        );
        window.location.href = redirectTo;
      } catch (err) {
        setStatus(
          messageEl,
          "Terjadi kesalahan saat login: " + (err.message || err),
        );
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  async function requireAuth(loginUrl = "index.html") {
    const client = getSupabaseClient();
    if (!client) {
      return {
        session: null,
        errorMessage:
          "Klien Supabase belum siap. Periksa js/supabase-config.js.",
      };
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      return {
        session: null,
        errorMessage: "Gagal memeriksa sesi: " + error.message,
      };
    }

    const session = data && data.session ? data.session : null;
    if (!session) {
      window.location.href = loginUrl;
      return { session: null, errorMessage: null };
    }

    return { session, errorMessage: null };
  }

  async function logout(loginUrl = "index.html") {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    window.location.href = loginUrl;
  }

  window.GalileaAuth = {
    getSupabaseClient,
    initLoginForm,
    requireAuth,
    logout,
  };
})();
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector(".sidebar");
  const pageHeader = document.querySelector(".page-header");
  if (!sidebar || !pageHeader) return;

  let toggleBtn = document.getElementById("menuToggleBtn");
  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.id = "menuToggleBtn";
    toggleBtn.className = "menu-toggle-btn";
    toggleBtn.setAttribute("aria-label", "Buka menu navigasi");
    toggleBtn.textContent = "☰";
    pageHeader.insertBefore(toggleBtn, pageHeader.firstChild);
  }

  let backdrop = document.querySelector(".sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("active");
  }

  toggleBtn.addEventListener("click", function () {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("active");
  });

  backdrop.addEventListener("click", closeSidebar);
});
