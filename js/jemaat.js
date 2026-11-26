(function () {
  const TABLE_NAME = "jemaat";

  const userEmailEl = document.getElementById("userEmail");
  const statusEl = document.getElementById("statusJemaat");
  const logoutBtn = document.getElementById("logoutBtn");
  const form = document.getElementById("jemaatForm");
  const namaInput = document.getElementById("namaJemaat");
  const noHpInput = document.getElementById("noHpJemaat");
  const alamatInput = document.getElementById("alamatJemaat");
  const simpanBtn = document.getElementById("simpanJemaatBtn");
  const messageEl = document.getElementById("jemaatMessage");
  const tbodyEl = document.getElementById("tabelJemaatBody");

  function getClient() {
    if (
      window.GalileaAuth &&
      typeof window.GalileaAuth.getSupabaseClient === "function"
    ) {
      return window.GalileaAuth.getSupabaseClient();
    }
    if (typeof supabaseClient !== "undefined" && supabaseClient?.auth) {
      return supabaseClient;
    }
    if (typeof supabase !== "undefined" && supabase?.auth) {
      return supabase;
    }
    return null;
  }

  function showMessage(text, isError = true) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.style.color = isError ? "#b91c1c" : "#15803d";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRows(rows) {
    if (!tbodyEl) return;

    if (!rows || rows.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="4">Belum ada data jemaat tersimpan.</td></tr>';
      return;
    }

    tbodyEl.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.nama)}</td>
            <td>${escapeHtml(row.no_hp || "-")}</td>
            <td>${escapeHtml(row.alamat || "-")}</td>
            <td>
              <button type="button" class="btn-hapus-jemaat" data-id="${escapeHtml(row.id)}">
                Hapus
              </button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  async function loadJemaat(client) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '<tr><td colspan="4">Memuat data jemaat...</td></tr>';

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("id, nama, no_hp, alamat, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      tbodyEl.innerHTML = `<tr><td colspan="4">Gagal memuat data: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    renderRows(data);
  }

  async function init() {
    const client = getClient();
    if (!client) {
      if (statusEl) {
        statusEl.textContent =
          "Klien Supabase belum siap. Periksa js/supabase-config.js.";
      }
      if (tbodyEl) {
        tbodyEl.innerHTML =
          '<tr><td colspan="4">Koneksi Supabase belum siap.</td></tr>';
      }
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      window.location.href = "../index.html";
      return;
    }

    if (userEmailEl) {
      userEmailEl.textContent = data.session.user.email || "Pengurus Aktif";
    }
    if (statusEl) {
      statusEl.textContent = "Terhubung ke database jemaat GSJA GALILEA.";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        logoutBtn.disabled = true;
        await client.auth.signOut();
        window.location.href = "../index.html";
      });
    }

    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const nama = namaInput ? namaInput.value.trim() : "";
        const noHp = noHpInput ? noHpInput.value.trim() : "";
        const alamat = alamatInput ? alamatInput.value.trim() : "";

        if (!nama) {
          showMessage("Nama lengkap wajib diisi.");
          return;
        }

        if (simpanBtn) simpanBtn.disabled = true;
        showMessage("Menyimpan data jemaat...", false);

        const { error: insertError } = await client.from(TABLE_NAME).insert([
          {
            nama,
            no_hp: noHp || null,
            alamat: alamat || null,
          },
        ]);

        if (simpanBtn) simpanBtn.disabled = false;

        if (insertError) {
          showMessage("Gagal menyimpan: " + insertError.message);
          return;
        }

        form.reset();
        showMessage("Data jemaat berhasil disimpan.", false);
        await loadJemaat(client);
      });
    }

    if (tbodyEl) {
      tbodyEl.addEventListener("click", async function (event) {
        const btn = event.target.closest(".btn-hapus-jemaat");
        if (!btn) return;

        const id = btn.getAttribute("data-id");
        if (!id) return;

        btn.disabled = true;
        const { error: deleteError } = await client
          .from(TABLE_NAME)
          .delete()
          .eq("id", id);

        if (deleteError) {
          btn.disabled = false;
          showMessage("Gagal menghapus data: " + deleteError.message);
          return;
        }

        showMessage("Data jemaat berhasil dihapus.", false);
        await loadJemaat(client);
      });
    }

    await loadJemaat(client);
  }

  init();
})();
