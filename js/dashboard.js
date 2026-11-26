(function () {
  // Tempel Production URL Webhook n8n khusus analisis AI di sini setelah workflow n8n aktif
  const N8N_ANALISIS_WEBHOOK_URL = "";

  const userEmailEl = document.getElementById("userEmail");
  const statusEl = document.getElementById("statusDashboard");
  const logoutBtn = document.getElementById("logoutBtn");

  let ringkasanKeuanganTerakhir = null;

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

  function buatAnalisisLokal(stat) {
    const baris = [];
    baris.push(
      `• Rasio Belanja Kas Umum: ${stat.rasioBelanjaPersen}% (Pemasukan ${formatRupiah(
        stat.pemasukanKas,
      )} vs Pengeluaran ${formatRupiah(stat.pengeluaranKas)}).`,
    );

    if (stat.pemasukanKas === 0 && stat.pengeluaranKas === 0) {
      baris.push("• Belum ada arus kas umum yang tercatat untuk dianalisis.");
    } else if (stat.rasioBelanjaPersen <= 70) {
      baris.push(
        "• Kondisi kas umum tergolong SEHAT karena pengeluaran masih di bawah 70% dari pemasukan.",
      );
    } else if (stat.rasioBelanjaPersen <= 90) {
      baris.push(
        "• Status WASPADA: pengeluaran sudah menyerap 70%–90% pemasukan kas umum. Prioritaskan belanja rutin yang mendesak.",
      );
    } else {
      baris.push(
        "• Perhatian TINGGI: pengeluaran kas hampir menyamai atau melebihi pemasukan kas umum bulan berjalan.",
      );
    }

    if (stat.targetJanjiTahunIni > 0) {
      baris.push(
        `• Capaian Janji Iman ${stat.tahunIni}: terkumpul ${formatRupiah(
          stat.setorJanjiTahunIni,
        )} dari target ${formatRupiah(stat.targetJanjiTahunIni)} (${stat.persenJanji}%).`,
      );
    }

    baris.push(
      `• Dana khusus terpisah (Persepuluhan ${formatRupiah(
        stat.totalPersepuluhan,
      )} & Pembangunan ${formatRupiah(
        stat.totalPembangunan,
      )}) aman terjaga sesuai peruntukannya.`,
    );

    return baris.join("\n");
  }

  async function muatRingkasanDashboard(client) {
    const tahunIni = new Date().getFullYear();

    const [resKk, resJemaat, resPers, resPemb, resTarget, resJanji, resKas] =
      await Promise.all([
        client.from("keluarga").select("id, kode_kk, nama_kepala_keluarga"),
        client.from("jemaat").select("id, nama, keluarga_id"),
        client
          .from("persepuluhan")
          .select("id, keluarga_id, bulan, tahun, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
        client
          .from("pembangunan")
          .select("id, keluarga_id, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
        client
          .from("janji_iman_target")
          .select("id, keluarga_id, tahun, nominal_target"),
        client
          .from("janji_iman")
          .select("id, keluarga_id, tahun, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
        client
          .from("kas_umum")
          .select("id, jenis, kategori, nominal, tanggal, keterangan")
          .order("tanggal", { ascending: false }),
      ]);

    const keluargaList = resKk.data || [];
    const keluargaMap = new Map(keluargaList.map((k) => [k.id, k]));
    const jemaatList = resJemaat.data || [];

    const dataPers = resPers.data || [];
    const dataPemb = resPemb.data || [];
    const dataTarget = resTarget.data || [];
    const dataJanji = resJanji.data || [];
    const dataKas = resKas.data || [];

    const totalPersepuluhan = dataPers.reduce(
      (s, r) => s + Number(r.nominal || 0),
      0,
    );
    const totalPembangunan = dataPemb.reduce(
      (s, r) => s + Number(r.nominal || 0),
      0,
    );
    const totalJanjiIman = dataJanji.reduce(
      (s, r) => s + Number(r.nominal || 0),
      0,
    );

    const pemasukanKas = dataKas
      .filter((r) => r.jenis === "Pemasukan")
      .reduce((s, r) => s + Number(r.nominal || 0), 0);
    const pengeluaranKas = dataKas
      .filter((r) => r.jenis === "Pengeluaran")
      .reduce((s, r) => s + Number(r.nominal || 0), 0);
    const saldoKas = pemasukanKas - pengeluaranKas;

    const totalDanaKeseluruhan =
      totalPersepuluhan + totalPembangunan + totalJanjiIman + saldoKas;

    // Hitung rasio pengeluaran terhadap pemasukan kas umum
    const rasioBelanjaPersen =
      pemasukanKas > 0
        ? Math.round((pengeluaranKas / pemasukanKas) * 100)
        : pengeluaranKas > 0
          ? 100
          : 0;

    const targetJanjiTahunIni = dataTarget
      .filter((t) => Number(t.tahun) === tahunIni)
      .reduce((s, t) => s + Number(t.nominal_target || 0), 0);
    const setorJanjiTahunIni = dataJanji
      .filter((j) => Number(j.tahun) === tahunIni)
      .reduce((s, j) => s + Number(j.nominal || 0), 0);
    const persenJanji =
      targetJanjiTahunIni > 0
        ? Math.round((setorJanjiTahunIni / targetJanjiTahunIni) * 100)
        : 0;

    ringkasanKeuanganTerakhir = {
      tahunIni,
      totalJemaat: jemaatList.length,
      totalKk: keluargaList.length,
      totalPersepuluhan,
      totalPembangunan,
      totalJanjiIman,
      targetJanjiTahunIni,
      setorJanjiTahunIni,
      persenJanji,
      pemasukanKas,
      pengeluaranKas,
      saldoKas,
      totalDanaKeseluruhan,
      rasioBelanjaPersen,
    };

    // Isi Kartu Ringkasan Utama
    document.getElementById("cardTotalJemaat").textContent = String(
      jemaatList.length,
    );
    document.getElementById("cardTotalKk").textContent =
      `${keluargaList.length} Kartu Keluarga`;
    document.getElementById("cardTotalDana").textContent =
      formatRupiah(totalDanaKeseluruhan);
    document.getElementById("cardSaldoKas").textContent =
      formatRupiah(saldoKas);
    document.getElementById("cardRasioPersen").textContent =
      `${rasioBelanjaPersen}%`;

    // Isi Visual Bar Rasio Kas
    const ratioBarFill = document.getElementById("ratioBarFill");
    const badgeKesehatanKas = document.getElementById("badgeKesehatanKas");
    const cardRasioKet = document.getElementById("cardRasioKet");

    document.getElementById("textPemasukanKas").textContent =
      formatRupiah(pemasukanKas);
    document.getElementById("textPengeluaranKas").textContent =
      formatRupiah(pengeluaranKas);

    if (ratioBarFill) {
      ratioBarFill.style.width = `${Math.min(100, rasioBelanjaPersen)}%`;
      if (rasioBelanjaPersen <= 70) {
        ratioBarFill.style.backgroundColor = "#16a34a";
      } else if (rasioBelanjaPersen <= 90) {
        ratioBarFill.style.backgroundColor = "#d97706";
      } else {
        ratioBarFill.style.backgroundColor = "#dc2626";
      }
    }

    if (pemasukanKas === 0 && pengeluaranKas === 0) {
      badgeKesehatanKas.className = "badge-status";
      badgeKesehatanKas.textContent = "Belum Ada Transaksi";
      cardRasioKet.textContent = "Belum ada transaksi kas";
      document.getElementById("textSisaKasInfo").textContent =
        "Input kolekte dan pengeluaran operasional di menu Keuangan untuk melihat rasio.";
    } else if (rasioBelanjaPersen <= 70) {
      badgeKesehatanKas.className = "badge-status";
      badgeKesehatanKas.textContent = "Kas Sehat";
      cardRasioKet.textContent = "Belanja terkendali (< 70%)";
      document.getElementById("textSisaKasInfo").textContent =
        `Sisa kas operasional saat ini ${formatRupiah(
          saldoKas,
        )} (${100 - rasioBelanjaPersen}% dari pemasukan kas masih tersedia).`;
    } else if (rasioBelanjaPersen <= 90) {
      badgeKesehatanKas.className = "badge-status waspada";
      badgeKesehatanKas.textContent = "Waspada";
      cardRasioKet.textContent = "Belanja mendekati batas";
      document.getElementById("textSisaKasInfo").textContent =
        `Pengeluaran sudah memakai ${rasioBelanjaPersen}% pemasukan kas umum. Sisa dana operasional ${formatRupiah(
          saldoKas,
        )}.`;
    } else {
      badgeKesehatanKas.className = "badge-status tinggi";
      badgeKesehatanKas.textContent = "Pengeluaran Tinggi";
      cardRasioKet.textContent = "Belanja > 90% pemasukan";
      document.getElementById("textSisaKasInfo").textContent =
        `Pengeluaran sudah mencapai ${rasioBelanjaPersen}% dari pemasukan kas umum. Perlu evaluasi pos kebutuhan gereja.`;
    }

    // Isi Rincian 4 Pos Dana
    document.getElementById("posPersepuluhan").textContent =
      formatRupiah(totalPersepuluhan);
    document.getElementById("subPersepuluhan").textContent =
      `${dataPers.length} setoran tercatat`;

    document.getElementById("posPembangunan").textContent =
      formatRupiah(totalPembangunan);
    document.getElementById("subPembangunan").textContent =
      `${dataPemb.length} setoran tercatat`;

    document.getElementById("posJanjiIman").textContent =
      formatRupiah(totalJanjiIman);
    document.getElementById("subJanjiIman").textContent =
      targetJanjiTahunIni > 0
        ? `Target ${tahunIni}: ${formatRupiah(targetJanjiTahunIni)} (${persenJanji}%)`
        : `${dataJanji.length} setoran tercatat`;

    document.getElementById("posKasUmum").textContent = formatRupiah(saldoKas);
    document.getElementById("subKasUmum").textContent = `Masuk ${formatRupiah(
      pemasukanKas,
    )} | Keluar ${formatRupiah(pengeluaranKas)}`;

    // Gabungkan Aktivitas Terbaru dari 4 Pos
    const gabungan = [];

    dataPers.forEach((r) => {
      const kk = r.keluarga_id ? keluargaMap.get(r.keluarga_id) : null;
      gabungan.push({
        tanggal: r.tanggal,
        pos: "Persepuluhan",
        label: kk
          ? `${kk.kode_kk} — Kel. ${kk.nama_kepala_keluarga}`
          : "Tanpa KK",
        isKk: Boolean(kk),
        keterangan: r.keterangan || `Bulan ${r.bulan}/${r.tahun}`,
        nominal: Number(r.nominal || 0),
        isKeluar: false,
      });
    });

    dataPemb.forEach((r) => {
      const kk = r.keluarga_id ? keluargaMap.get(r.keluarga_id) : null;
      gabungan.push({
        tanggal: r.tanggal,
        pos: "Pembangunan",
        label: kk
          ? `${kk.kode_kk} — Kel. ${kk.nama_kepala_keluarga}`
          : "Tanpa KK",
        isKk: Boolean(kk),
        keterangan: r.keterangan || "Dana pembangunan",
        nominal: Number(r.nominal || 0),
        isKeluar: false,
      });
    });

    dataJanji.forEach((r) => {
      const kk = r.keluarga_id ? keluargaMap.get(r.keluarga_id) : null;
      gabungan.push({
        tanggal: r.tanggal,
        pos: "Janji Iman",
        label: kk
          ? `${kk.kode_kk} — Kel. ${kk.nama_kepala_keluarga}`
          : "Tanpa KK",
        isKk: Boolean(kk),
        keterangan: r.keterangan || `Janji Iman ${r.tahun}`,
        nominal: Number(r.nominal || 0),
        isKeluar: false,
      });
    });

    dataKas.forEach((r) => {
      gabungan.push({
        tanggal: r.tanggal,
        pos: `Kas (${r.jenis})`,
        label: r.kategori,
        isKk: false,
        keterangan: r.keterangan || "-",
        nominal: Number(r.nominal || 0),
        isKeluar: r.jenis === "Pengeluaran",
      });
    });

    gabungan.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
    const terbaru = gabungan.slice(0, 8);

    const tbody = document.getElementById("tbodyAktivitasTerbaru");
    if (tbody) {
      if (terbaru.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5">Belum ada transaksi keuangan. Mulai catat melalui menu Keuangan.</td></tr>';
      } else {
        tbody.innerHTML = terbaru
          .map(
            (item) => `
            <tr>
              <td>${escapeHtml(item.tanggal)}</td>
              <td><strong>${escapeHtml(item.pos)}</strong></td>
              <td>${
                item.isKk
                  ? `<span class="badge-kk">${escapeHtml(item.label)}</span>`
                  : escapeHtml(item.label)
              }</td>
              <td>${escapeHtml(item.keterangan)}</td>
              <td style="color: ${item.isKeluar ? "#b91c1c" : "#15803d"}; font-weight: 700;">
                ${item.isKeluar ? "-" : "+"}${formatRupiah(item.nominal)}
              </td>
            </tr>
          `,
          )
          .join("");
      }
    }
  }

  async function init() {
    const client = getClient();
    if (!client) {
      if (statusEl) statusEl.textContent = "Klien Supabase belum siap.";
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      window.location.href = "index.html";
      return;
    }

    if (userEmailEl) {
      userEmailEl.textContent = data.session.user.email || "Pengurus Aktif";
    }
    if (statusEl) {
      statusEl.textContent =
        "Login aktif. Data jemaat dan keuangan terhubung langsung.";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        logoutBtn.disabled = true;
        await client.auth.signOut();
        window.location.href = "index.html";
      });
    }

    const btnAnalisisAi = document.getElementById("btnAnalisisAi");
    const hasilAnalisisAi = document.getElementById("hasilAnalisisAi");
    if (btnAnalisisAi && hasilAnalisisAi) {
      btnAnalisisAi.addEventListener("click", async function () {
        if (!ringkasanKeuanganTerakhir) return;

        // Jika Webhook n8n belum ditempel, tampilkan ringkasan rasio otomatis lokal
        if (!N8N_ANALISIS_WEBHOOK_URL) {
          hasilAnalisisAi.textContent =
            buatAnalisisLokal(ringkasanKeuanganTerakhir) +
            "\n\n(Info: Tempel Production URL Webhook n8n ke variabel N8N_ANALISIS_WEBHOOK_URL di js/dashboard.js untuk mengaktifkan saran AI OpenRouter.)";
          return;
        }

        btnAnalisisAi.disabled = true;
        hasilAnalisisAi.textContent =
          "Mengirim angka rasio ke AI OpenRouter via n8n...";

        try {
          const resp = await fetch(N8N_ANALISIS_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ringkasanKeuanganTerakhir),
          });
          const result = await resp.json();
          hasilAnalisisAi.textContent =
            result.analisis ||
            result.output ||
            result.text ||
            result.message ||
            buatAnalisisLokal(ringkasanKeuanganTerakhir);
        } catch (err) {
          hasilAnalisisAi.textContent =
            "Gagal terhubung ke webhook n8n. Berikut ringkasan otomatis:\n\n" +
            buatAnalisisLokal(ringkasanKeuanganTerakhir);
        } finally {
          btnAnalisisAi.disabled = false;
        }
      });
    }

    await muatRingkasanDashboard(client);
  }

  init();
})();
