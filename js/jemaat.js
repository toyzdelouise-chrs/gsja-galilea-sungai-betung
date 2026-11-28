(function () {
  const TABLE_NAME = "jemaat";

  // Elemen Umum
  const userEmailEl = document.getElementById("userEmail");
  const statusEl = document.getElementById("statusJemaat");
  const logoutBtn = document.getElementById("logoutBtn");
  const tbodyEl = document.getElementById("tabelJemaatBody");

  // Elemen Form 1 (Buat KK Baru)
  const kkForm = document.getElementById("kkForm");
  const kepalaKeluargaInput = document.getElementById("kepalaKeluargaInput");
  const hpPerwakilanInput = document.getElementById("hpPerwakilanInput");
  const sektorKkSelect = document.getElementById("sektorKkSelect");
  const alamatKkInput = document.getElementById("alamatKkInput");
  const autoTambahKepalaCheckbox = document.getElementById(
    "autoTambahKepalaCheckbox",
  );
  const simpanKkBtn = document.getElementById("simpanKkBtn");
  const kkMessageEl = document.getElementById("kkMessage");

  // Elemen Form 2 (Tambah Anggota Jemaat)
  const form = document.getElementById("jemaatForm");
  const pilihKkSelect = document.getElementById("pilihKkSelect");
  const hubunganSelect = document.getElementById("hubunganKeluargaSelect");
  const namaInput = document.getElementById("namaJemaat");
  const sektorJemaatSelect = document.getElementById("sektorJemaatSelect");
  const noHpInput = document.getElementById("noHpJemaat");
  const alamatInput = document.getElementById("alamatJemaat");
  const simpanBtn = document.getElementById("simpanJemaatBtn");
  const messageEl = document.getElementById("jemaatMessage");

  // Elemen Filter, Pencarian & Cetak PDF
  const filterKkSelect = document.getElementById("filterKkSelect");
  const filterSektorSelect = document.getElementById("filterSektorSelect");
  const cariJemaatInput = document.getElementById("cariJemaatInput");
  const btnCetakPdf = document.getElementById("btnCetakPdf");

  let allJemaat = [];
  let kkMap = {}; // { "KK-001": { kode_kk, kepala, sektor, no_hp, alamat } }

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

  function showMsg(el, text, isError = true) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#b91c1c" : "#15803d";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateNextKodeKk() {
    let maxNum = 0;
    allJemaat.forEach((row) => {
      if (row.kode_kk) {
        const match = String(row.kode_kk).match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    return "KK-" + String(maxNum + 1).padStart(3, "0");
  }

  function rebuildKkDropdowns() {
    kkMap = {};
    allJemaat.forEach((row) => {
      if (!row.kode_kk) return;
      const nama = row.nama_lengkap || row.nama || "Tanpa Nama";
      const hubungan = row.status_keluarga || row.hubungan || "";

      if (!kkMap[row.kode_kk] || hubungan === "Kepala Keluarga") {
        kkMap[row.kode_kk] = {
          kode_kk: row.kode_kk,
          kepala: nama,
          sektor: row.sektor || "",
          no_hp: row.no_hp || "",
          alamat: row.alamat || "",
        };
      }
    });

    const kkList = Object.values(kkMap).sort((a, b) =>
      a.kode_kk.localeCompare(b.kode_kk, undefined, { numeric: true }),
    );

    if (pilihKkSelect) {
      const prevVal = pilihKkSelect.value;
      pilihKkSelect.innerHTML =
        '<option value="">-- Tanpa KK / Pilih Keluarga --</option>' +
        kkList
          .map(
            (kk) =>
              `<option value="${escapeHtml(kk.kode_kk)}">${escapeHtml(kk.kode_kk)} - Kel. ${escapeHtml(kk.kepala)}</option>`,
          )
          .join("");
      pilihKkSelect.value = prevVal;
    }

    if (filterKkSelect) {
      const prevFilter = filterKkSelect.value;
      filterKkSelect.innerHTML =
        '<option value="ALL">Semua Kartu Keluarga</option>' +
        '<option value="NO_KK">Belum Punya KK</option>' +
        kkList
          .map(
            (kk) =>
              `<option value="${escapeHtml(kk.kode_kk)}">${escapeHtml(kk.kode_kk)} - Kel. ${escapeHtml(kk.kepala)}</option>`,
          )
          .join("");
      filterKkSelect.value = prevFilter || "ALL";
    }
  }

  function renderRows(rows) {
    if (!tbodyEl) return;

    if (!rows || rows.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="7">Belum ada data jemaat tersimpan.</td></tr>';
      return;
    }

    tbodyEl.innerHTML = rows
      .map((row) => {
        const kodeKk = row.kode_kk
          ? `<span class="badge-kk">${escapeHtml(row.kode_kk)}</span>`
          : `<span class="badge-kk badge-kk-kosong">Belum ada KK</span>`;
        const nama = row.nama_lengkap || row.nama || "-";
        const hubungan = row.status_keluarga || row.hubungan || "-";
        const sektor = row.sektor
          ? `<span class="badge-sektor">${escapeHtml(row.sektor)}</span>`
          : `-`;

        return `
          <tr>
            <td>${kodeKk}</td>
            <td><strong>${escapeHtml(nama)}</strong></td>
            <td>${escapeHtml(hubungan)}</td>
            <td>${sektor}</td>
            <td>${escapeHtml(row.no_hp || "-")}</td>
            <td>${escapeHtml(row.alamat || "-")}</td>
            <td>
              <button type="button" class="btn-hapus-jemaat" data-id="${escapeHtml(row.id)}">
                Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const selectedKk = filterKkSelect ? filterKkSelect.value : "ALL";
    const selectedSektor = filterSektorSelect
      ? filterSektorSelect.value
      : "ALL";
    const keyword = cariJemaatInput
      ? cariJemaatInput.value.trim().toLowerCase()
      : "";

    const filtered = allJemaat.filter((row) => {
      if (selectedKk === "NO_KK" && row.kode_kk) return false;
      if (
        selectedKk !== "ALL" &&
        selectedKk !== "NO_KK" &&
        row.kode_kk !== selectedKk
      ) {
        return false;
      }

      if (selectedSektor === "NO_SEKTOR" && row.sektor) return false;
      if (
        selectedSektor !== "ALL" &&
        selectedSektor !== "NO_SEKTOR" &&
        row.sektor !== selectedSektor
      ) {
        return false;
      }

      if (keyword) {
        const text = [
          row.kode_kk,
          row.nama_lengkap || row.nama,
          row.status_keluarga || row.hubungan,
          row.sektor,
          row.no_hp,
          row.alamat,
        ]
          .join(" ")
          .toLowerCase();
        if (!text.includes(keyword)) return false;
      }

      return true;
    });

    const urutanHubungan = {
      "kepala keluarga": 1,
      istri: 2,
      anak: 3,
      "orang tua": 4,
      "anggota lainnya": 5,
      lainnya: 6,
    };

    filtered.sort((a, b) => {
      const kkA = String(a.kode_kk || "ZZZ-999")
        .trim()
        .toUpperCase();
      const kkB = String(b.kode_kk || "ZZZ-999")
        .trim()
        .toUpperCase();
      if (kkA !== kkB) {
        return kkA.localeCompare(kkB, undefined, { numeric: true });
      }

      const hubA = String(a.status_keluarga || a.hubungan || "")
        .trim()
        .toLowerCase();
      const hubB = String(b.status_keluarga || b.hubungan || "")
        .trim()
        .toLowerCase();
      const rankA = urutanHubungan[hubA] || 99;
      const rankB = urutanHubungan[hubB] || 99;
      if (rankA !== rankB) return rankA - rankB;

      return new Date(a.created_at) - new Date(b.created_at);
    });

    renderRows(filtered);
  }

  async function loadJemaat(client) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '<tr><td colspan="7">Memuat data jemaat...</td></tr>';

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      tbodyEl.innerHTML = `<tr><td colspan="7">Gagal memuat data: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    allJemaat = data || [];
    rebuildKkDropdowns();
    applyFilters();
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
          '<tr><td colspan="7">Koneksi Supabase belum siap.</td></tr>';
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

    // Otomatis isi Sektor, Alamat & HP saat memilih KK di Form 2
    if (pilihKkSelect) {
      pilihKkSelect.addEventListener("change", function () {
        const kkData = kkMap[pilihKkSelect.value];
        if (kkData) {
          if (sektorJemaatSelect && kkData.sektor) {
            sektorJemaatSelect.value = kkData.sektor;
          }
          if (alamatInput && !alamatInput.value.trim()) {
            alamatInput.value = kkData.alamat || "";
          }
          if (noHpInput && !noHpInput.value.trim()) {
            noHpInput.value = kkData.no_hp || "";
          }
        }
      });
    }

    // Event Filter & Pencarian
    if (filterKkSelect) filterKkSelect.addEventListener("change", applyFilters);
    if (filterSektorSelect)
      filterSektorSelect.addEventListener("change", applyFilters);
    if (cariJemaatInput)
      cariJemaatInput.addEventListener("input", applyFilters);

    // Event Cetak PDF
    if (btnCetakPdf) {
      btnCetakPdf.addEventListener("click", function () {
        const printInfo = document.getElementById("printInfoFilter");
        const printTgl = document.getElementById("printTanggal");

        if (printInfo) {
          const kkText =
            filterKkSelect?.selectedOptions[0]?.text || "Semua Kartu Keluarga";
          const sektorText =
            filterSektorSelect?.selectedOptions[0]?.text || "Semua Sektor";
          const keyword = cariJemaatInput?.value.trim();

          printInfo.textContent = keyword
            ? `${kkText} | ${sektorText} | Pencarian: "${keyword}"`
            : `${kkText} | ${sektorText}`;
        }

        if (printTgl) {
          printTgl.textContent = new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        }

        window.print();
      });
    }

    // FORM 1: Buat Kartu Keluarga Baru
    if (kkForm) {
      kkForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const kepala = kepalaKeluargaInput
          ? kepalaKeluargaInput.value.trim()
          : "";
        const noHp = hpPerwakilanInput ? hpPerwakilanInput.value.trim() : "";
        const sektor = sektorKkSelect ? sektorKkSelect.value : "";
        const alamat = alamatKkInput ? alamatKkInput.value.trim() : "";
        const autoTambah = autoTambahKepalaCheckbox
          ? autoTambahKepalaCheckbox.checked
          : true;

        if (!kepala) {
          showMsg(kkMessageEl, "Nama Kepala Keluarga wajib diisi.");
          return;
        }

        const kodeKkBaru = generateNextKodeKk();

        if (!autoTambah) {
          showMsg(
            kkMessageEl,
            `Kode ${kodeKkBaru} siap dipakai. Centang kotak di atas agar langsung tersimpan ke daftar jemaat.`,
            false,
          );
          return;
        }

        if (simpanKkBtn) simpanKkBtn.disabled = true;
        showMsg(kkMessageEl, `Menyimpan ${kodeKkBaru}...`, false);

        const { error: insertError } = await client.from(TABLE_NAME).insert([
          {
            kode_kk: kodeKkBaru,
            nama: kepala,
            status_keluarga: "Kepala Keluarga",
            sektor: sektor || null,
            no_hp: noHp || null,
            alamat: alamat || null,
          },
        ]);

        if (simpanKkBtn) simpanKkBtn.disabled = false;

        if (insertError) {
          showMsg(kkMessageEl, "Gagal membuat KK: " + insertError.message);
          return;
        }

        kkForm.reset();
        if (autoTambahKepalaCheckbox) autoTambahKepalaCheckbox.checked = true;
        showMsg(
          kkMessageEl,
          `Berhasil! ${kodeKkBaru} (${kepala}) tersimpan.`,
          false,
        );
        await loadJemaat(client);
      });
    }

    // FORM 2: Tambah Anggota Jemaat
    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const kodeKk = pilihKkSelect ? pilihKkSelect.value : "";
        const hubungan = hubunganSelect ? hubunganSelect.value : "Anak";
        const nama = namaInput ? namaInput.value.trim() : "";
        let sektor = sektorJemaatSelect ? sektorJemaatSelect.value : "";
        let noHp = noHpInput ? noHpInput.value.trim() : "";
        let alamat = alamatInput ? alamatInput.value.trim() : "";

        // Jika Sektor / HP / Alamat dikosongkan tapi KK dipilih, otomatis ikut data KK
        if (kodeKk && kkMap[kodeKk]) {
          if (!sektor) sektor = kkMap[kodeKk].sektor || "";
          if (!noHp) noHp = kkMap[kodeKk].no_hp || "";
          if (!alamat) alamat = kkMap[kodeKk].alamat || "";
        }

        if (!nama) {
          showMsg(messageEl, "Nama lengkap wajib diisi.");
          return;
        }

        if (simpanBtn) simpanBtn.disabled = true;
        showMsg(messageEl, "Menyimpan data jemaat...", false);

        const { error: insertError } = await client.from(TABLE_NAME).insert([
          {
            kode_kk: kodeKk || null,
            nama,
            status_keluarga: hubungan,
            sektor: sektor || null,
            no_hp: noHp || null,
            alamat: alamat || null,
          },
        ]);

        if (simpanBtn) simpanBtn.disabled = false;

        if (insertError) {
          showMsg(messageEl, "Gagal menyimpan: " + insertError.message);
          return;
        }

        form.reset();
        showMsg(messageEl, "Data jemaat berhasil disimpan.", false);
        await loadJemaat(client);
      });
    }

    // Hapus Jemaat
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
          showMsg(messageEl, "Gagal menghapus data: " + deleteError.message);
          return;
        }

        showMsg(messageEl, "Data jemaat berhasil dihapus.", false);
        await loadJemaat(client);
      });
    }

    await loadJemaat(client);
  }

  init();
})();
