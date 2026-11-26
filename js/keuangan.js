(function () {
  const NAMA_BULAN = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const userEmailEl = document.getElementById("userEmail");
  const statusEl = document.getElementById("statusKeuangan");
  const logoutBtn = document.getElementById("logoutBtn");

  // Elemen Ringkasan
  const totalPersepuluhanCard = document.getElementById(
    "totalPersepuluhanCard",
  );
  const totalPembangunanCard = document.getElementById("totalPembangunanCard");
  const totalJanjiImanCard = document.getElementById("totalJanjiImanCard");
  const saldoKasUmumCard = document.getElementById("saldoKasUmumCard");

  // State Master
  let keluargaList = [];
  let keluargaMap = new Map();
  let jemaatList = [];
  let jemaatMap = new Map();

  let dataPersepuluhan = [];
  let dataPembangunan = [];
  let dataTargetJanji = [];
  let dataJanjiIman = [];
  let dataKasUmum = [];

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

  function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(angka) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showMessage(el, text, isError = true) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#b91c1c" : "#15803d";
  }

  function setDefaultDates() {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    [
      "persTanggalInput",
      "pembTanggalInput",
      "janjiTanggalInput",
      "kasTanggalInput",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = todayStr;
    });

    ["persTahunInput", "targetTahunInput", "janjiTahunInput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = currentYear;
    });

    const persBulanSelect = document.getElementById("persBulanSelect");
    if (persBulanSelect) persBulanSelect.value = String(currentMonth);
  }

  function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        const targetId = btn.getAttribute("data-tab");

        tabBtns.forEach((b) => b.classList.remove("active"));
        tabPanels.forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add("active");
      });
    });
  }

  function updateKkDetectionBox(jemaatIdStr, infoBoxEl) {
    if (!infoBoxEl) return;
    if (!jemaatIdStr) {
      infoBoxEl.className = "kk-detect-box warning";
      infoBoxEl.textContent =
        "Pilih nama penyetor untuk mendeteksi kode KK secara otomatis.";
      return;
    }

    const jemaat = jemaatMap.get(String(jemaatIdStr));
    if (!jemaat) {
      infoBoxEl.className = "kk-detect-box warning";
      infoBoxEl.textContent = "Data jemaat tidak ditemukan.";
      return;
    }

    const kk = jemaat.keluarga_id ? keluargaMap.get(jemaat.keluarga_id) : null;
    if (kk) {
      infoBoxEl.className = "kk-detect-box";
      infoBoxEl.textContent = `Terdeteksi Otomatis: ${kk.kode_kk} — Kel. ${kk.nama_kepala_keluarga} (Penyetor: ${jemaat.nama} / ${jemaat.hubungan_keluarga || "Anggota"})`;
    } else {
      infoBoxEl.className = "kk-detect-box warning";
      infoBoxEl.textContent = `Perhatian: ${jemaat.nama} belum dihubungkan ke Kartu Keluarga di menu Data Jemaat.`;
    }
  }

  function renderKkBadgeHtml(keluargaId) {
    const kk = keluargaId ? keluargaMap.get(keluargaId) : null;
    if (!kk) {
      return `<span class="sub-info">Tanpa KK</span>`;
    }
    return `<span class="badge-kk">${escapeHtml(kk.kode_kk)}</span>
            <span class="sub-info">Kel. ${escapeHtml(kk.nama_kepala_keluarga)}</span>`;
  }

  function renderPenyetorHtml(jemaatId) {
    const jemaat = jemaatId ? jemaatMap.get(String(jemaatId)) : null;
    if (!jemaat) return "-";
    return `<strong>${escapeHtml(jemaat.nama)}</strong>
            <span class="sub-info">${escapeHtml(jemaat.hubungan_keluarga || "Anggota")}</span>`;
  }

  function populateDropdowns() {
    const jemaatOptions = jemaatList
      .map((j) => {
        const kk = j.keluarga_id ? keluargaMap.get(j.keluarga_id) : null;
        const labelKk = kk
          ? `${kk.kode_kk} - Kel. ${kk.nama_kepala_keluarga}`
          : "Belum ada KK";
        return `<option value="${escapeHtml(j.id)}">${escapeHtml(j.nama)} (${escapeHtml(
          j.hubungan_keluarga || "Anggota",
        )} | ${escapeHtml(labelKk)})</option>`;
      })
      .join("");

    ["persJemaatSelect", "pembJemaatSelect", "janjiJemaatSelect"].forEach(
      (selectId) => {
        const el = document.getElementById(selectId);
        if (el) {
          el.innerHTML =
            `<option value="">-- Pilih Nama Penyetor --</option>` +
            jemaatOptions;
        }
      },
    );

    const targetKkSelect = document.getElementById("targetKkSelect");
    if (targetKkSelect) {
      const kkOptions = keluargaList
        .map(
          (kk) =>
            `<option value="${escapeHtml(kk.id)}">${escapeHtml(kk.kode_kk)} — Kel. ${escapeHtml(
              kk.nama_kepala_keluarga,
            )}</option>`,
        )
        .join("");
      targetKkSelect.innerHTML =
        `<option value="">-- Pilih Kartu Keluarga --</option>` + kkOptions;
    }
  }

  function updateSummaryCards() {
    const totalPers = dataPersepuluhan.reduce(
      (sum, r) => sum + Number(r.nominal || 0),
      0,
    );
    const totalPemb = dataPembangunan.reduce(
      (sum, r) => sum + Number(r.nominal || 0),
      0,
    );
    const totalJanji = dataJanjiIman.reduce(
      (sum, r) => sum + Number(r.nominal || 0),
      0,
    );

    const saldoKas = dataKasUmum.reduce((sum, r) => {
      const nom = Number(r.nominal || 0);
      return r.jenis === "Pengeluaran" ? sum - nom : sum + nom;
    }, 0);

    if (totalPersepuluhanCard)
      totalPersepuluhanCard.textContent = formatRupiah(totalPers);
    if (totalPembangunanCard)
      totalPembangunanCard.textContent = formatRupiah(totalPemb);
    if (totalJanjiImanCard)
      totalJanjiImanCard.textContent = formatRupiah(totalJanji);
    if (saldoKasUmumCard) saldoKasUmumCard.textContent = formatRupiah(saldoKas);
  }

  function renderPersepuluhanTable() {
    const tbody = document.getElementById("tbodyPersepuluhan");
    if (!tbody) return;

    if (dataPersepuluhan.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7">Belum ada setoran persepuluhan.</td></tr>';
      return;
    }

    tbody.innerHTML = dataPersepuluhan
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.tanggal)}</td>
          <td>${renderKkBadgeHtml(row.keluarga_id)}</td>
          <td>${renderPenyetorHtml(row.jemaat_id)}</td>
          <td>${escapeHtml(NAMA_BULAN[row.bulan] || row.bulan)} ${escapeHtml(row.tahun)}</td>
          <td><strong>${formatRupiah(row.nominal)}</strong></td>
          <td>${escapeHtml(row.keterangan || "-")}</td>
          <td>
            <button type="button" class="btn-hapus-transaksi" data-table="persepuluhan" data-id="${escapeHtml(
              row.id,
            )}">Hapus</button>
          </td>
        </tr>
      `,
      )
      .join("");
  }

  function renderPembangunanTables() {
    const tbodyRiwayat = document.getElementById("tbodyPembangunan");
    const tbodyRekap = document.getElementById("tbodyRekapPembangunan");

    if (tbodyRiwayat) {
      if (dataPembangunan.length === 0) {
        tbodyRiwayat.innerHTML =
          '<tr><td colspan="6">Belum ada setoran pembangunan.</td></tr>';
      } else {
        tbodyRiwayat.innerHTML = dataPembangunan
          .map(
            (row) => `
            <tr>
              <td>${escapeHtml(row.tanggal)}</td>
              <td>${renderKkBadgeHtml(row.keluarga_id)}</td>
              <td>${renderPenyetorHtml(row.jemaat_id)}</td>
              <td><strong>${formatRupiah(row.nominal)}</strong></td>
              <td>${escapeHtml(row.keterangan || "-")}</td>
              <td>
                <button type="button" class="btn-hapus-transaksi" data-table="pembangunan" data-id="${escapeHtml(
                  row.id,
                )}">Hapus</button>
              </td>
            </tr>
          `,
          )
          .join("");
      }
    }

    if (tbodyRekap) {
      const rekapMap = new Map();
      dataPembangunan.forEach((row) => {
        const key = row.keluarga_id || "NO_KK";
        const prev = rekapMap.get(key) || { count: 0, total: 0 };
        prev.count += 1;
        prev.total += Number(row.nominal || 0);
        rekapMap.set(key, prev);
      });

      if (rekapMap.size === 0) {
        tbodyRekap.innerHTML =
          '<tr><td colspan="4">Belum ada rekap pembangunan per KK.</td></tr>';
      } else {
        tbodyRekap.innerHTML = Array.from(rekapMap.entries())
          .map(([kkId, stat]) => {
            const kk = kkId !== "NO_KK" ? keluargaMap.get(kkId) : null;
            return `
              <tr>
                <td>${
                  kk
                    ? `<span class="badge-kk">${escapeHtml(kk.kode_kk)}</span>`
                    : `<span class="sub-info">Tanpa KK</span>`
                }</td>
                <td>${kk ? escapeHtml(kk.nama_kepala_keluarga) : "Belum Terkelompok"}</td>
                <td>${stat.count}x setor</td>
                <td><strong>${formatRupiah(stat.total)}</strong></td>
              </tr>
            `;
          })
          .join("");
      }
    }
  }

  function renderJanjiImanTables() {
    const tbodyProgres = document.getElementById("tbodyProgresJanji");
    const tbodyRiwayat = document.getElementById("tbodyRiwayatJanji");

    if (tbodyRiwayat) {
      if (dataJanjiIman.length === 0) {
        tbodyRiwayat.innerHTML =
          '<tr><td colspan="7">Belum ada setoran janji iman.</td></tr>';
      } else {
        tbodyRiwayat.innerHTML = dataJanjiIman
          .map(
            (row) => `
            <tr>
              <td>${escapeHtml(row.tanggal)}</td>
              <td>${renderKkBadgeHtml(row.keluarga_id)}</td>
              <td>${renderPenyetorHtml(row.jemaat_id)}</td>
              <td>${escapeHtml(row.tahun)}</td>
              <td><strong>${formatRupiah(row.nominal)}</strong></td>
              <td>${escapeHtml(row.keterangan || "-")}</td>
              <td>
                <button type="button" class="btn-hapus-transaksi" data-table="janji_iman" data-id="${escapeHtml(
                  row.id,
                )}">Hapus</button>
              </td>
            </tr>
          `,
          )
          .join("");
      }
    }

    if (tbodyProgres) {
      const barisProgres = [];
      const pasanganSudahAda = new Set();

      // Gabungkan seluruh kombinasi (keluarga_id, tahun) dari tabel target maupun setoran
      dataTargetJanji.forEach((t) => {
        pasanganSudahAda.add(`${t.keluarga_id}__${t.tahun}`);
        barisProgres.push({
          keluarga_id: t.keluarga_id,
          tahun: t.tahun,
          target: Number(t.nominal_target || 0),
        });
      });

      dataJanjiIman.forEach((s) => {
        if (!s.keluarga_id) return;
        const key = `${s.keluarga_id}__${s.tahun}`;
        if (!pasanganSudahAda.has(key)) {
          pasanganSudahAda.add(key);
          barisProgres.push({
            keluarga_id: s.keluarga_id,
            tahun: s.tahun,
            target: 0,
          });
        }
      });

      if (barisProgres.length === 0) {
        tbodyProgres.innerHTML =
          '<tr><td colspan="7">Belum ada target maupun setoran janji iman per KK.</td></tr>';
      } else {
        tbodyProgres.innerHTML = barisProgres
          .map((item) => {
            const kk = keluargaMap.get(item.keluarga_id);
            const totalSetor = dataJanjiIman
              .filter(
                (s) =>
                  s.keluarga_id === item.keluarga_id &&
                  Number(s.tahun) === Number(item.tahun),
              )
              .reduce((sum, s) => sum + Number(s.nominal || 0), 0);

            const sisa = Math.max(0, item.target - totalSetor);
            const statusHtml =
              item.target > 0 && sisa === 0
                ? `<span class="badge-masuk">Lunas</span>`
                : `<span class="badge-kk">Berjalan</span>`;

            return `
              <tr>
                <td><span class="badge-kk">${escapeHtml(kk?.kode_kk || "-")}</span></td>
                <td>${escapeHtml(kk?.nama_kepala_keluarga || "-")}</td>
                <td>${escapeHtml(item.tahun)}</td>
                <td>${formatRupiah(item.target)}</td>
                <td><strong>${formatRupiah(totalSetor)}</strong></td>
                <td>${formatRupiah(sisa)}</td>
                <td>${statusHtml}</td>
              </tr>
            `;
          })
          .join("");
      }
    }
  }

  function renderKasUmumTable() {
    const tbody = document.getElementById("tbodyKasUmum");
    if (!tbody) return;

    if (dataKasUmum.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6">Belum ada transaksi kas umum.</td></tr>';
      return;
    }

    tbody.innerHTML = dataKasUmum
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.tanggal)}</td>
          <td>
            <span class="${row.jenis === "Pengeluaran" ? "badge-keluar" : "badge-masuk"}">
              ${escapeHtml(row.jenis)}
            </span>
          </td>
          <td>${escapeHtml(row.kategori)}</td>
          <td><strong>${formatRupiah(row.nominal)}</strong></td>
          <td>${escapeHtml(row.keterangan || "-")}</td>
          <td>
            <button type="button" class="btn-hapus-transaksi" data-table="kas_umum" data-id="${escapeHtml(
              row.id,
            )}">Hapus</button>
          </td>
        </tr>
      `,
      )
      .join("");
  }

  async function loadAllData(client) {
    const [resKk, resJemaat, resPers, resPemb, resTarget, resJanji, resKas] =
      await Promise.all([
        client
          .from("keluarga")
          .select("id, kode_kk, nama_kepala_keluarga")
          .order("kode_kk"),
        client
          .from("jemaat")
          .select("id, nama, keluarga_id, hubungan_keluarga")
          .order("nama"),
        client
          .from("persepuluhan")
          .select(
            "id, keluarga_id, jemaat_id, bulan, tahun, nominal, tanggal, keterangan",
          )
          .order("tanggal", { ascending: false }),
        client
          .from("pembangunan")
          .select("id, keluarga_id, jemaat_id, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
        client
          .from("janji_iman_target")
          .select("id, keluarga_id, tahun, nominal_target")
          .order("tahun", { ascending: false }),
        client
          .from("janji_iman")
          .select(
            "id, keluarga_id, jemaat_id, tahun, nominal, tanggal, keterangan",
          )
          .order("tanggal", { ascending: false }),
        client
          .from("kas_umum")
          .select("id, jenis, kategori, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
      ]);

    keluargaList = resKk.data || [];
    keluargaMap = new Map(keluargaList.map((k) => [k.id, k]));

    jemaatList = resJemaat.data || [];
    jemaatMap = new Map(jemaatList.map((j) => [String(j.id), j]));

    dataPersepuluhan = resPers.data || [];
    dataPembangunan = resPemb.data || [];
    dataTargetJanji = resTarget.data || [];
    dataJanjiIman = resJanji.data || [];
    dataKasUmum = resKas.data || [];

    populateDropdowns();
    updateSummaryCards();
    renderPersepuluhanTable();
    renderPembangunanTables();
    renderJanjiImanTables();
    renderKasUmumTable();
  }

  async function init() {
    const client = getClient();
    if (!client) {
      if (statusEl) statusEl.textContent = "Klien Supabase belum siap.";
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      window.location.href = "../index.html";
      return;
    }

    if (userEmailEl)
      userEmailEl.textContent = data.session.user.email || "Pengurus Aktif";
    if (statusEl)
      statusEl.textContent =
        "Deteksi KK otomatis aktif untuk seluruh pos keuangan.";

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        logoutBtn.disabled = true;
        await client.auth.signOut();
        window.location.href = "../index.html";
      });
    }

    setDefaultDates();
    setupTabs();

    // Deteksi KK Otomatis saat memilih nama penyetor
    const persJemaatSelect = document.getElementById("persJemaatSelect");
    const persKkInfo = document.getElementById("persKkInfo");
    if (persJemaatSelect) {
      persJemaatSelect.addEventListener("change", () =>
        updateKkDetectionBox(persJemaatSelect.value, persKkInfo),
      );
    }

    const pembJemaatSelect = document.getElementById("pembJemaatSelect");
    const pembKkInfo = document.getElementById("pembKkInfo");
    if (pembJemaatSelect) {
      pembJemaatSelect.addEventListener("change", () =>
        updateKkDetectionBox(pembJemaatSelect.value, pembKkInfo),
      );
    }

    const janjiJemaatSelect = document.getElementById("janjiJemaatSelect");
    const janjiKkInfo = document.getElementById("janjiKkInfo");
    if (janjiJemaatSelect) {
      janjiJemaatSelect.addEventListener("change", () =>
        updateKkDetectionBox(janjiJemaatSelect.value, janjiKkInfo),
      );
    }

    // Submit 1: Persepuluhan
    const formPersepuluhan = document.getElementById("formPersepuluhan");
    const msgPersepuluhan = document.getElementById("msgPersepuluhan");
    if (formPersepuluhan) {
      formPersepuluhan.addEventListener("submit", async function (e) {
        e.preventDefault();
        const jemaat = jemaatMap.get(String(persJemaatSelect.value));
        if (!jemaat) return;

        const btn = document.getElementById("btnSimpanPers");
        if (btn) btn.disabled = true;

        const { error: insErr } = await client.from("persepuluhan").insert([
          {
            jemaat_id: jemaat.id,
            keluarga_id: jemaat.keluarga_id || null,
            bulan: Number(document.getElementById("persBulanSelect").value),
            tahun: Number(document.getElementById("persTahunInput").value),
            nominal: Number(document.getElementById("persNominalInput").value),
            tanggal: document.getElementById("persTanggalInput").value,
            keterangan:
              document.getElementById("persKetInput").value.trim() || null,
          },
        ]);

        if (btn) btn.disabled = false;
        if (insErr) {
          showMessage(msgPersepuluhan, "Gagal menyimpan: " + insErr.message);
          return;
        }

        document.getElementById("persNominalInput").value = "";
        document.getElementById("persKetInput").value = "";
        showMessage(
          msgPersepuluhan,
          "Setoran persepuluhan berhasil dicatat.",
          false,
        );
        await loadAllData(client);
        updateKkDetectionBox("", persKkInfo);
      });
    }

    // Submit 2: Pembangunan
    const formPembangunan = document.getElementById("formPembangunan");
    const msgPembangunan = document.getElementById("msgPembangunan");
    if (formPembangunan) {
      formPembangunan.addEventListener("submit", async function (e) {
        e.preventDefault();
        const jemaat = jemaatMap.get(String(pembJemaatSelect.value));
        if (!jemaat) return;

        const btn = document.getElementById("btnSimpanPemb");
        if (btn) btn.disabled = true;

        const { error: insErr } = await client.from("pembangunan").insert([
          {
            jemaat_id: jemaat.id,
            keluarga_id: jemaat.keluarga_id || null,
            nominal: Number(document.getElementById("pembNominalInput").value),
            tanggal: document.getElementById("pembTanggalInput").value,
            keterangan:
              document.getElementById("pembKetInput").value.trim() || null,
          },
        ]);

        if (btn) btn.disabled = false;
        if (insErr) {
          showMessage(msgPembangunan, "Gagal menyimpan: " + insErr.message);
          return;
        }

        document.getElementById("pembNominalInput").value = "";
        document.getElementById("pembKetInput").value = "";
        showMessage(
          msgPembangunan,
          "Dana pembangunan berhasil dicatat.",
          false,
        );
        await loadAllData(client);
        updateKkDetectionBox("", pembKkInfo);
      });
    }

    // Submit 3A: Target Janji Iman per KK
    const formTargetJanji = document.getElementById("formTargetJanji");
    const msgTargetJanji = document.getElementById("msgTargetJanji");
    if (formTargetJanji) {
      formTargetJanji.addEventListener("submit", async function (e) {
        e.preventDefault();
        const kkId = document.getElementById("targetKkSelect").value;
        const tahun = Number(document.getElementById("targetTahunInput").value);
        const target = Number(
          document.getElementById("targetNominalInput").value,
        );
        if (!kkId) return;

        const btn = document.getElementById("btnSimpanTarget");
        if (btn) btn.disabled = true;

        const { error: upsertErr } = await client
          .from("janji_iman_target")
          .upsert([{ keluarga_id: kkId, tahun, nominal_target: target }], {
            onConflict: "keluarga_id,tahun",
          });

        if (btn) btn.disabled = false;
        if (upsertErr) {
          showMessage(
            msgTargetJanji,
            "Gagal menyimpan target: " + upsertErr.message,
          );
          return;
        }

        document.getElementById("targetNominalInput").value = "";
        showMessage(
          msgTargetJanji,
          "Target janji iman KK berhasil disimpan.",
          false,
        );
        await loadAllData(client);
      });
    }

    // Submit 3B: Setoran Janji Iman
    const formSetorJanji = document.getElementById("formSetorJanji");
    const msgSetorJanji = document.getElementById("msgSetorJanji");
    if (formSetorJanji) {
      formSetorJanji.addEventListener("submit", async function (e) {
        e.preventDefault();
        const jemaat = jemaatMap.get(String(janjiJemaatSelect.value));
        if (!jemaat) return;

        const btn = document.getElementById("btnSimpanJanji");
        if (btn) btn.disabled = true;

        const { error: insErr } = await client.from("janji_iman").insert([
          {
            jemaat_id: jemaat.id,
            keluarga_id: jemaat.keluarga_id || null,
            tahun: Number(document.getElementById("janjiTahunInput").value),
            nominal: Number(document.getElementById("janjiNominalInput").value),
            tanggal: document.getElementById("janjiTanggalInput").value,
            keterangan:
              document.getElementById("janjiKetInput").value.trim() || null,
          },
        ]);

        if (btn) btn.disabled = false;
        if (insErr) {
          showMessage(
            msgSetorJanji,
            "Gagal menyimpan setoran: " + insErr.message,
          );
          return;
        }

        document.getElementById("janjiNominalInput").value = "";
        document.getElementById("janjiKetInput").value = "";
        showMessage(
          msgSetorJanji,
          "Setoran janji iman berhasil dicatat.",
          false,
        );
        await loadAllData(client);
        updateKkDetectionBox("", janjiKkInfo);
      });
    }

    // Submit 4: Kas Umum
    const formKasUmum = document.getElementById("formKasUmum");
    const msgKasUmum = document.getElementById("msgKasUmum");
    if (formKasUmum) {
      formKasUmum.addEventListener("submit", async function (e) {
        e.preventDefault();
        const btn = document.getElementById("btnSimpanKas");
        if (btn) btn.disabled = true;

        const { error: insErr } = await client.from("kas_umum").insert([
          {
            jenis: document.getElementById("kasJenisSelect").value,
            kategori: document.getElementById("kasKategoriInput").value.trim(),
            nominal: Number(document.getElementById("kasNominalInput").value),
            tanggal: document.getElementById("kasTanggalInput").value,
            keterangan:
              document.getElementById("kasKetInput").value.trim() || null,
          },
        ]);

        if (btn) btn.disabled = false;
        if (insErr) {
          showMessage(msgKasUmum, "Gagal menyimpan kas: " + insErr.message);
          return;
        }

        document.getElementById("kasKategoriInput").value = "";
        document.getElementById("kasNominalInput").value = "";
        document.getElementById("kasKetInput").value = "";
        showMessage(msgKasUmum, "Transaksi kas umum berhasil dicatat.", false);
        await loadAllData(client);
      });
    }

    // Delegasi tombol Hapus di semua tabel transaksi
    document
      .querySelector(".main-content")
      .addEventListener("click", async function (e) {
        const btn = e.target.closest(".btn-hapus-transaksi");
        if (!btn) return;

        const table = btn.getAttribute("data-table");
        const id = btn.getAttribute("data-id");
        if (!table || !id) return;

        btn.disabled = true;
        const { error: delErr } = await client
          .from(table)
          .delete()
          .eq("id", id);
        if (delErr) {
          btn.disabled = false;
          alert("Gagal menghapus transaksi: " + delErr.message);
          return;
        }

        await loadAllData(client);
      });

    await loadAllData(client);
  }

  init();
})();
