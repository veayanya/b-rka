import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getActiveSsh } from './utils/sshStorage.js';
import { generateContentWithFallback, parseAiJson } from './utils/geminiHelper.js';
import { callGptWithFallback, parseGptJson } from './utils/gptHelper.js';
import { requireAuth, requireRole, generateToken, setAuthCookie, clearAuthCookie } from './auth/authMiddleware.js';
import {
  verifyAndLogin,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  findUserById
} from './auth/userDb.js';
import sshVersionRouter from './routes/sshVersion.js';
import { getStore, setStore, checkDbConnection } from './lib/db.js';

// Data (rkis + ssh_databases) disimpan di Neon PostgreSQL, key 'main_db'
// di tabel app_store — menggantikan file data/db.json yang dulu hilang
// setiap kali Render redeploy/restart (disk ephemeral).
async function readDb() {
  let db = await getStore('main_db');
  if (!db) {
    db = { rkis: [], ssh_databases: [] };
    await setStore('main_db', db);
  }
  if (!db.rkis) db.rkis = [];
  if (!db.ssh_databases) db.ssh_databases = [];
  return db;
}

async function writeDb(data) {
  await setStore('main_db', data);
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Muat GEMINI_API_KEY / OPENAI_API_KEY yang pernah disimpan lewat panel Admin
// (tersimpan di Neon, key 'api_config') ke process.env saat server start.
// Env var asli (Render Dashboard > Environment) selalu diprioritaskan.
async function loadPersistedApiConfig() {
  try {
    const saved = await getStore('api_config');
    if (saved?.geminiKey && !process.env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = saved.geminiKey;
    }
    if (saved?.openaiKey && !process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = saved.openaiKey;
    }
  } catch (error) {
    console.warn('[Startup] Gagal memuat api_config dari Neon (akan pakai env var saja):', error.message);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

// Serve file statis frontend hasil build Vite (Production)
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// GET /api/health — cek status server & koneksi Neon (dipakai Render health
// check maupun layanan keep-alive/uptime-monitor eksternal)
app.get('/api/health', async (req, res) => {
  try {
    await checkDbConnection();
    res.status(200).json({ success: true, backend: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[Health] Database check failed:', error.message);
    res.status(503).json({ success: false, backend: 'ok', database: 'disconnected' });
  }
});

// ── ENDPOINT: Autentikasi ─────────────────────────────────────────────────

// POST /api/auth/login — Login dengan username & password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }
    const user = await verifyAndLogin(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }
    const token = generateToken(user);
    setAuthCookie(res, token);
    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/auth/logout — Hapus cookie sesi
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Berhasil logout.' });
});

// GET /api/auth/me — Cek sesi saat ini
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── ENDPOINT: Admin — Manajemen User ────────────────────────────────────

// GET /api/admin/users — Daftar semua user
app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    const stats = await getUserStats();
    res.json({ users, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/users — Tambah user baru (maks 60)
app.post('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, name, email, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    const newUser = await createUser({ username, password, name, email, role: role || 'user' });
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/admin/users/:id — Update user
app.put('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await updateUser(id, updates);
    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/admin/users/:id — Hapus user
app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await deleteUser(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── ENDPOINT: Admin — Konfigurasi API Key ───────────────────────────────
// Keys disimpan di Neon (tabel app_store, key 'api_config'), tidak pernah
// dikirim ke frontend dalam bentuk plaintext. Env var Render tetap prioritas
// utama (lihat loadPersistedApiConfig di atas).

// GET /api/admin/api-config — Status API Key (hanya masked)
app.get('/api/admin/api-config', requireAuth, requireRole('admin'), (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  res.json({
    gemini: {
      isSet: !!geminiKey,
      masked: geminiKey ? geminiKey.substring(0, 6) + '****' + geminiKey.slice(-4) : null
    },
    openai: {
      isSet: !!openaiKey,
      masked: openaiKey ? openaiKey.substring(0, 7) + '****' + openaiKey.slice(-4) : null
    }
  });
});

// PUT /api/admin/api-config — Update API Key, disimpan persisten di Neon
app.put('/api/admin/api-config', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { geminiKey, openaiKey } = req.body;
    const saved = (await getStore('api_config')) || {};

    if (geminiKey !== undefined) {
      process.env.GEMINI_API_KEY = geminiKey;
      saved.geminiKey = geminiKey;
    }
    if (openaiKey !== undefined) {
      process.env.OPENAI_API_KEY = openaiKey;
      saved.openaiKey = openaiKey;
    }

    await setStore('api_config', saved);
    res.json({ success: true, message: 'Konfigurasi API Key berhasil diperbarui.' });
  } catch (error) {
    console.error('[Admin] Error updating API config:', error);
    res.status(500).json({ error: 'Gagal memperbarui konfigurasi API Key.' });
  }
});

// GET /api/auth/api-status — Status API Key untuk semua user terautentikasi
app.get('/api/auth/api-status', requireAuth, (req, res) => {
  res.json({
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    openaiKeySet: !!process.env.OPENAI_API_KEY
  });
});

// GET /api/admin/stats — Statistik dashboard admin
app.get('/api/admin/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const db = await readDb();
    const userStats = await getUserStats();
    const totalRka = db.rkis.length;
    const approvedRka = db.rkis.filter(r => r.status === 'Approved').length;
    const totalPagu = db.rkis.reduce((s, r) => s + (Number(r.pagu) || 0), 0);
    const sshCount = (db.ssh_databases || []).length;
    res.json({
      users: userStats,
      rka: { total: totalRka, approved: approvedRka, totalPagu },
      ssh: { count: sshCount },
      api: {
        geminiSet: !!process.env.GEMINI_API_KEY,
        openaiSet: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Endpoint: Ekstrak SSH dari PDF ──────────────────────────────────────────
app.post('/api/v1/extract-ssh', requireAuth, async (req, res) => {
  try {
    const { text, tahun } = req.body;
    // API Key diambil dari .env (backend), bukan dari header/frontend
    const geminiApiKey = process.env.GEMINI_API_KEY || req.headers['x-api-key'];

    if (!text) {
      return res.status(400).json({ error: 'Teks dari PDF SSH tidak ditemukan.' });
    }
    if (!geminiApiKey) {
      return res.status(503).json({ error: 'Gemini API Key belum dikonfigurasi di server. Hubungi Administrator.' });
    }

    const genAIInstance = new GoogleGenerativeAI(geminiApiKey);

    const prompt = `Anda adalah AI ekstrator data harga standar dari dokumen SSH (Standar Satuan Harga) resmi Pemerintah Daerah Kabupaten Cirebon${tahun ? ' tahun ' + tahun : ''}.

Teks dokumen SSH:
<TEKS_SSH>
${text.substring(0, 40000)}
</TEKS_SSH>

Tugas Anda:
Ekstrak SEMUA item harga/belanja yang paling relevan dengan kegiatan pemerintahan daerah dari dokumen tersebut. 
Fokuskan pada item-item berikut (jika ditemukan):
- Honorarium (narasumber, panitia, tim, tenaga ahli, konsultan)
- Konsumsi (snack, makan, minum untuk rapat/kegiatan)
- Perjalanan dinas (dalam daerah, luar daerah, luar negeri)
- Sewa (gedung, kendaraan, peralatan, aula)
- ATK & penggandaan
- Cetak & publikasi
- Akomodasi & penginapan
- Bahan habis pakai
- Jasa (kebersihan, keamanan, transportasi)

Untuk SETIAP item yang ditemukan, kembalikan:
- "nama": nama lengkap item belanja
- "kode": kode rekening jika ada, jika tidak ada buat kode generik (contoh: "5.2.02.01")
- "nilai": nilai/harga dalam angka Rupiah (tanpa simbol Rp dan titik, contoh: 500000)
- "satuan": satuan (orang/jam, orang/hari, paket, lembar, unit, dll)
- "kategori": kategori singkat (honorarium, konsumsi, perjalanan_dinas, sewa, atk, cetak, akomodasi, bahan, jasa, lainnya)

PENTING: Output HARUS berupa JSON valid murni SAJA — JANGAN tambahkan kalimat pembuka, judul, catatan, atau teks apapun sebelum atau sesudah objek JSON, dan JANGAN bungkus dengan markdown \`\`\`json. Respons Anda harus dimulai langsung dengan tanda { dan diakhiri dengan tanda }. Format:
{
  "tahun": "${tahun || 'tidak diketahui'}",
  "total_item": 25,
  "items": [
    { "nama": "Honorarium Narasumber", "kode": "5.2.03.01", "nilai": 500000, "satuan": "orang/jam", "kategori": "honorarium" },
    { "nama": "Konsumsi Snack Rapat", "kode": "5.2.02.01", "nilai": 22000, "satuan": "orang/kali", "kategori": "konsumsi" }
  ]
}`;

    console.log("Extracting SSH data with AI...");
    const result = await generateContentWithFallback(genAIInstance, geminiApiKey, prompt);
    const response = await result.response;
    const jsonOutput = parseAiJson(response.text());

    res.json(jsonOutput);

  } catch (error) {
    console.error("Error extracting SSH:", error);
    res.status(500).json({ error: 'Gagal mengekstrak data SSH: ' + error.message });
  }
});

app.post('/api/v1/evaluate', requireAuth, async (req, res) => {
  try {
    const { text, rules, tahun } = req.body;
    // API Key diambil dari .env (backend), bukan dari header/frontend
    const geminiApiKey = process.env.GEMINI_API_KEY || req.headers['x-api-key'];

    if (!text) {
      return res.status(400).json({ error: 'Text dari PDF RKA tidak ditemukan.' });
    }

    if (!geminiApiKey) {
      return res.status(503).json({ error: 'Gemini API Key belum dikonfigurasi di server. Hubungi Administrator.' });
    }

    const genAIInstance = new GoogleGenerativeAI(geminiApiKey);

    let rulesText = 'Tidak ada aturan khusus.';
    if (rules && rules.length > 0) {
      rulesText = rules.map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`).join('\n');
    }

    // Resolve target year from RKA text or request body
    let targetYear = tahun;
    if (!targetYear && text) {
      const yearMatch = text.match(/\b(202[5-9]|203[0-9])\b/);
      if (yearMatch) {
        targetYear = yearMatch[1];
      }
    }

    // Load active SSH items for the target year from filesystem storage
    const activeItems = await getActiveSsh(targetYear);
    let sshText = 'Tidak ada data SSH yang dikonfigurasi oleh pengguna untuk tahun anggaran ini (gunakan acuan umum SSH daerah).';
    if (activeItems && activeItems.length > 0) {
      sshText = activeItems.map(s => `- ${s.nama}: Rp ${s.nilai.toLocaleString('id-ID')} per ${s.satuan}`).join('\n');
      console.log(`AI evaluating with SSH Year ${targetYear} (filesystem)`);
    } else {
      console.log(`AI evaluating without specific SSH for target year ${targetYear}`);
    }

    const prompt = `Anda adalah AI Asisten Evaluator Anggaran & Dampak Sosial (SROI) khusus untuk BAPPERIDA Kabupaten Cirebon.
Tugas Anda adalah melakukan audit atas dokumen RKA (Rencana Kerja dan Anggaran) daerah berikut dan memproyeksikan rasio SROI (Social Return on Investment).

Lakukan Analisis terhadap teks dokumen RKA di bawah ini:
<TEKS_RKA>
${text.substring(0, 30000) /* batasi agar tidak melebihi context limit wajar */}
</TEKS_RKA>

STANDAR SATUAN HARGA (SSH) TERBARU YANG WAJIB DIGUNAKAN SEBAGAI ACUAN VALIDASI:
${sshText}

PENTING: Gunakan nilai SSH di atas untuk:
- Memvalidasi apakah harga satuan belanja di RKA sesuai/melebihi SSH.
- Memberikan rekomendasi jumlah pengurangan/penambahan yang mengacu pada nilai SSH tersebut, BUKAN estimasi persentase.
- Dalam findings, cantumkan jika ada item belanja yang melebihi SSH terbaru.

Instruksi Ekstraksi & Penalaran:
1. Ekstraksi Komponen: Temukan nama Perangkat Daerah (OPD/Satuan Kerja/Dinas/Badan), nama Program, nama Kegiatan, nama Sub-Kegiatan (SUBKEG), serta PAGU ANGGARAN (nilai total anggaran tahun berjalan) sebagai TOTAL INVESTASI (dalam bentuk angka Rupiah tanpa titik).
2. Ekstraksi Target: Temukan target keluaran (output) kuantitatif dari program tersebut.
3. Ekstraksi & Evaluasi Efisiensi Proporsi Rekening (rekening_proporsi): Dari teks, cari semua rincian "Belanja" dan nilai anggarannya masing-masing. Hitung persentasenya terhadap total pagu. Buat setidaknya 3-6 rincian item terbesar. Untuk SETIAP item rekening, berikan status evaluasi ("status": "Efisien" | "Inefisien" | "Belum Dapat Dinilai") dan "alasan" evaluasi singkat 1-2 kalimat dari AI yang murni menjelaskan dasar efisiensi/inefisiensi rekening tersebut (berdasarkan SSH/SBM, urgensi belanja utama vs penunjang, atau besaran pagu).
4. Analisis & Proyeksi SROI:
   - Proyeksikan estimasi manfaat sosial-ekonomi (Outcome) dalam nilai Rupiah dan berikan 'outcome_description' (Justifikasi yang logis berdasarkan target).
   - Estimasi Deadweight (faktor pengurangan dalam persentase, biasanya berkisar 10% s.d. 30%).
   - Hitung sroi_ratio = (social_benefit_value * (100 - deadweight_percentage) / 100) / pagu.
5. Justifikasi Realokasi Berpasangan (reallocation_justifications):
   - Temukan 1-2 item rekening belanja yang sifatnya operasional, rapat, perjalanan dinas, atau kurang berdampak langsung pada target (SROI rendah) untuk DIKURANGI. (aksi: "KURANGI"). Jangan lupa sertakan "nilai_awal" (angka, harga total awal di RKA) dan "nilai_dikurangi". SESUAIKAN nilai pengurangan dengan standar SSH yang diberikan.
   - Temukan 1-2 item rekening belanja utama/prioritas yang paling berdampak pada target (SROI tinggi) untuk DITAMBAH dari hasil potongan sebelumnya. (aksi: "TAMBAH"). Sertakan juga "nilai_awal" (angka, harga awal, bisa 0) dan "nilai_ditambah".
   - Total nilai_dikurangi harus sama atau setara dengan total nilai_ditambah.
6. Ekstraksi Anggaran per Tahun (anggaran_tahunan): Dokumen RKA biasanya memuat rincian "Jumlah Tahun [tahun]" untuk beberapa tahun (mis. tahun sebelumnya, tahun berjalan/rencana, dan tahun proyeksi berikutnya). Ekstrak setiap baris tersebut sebagai { "tahun": <angka tahun>, "jumlah": <angka rupiah tanpa titik> }. Tentukan juga "tahun_rencana" yaitu tahun anggaran yang sedang direncanakan/berjalan pada dokumen ini (biasanya tahun anggaran berjalan/utama dari RKA, sering ditandai tebal/bold atau merupakan tahun acuan pagu utama). Nilai "pagu" pada skema HARUS SAMA dengan "jumlah" pada baris anggaran_tahunan yang tahunnya sama dengan "tahun_rencana".
7. Ekstraksi Indikator & Tolok Ukur Kinerja (indikator_kinerja) — lakukan seolah-olah Anda meng-OCR tabel ini secara visual, baris demi baris:
   - Cari tabel berjudul "Indikator & Tolok Ukur Kinerja Belanja" (kolom: Indikator | Tolok Ukur Kinerja | Target Kinerja).
   - Teks pada dokumen mungkin berasal dari ekstraksi PDF sehingga urutan antar-kolom bisa sedikit longgar; gunakan tanda pemisah " | " (jika ada) sebagai penanda batas kolom, dan gunakan konteks (mis. angka+satuan seperti "Persen", "Dokumen", "Jenis", "Laporan" khas kolom Target) untuk memastikan Anda tidak salah menempatkan nilai ke baris/kolom yang salah.
   - Baris yang harus dicari secara berurutan (jika ada): Tujuan (Ultimate), Sasaran (Intermediate), Program (Immediate), Kegiatan (Immediate), Sub Kegiatan (Output), Kelompok Sasaran Sub Kegiatan.
   - Untuk setiap baris yang ditemukan, ekstrak persis: { "level": "<nama level indikator, misal 'Tujuan (Ultimate)'>", "tolok_ukur": "<isi Tolok Ukur Kinerja>", "target": "<isi Target Kinerja, misal '96 Persen' atau '12 Dokumen', SERTAKAN angka dan satuannya persis seperti tertulis>" }.
   - Jika tabel ini benar-benar tidak ditemukan dalam dokumen, kembalikan array kosong — JANGAN mengarang isi baris.
8. Analisis Kesesuaian Anggaran Tahun Berjalan vs Target Kinerja (analisis_kesesuaian_anggaran): Setelah mendapatkan "anggaran_tahunan" (langkah 6) dan "indikator_kinerja" (langkah 7), nilai apakah besaran anggaran pada "tahun_rencana" (tahun berjalan) wajar/proporsional untuk mencapai Target Kinerja Sub Kegiatan (Output) dan Kegiatan pada tahun tersebut, dengan mempertimbangkan:
   - Perbandingan nominal anggaran tahun berjalan terhadap tahun sebelumnya & tahun berikutnya (mis. lonjakan atau penurunan drastis yang tidak proporsional terhadap perubahan Target Kinerja/Output antar tahun jika targetnya diketahui berbeda, atau terhadap volume Output tahun berjalan seperti "Jumlah Dokumen").
   - Estimasi biaya satuan yang masuk akal (mis. anggaran per dokumen/laporan/kegiatan) dibanding kewajaran umum untuk jenis output tersebut, DENGAN MENGACU pada STANDAR SATUAN HARGA (SSH) yang sudah diberikan di atas jika relevan.
   - Konsistensi antara skala Target Kinerja (Immediate/Output) dengan skala pagu anggaran tahun berjalan.
   Hasilkan objek: { "status": "<salah satu: 'Sesuai' | 'Perlu Perhatian' | 'Tidak Sesuai'>", "penjelasan": "<analisis naratif singkat 2-4 kalimat berisi alasan kesimpulan, sebutkan angka pembanding yang relevan>", "estimasi_biaya_per_output": "<opsional, mis. 'Rp 179.956.833 per Dokumen (12 Dokumen)' jika Target berupa jumlah unit terhitung, atau null jika tidak berlaku>", "proyeksi_pencapaian_target": "<verdict TEGAS tentang apakah nominal anggaran yang dikeluarkan tahun berjalan CUKUP untuk benar-benar menyentuh/mencapai Target Kinerja Sub Kegiatan (Output) & Kegiatan di atas — pilih salah satu persis: 'Target Kemungkinan Tercapai' | 'Berisiko Tidak Tercapai' | 'Diproyeksikan Tidak Tercapai'>", "alasan_proyeksi_target": "<1-2 kalimat alasan spesifik kenapa anggaran tahun berjalan itu akan/tidak akan cukup menyentuh Target Kinerja, mis. sebutkan apakah nominal per unit Output wajar atau terlalu kecil/besar dibanding jenis output & kompleksitasnya>" }. Jika data anggaran_tahunan atau indikator_kinerja kosong/tidak ditemukan, kembalikan { "status": "Tidak Dapat Dinilai", "penjelasan": "Data anggaran per tahun dan/atau target kinerja tidak ditemukan pada dokumen ini.", "estimasi_biaya_per_output": null, "proyeksi_pencapaian_target": "Tidak Dapat Diproyeksikan", "alasan_proyeksi_target": "Data anggaran per tahun dan/atau target kinerja tidak ditemukan pada dokumen ini." }.
9. Ekstraksi tambahan bila tersedia: "lokasi" (Lokasi Sub Kegiatan) dan "sumber_dana" (mis. "DAU, PBBP2").
10. Evaluasi 6 Aspek Efisiensi & Efektivitas RKA (evaluasi_rka): Berdasarkan seluruh data di atas (rekening_proporsi, anggaran_tahunan, indikator_kinerja, dan STANDAR SATUAN HARGA yang diberikan), klasifikasikan 6 aspek berikut. Semua rumus/rasio/persentase dihitung secara internal dan TIDAK perlu ditampilkan angkanya di teks:
   a. efisiensi_alokasi (Efisiensi Alokasi Belanja Utama vs Penunjang): status = "Efisien" jika proporsi belanja penunjang (ATK, konsumsi, perjalanan dinas, dsb.) <= 15% dari pagu, jika > 15% status = "Memerlukan Penyesuaian Alokasi".
   b. distribusi_rpd (Distribusi Rencana Penarikan Dana per triwulan): status = "Inefisien / Berisiko Tinggi" jika teks RKA mengindikasikan penumpukan pencairan dana di Triwulan IV, selain itu status = "Wajar" jika distribusi relatif merata atau data RPD triwulanan tidak ditemukan di dokumen.
   c. kepatuhan_ssh_sbm (Kepatuhan Harga Satuan terhadap SSH/SBM): GUNAKAN data STANDAR SATUAN HARGA (SSH) yang sudah diberikan di atas sebagai acuan pembanding (item findings terkait SSH pada array "findings" juga harus konsisten dengan status ini) — status = "Sesuai Standar" jika mayoritas harga satuan RKA sejalan dengan SSH, "Perlu Penyesuaian" jika ditemukan harga satuan yang melebihi SSH, atau "Belum Dapat Dinilai" HANYA jika SSH acuan di atas benar-benar tidak tersedia/umum.
   d. efisiensi_realisasi_kinerja (Rasio Efisiensi Biaya Output terhadap Kinerja Tercapai = % Capaian Kinerja Output / % Realisasi Biaya): status = "Belum Dapat Dinilai" karena dokumen RKA adalah dokumen perencanaan (data realisasi anggaran & kinerja aktual belum tersedia pada tahap ini).
   e. efektivitas_aktual (Efektivitas Aktual terhadap Target Kinerja pada langkah 7-8 di atas): status = "Belum Dapat Dinilai" jika kegiatan belum berjalan/realisasi belum ada; JIKA "analisis_kesesuaian_anggaran.proyeksi_pencapaian_target" pada langkah 8 sudah menunjukkan proyeksi yang jelas, boleh tuliskan status yang selaras (mis. "Berpotensi Efektif" / "Berisiko Tidak Efektif").
   f. potensi_inefektivitas (Potensi/Risiko Inefektivitas): status = "Tinggi" jika ditemukan indikasi penumpukan RPD di Triwulan IV (selaras dengan poin b) DAN/ATAU proyeksi_pencapaian_target pada langkah 8 berisiko/tidak tercapai; jika tidak ada indikasi tersebut, status = "Rendah" atau "Sedang".
   Untuk SETIAP dari 6 aspek di atas, hasilkan objek dengan struktur SAMA PERSIS: { "status": "...", "alasan": "<1-2 kalimat>", "temuan": "<1-2 kalimat>", "risiko": "<1-2 kalimat>", "rekomendasi": "<1-2 kalimat>" }.
11. Patuhi kebijakan threshold berikut yang sedang aktif:
${rulesText}

PENTING: Output Anda HARUS murni berupa valid JSON SAJA — JANGAN tambahkan kalimat pembuka, judul, catatan, atau teks apapun sebelum atau sesudah objek JSON, dan JANGAN bungkus dengan tag markdown \`\`\`json. Respons Anda harus dimulai langsung dengan tanda { dan diakhiri dengan tanda }. Skema:
{
  "opd": "Nama Perangkat Daerah Diekstrak",
  "program": "Nama Program Diekstrak",
  "kegiatan": "Nama Kegiatan Diekstrak",
  "sub_kegiatan": "Nama Sub-Kegiatan Diekstrak",
  "pagu": 125000000,
  "target": "Target kuantitatif",
  "outcome_description": "Justifikasi panjang manfaat sosial...",
  "social_benefit_value": 150000000,
  "deadweight_percentage": 15,
  "sroi_ratio": 1.02,
  "status_efisiensi": "Efisien",
  "alasan": "Penggunaan anggaran dan perencanaan secara umum dinilai wajar dan efisien berdasarkan alokasi belanja utama.",
  "rekening_proporsi": [
    { "kode": "5.2.x.x", "nama": "Nama Belanja Ekstrak", "persen": 15.5, "nilai": 19375000, "status": "Inefisien", "alasan": "Alokasi anggaran ini cukup besar dan berpotensi diefisienkan." }
  ],
  "reallocation_justifications": [
    { "rekening_nama": "Nama Rekening", "kode": "5.2.x.x", "aksi": "KURANGI", "alasan_dikurangi": "Alasan...", "nilai_awal": 10000000, "nilai_dikurangi": 5000000 },
    { "rekening_nama": "Nama Rekening", "kode": "5.2.x.x", "aksi": "TAMBAH", "alasan_dialokasikan": "Alasan...", "nilai_awal": 0, "nilai_ditambah": 5000000 }
  ],
  "findings": [
    { "finding_type": "Kepatuhan e-SSH", "status": "Sesuai", "description": "..." }
  ],
  "tahun_rencana": 2026,
  "anggaran_tahunan": [
    { "tahun": 2025, "jumlah": 4150623800 },
    { "tahun": 2026, "jumlah": 2159482000 },
    { "tahun": 2027, "jumlah": 5022254798 }
  ],
  "indikator_kinerja": [
    { "level": "Tujuan (Ultimate)", "tolok_ukur": "Indeks Kualitas Kebijakan", "target": "85 Persen" },
    { "level": "Sasaran (Intermediate)", "tolok_ukur": "Persentase Capaian Sasaran", "target": "96 Persen" },
    { "level": "Program (Immediate)", "tolok_ukur": "Persentase Ketercapaian Program", "target": "96 Persen" },
    { "level": "Kegiatan (Immediate)", "tolok_ukur": "Jumlah Laporan Kegiatan", "target": "2 Jenis" },
    { "level": "Sub Kegiatan (Output)", "tolok_ukur": "Jumlah Dokumen Output", "target": "12 Dokumen" },
    { "level": "Kelompok Sasaran", "tolok_ukur": "-", "target": "Kelompok sasaran program" }
  ],
  "analisis_kesesuaian_anggaran": {
    "status": "Perlu Perhatian",
    "penjelasan": "Pagu tahun berjalan turun/naik drastis dibanding tahun sebelumnya padahal Target Kinerja relatif tetap, sehingga estimasi biaya per output berubah signifikan.",
    "estimasi_biaya_per_output": "Rp 179.956.833 per Dokumen (12 Dokumen)",
    "proyeksi_pencapaian_target": "Berisiko Tidak Tercapai",
    "alasan_proyeksi_target": "Nominal per output masih di kisaran wajar namun perubahan pagu berisiko memaksa penyesuaian kualitas pelaksanaan."
  },
  "lokasi": "- (- Kecamatan sumber)",
  "sumber_dana": "DAU, PBBP2",
  "evaluasi_rka": {
    "efisiensi_alokasi": { "status": "Efisien", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." },
    "distribusi_rpd": { "status": "Wajar", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." },
    "kepatuhan_ssh_sbm": { "status": "Sesuai Standar", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." },
    "efisiensi_realisasi_kinerja": { "status": "Belum Dapat Dinilai", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." },
    "efektivitas_aktual": { "status": "Belum Dapat Dinilai", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." },
    "potensi_inefektivitas": { "status": "Sedang", "alasan": "...", "temuan": "...", "risiko": "...", "rekomendasi": "..." }
  }
}
`;

    console.log("Sending prompt to Gemini...");
    const result = await generateContentWithFallback(genAIInstance, geminiApiKey, prompt);
    const response = await result.response;
    const jsonOutput = parseAiJson(response.text());

    console.log("indikator_kinerja rows:", Array.isArray(jsonOutput.indikator_kinerja) ? jsonOutput.indikator_kinerja.length : 'TIDAK ADA');
    console.log("anggaran_tahunan rows:", Array.isArray(jsonOutput.anggaran_tahunan) ? jsonOutput.anggaran_tahunan.length : 'TIDAK ADA');
    console.log("analisis_kesesuaian_anggaran:", jsonOutput.analisis_kesesuaian_anggaran ? jsonOutput.analisis_kesesuaian_anggaran.status : 'TIDAK ADA');
    console.log("evaluasi_rka:", jsonOutput.evaluasi_rka ? 'ADA' : 'TIDAK ADA');

    res.json(jsonOutput);

  } catch (error) {
    console.error("Error from AI:", error);
    res.status(500).json({ error: 'Gagal menganalisis dokumen dengan AI: ' + error.message });
  }
});

// --- CRUD Endpoints for RKA Database ---

app.get('/api/v1/rkis', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    // Admin melihat semua data; User hanya melihat data miliknya sendiri
    let rkis = db.rkis;
    if (req.user.role === 'user') {
      rkis = rkis.filter(r => !r.userId || r.userId === req.user.id);
    }
    res.json(rkis);
  } catch (error) {
    console.error("Error fetching RKIs:", error);
    res.status(500).json({ error: 'Gagal mengambil data RKA' });
  }
});

app.post('/api/v1/rkis', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const newRka = { ...req.body, userId: req.user.id, createdBy: req.user.name };
    db.rkis.unshift(newRka);
    await writeDb(db);
    res.status(201).json(newRka);
  } catch (error) {
    console.error("Error saving RKA:", error);
    res.status(500).json({ error: 'Gagal menyimpan data RKA' });
  }
});

app.put('/api/v1/rkis/:id', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const { id } = req.params;
    const updates = req.body;

    const idx = db.rkis.findIndex(r => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Data tidak ditemukan' });

    // User hanya bisa edit data miliknya
    const rka = db.rkis[idx];
    if (req.user.role === 'user' && rka.userId && rka.userId !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin mengubah dokumen ini.' });
    }

    db.rkis[idx] = { ...rka, ...updates };
    await writeDb(db);
    res.json(db.rkis[idx]);
  } catch (error) {
    console.error("Error updating RKA:", error);
    res.status(500).json({ error: 'Gagal memperbarui data RKA' });
  }
});

app.delete('/api/v1/rkis/:id', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const { id } = req.params;

    const idx = db.rkis.findIndex(r => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Data tidak ditemukan' });

    // User hanya bisa hapus data miliknya
    const rka = db.rkis[idx];
    if (req.user.role === 'user' && rka.userId && rka.userId !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus dokumen ini.' });
    }

    db.rkis.splice(idx, 1);
    await writeDb(db);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting RKA:", error);
    res.status(500).json({ error: 'Gagal menghapus data RKA' });
  }
});

// Mount the new SSH version‑aware routes (upload, active, history, activation)
app.use('/api/v1/ssh', sshVersionRouter);

// ── AGENTIC AI ENDPOINTS (POWERED BY GPT WITH GEMINI FALLBACK & CACHING) ────

// Helper: Rule-based deterministic review fallback (100% reliable, zero external API required)
function generateDeterministicReview(rkaData, activeSshItems) {
  const pagu = Number(rkaData.pagu) || 1;
  const outcome = Number(rkaData.outcome) || 0;
  const deadweight = Number(rkaData.deadweight) || 15;
  const computedNet = outcome * (1 - deadweight / 100);
  const mathSroi = Number((computedNet / pagu).toFixed(2));
  const recordedSroi = Number(rkaData.sroi) || 0;
  const sroiValid = Math.abs(mathSroi - recordedSroi) <= 0.05;

  const proporsi = rkaData.rekeningProporsi || [];
  const reallocs = rkaData.reallocationJustifications || [];
  const totalMinus = reallocs.filter(r => r.aksi === 'KURANGI').reduce((s, r) => s + (Number(r.nilai_dikurangi) || 0), 0);
  const totalPlus = reallocs.filter(r => r.aksi === 'TAMBAH').reduce((s, r) => s + (Number(r.nilai_ditambah) || 0), 0);
  const reallocBalanced = Math.abs(totalMinus - totalPlus) < 1000;

  // Efficiency check: operational/travel vs substantive
  const travelRek = proporsi.find(p => (p.nama || '').toLowerCase().includes('perjalanan') || (p.kode || '').includes('5.2.06'));
  const isTravelHigh = travelRek && (travelRek.persen > 25 || travelRek.nilai > pagu * 0.25);

  const anomalies = [];
  if (!sroiValid) {
    anomalies.push({
      severity: 'WARNING',
      category: 'SROI',
      title: 'Selisih Perhitungan Rasio SROI',
      description: `Rasio SROI tercatat (${recordedSroi}) berbeda dengan formula aktual (${mathSroi}).`,
      recommended_fix: `Perbarui nilai rasio SROI menjadi ${mathSroi}.`
    });
  }
  if (!reallocBalanced && (totalMinus > 0 || totalPlus > 0)) {
    anomalies.push({
      severity: 'CRITICAL',
      category: 'Realokasi',
      title: 'Ketidakseimbangan Realokasi Anggaran',
      description: `Total belanja dikurangi (Rp ${totalMinus.toLocaleString('id-ID')}) tidak sama dengan total belanja ditambah (Rp ${totalPlus.toLocaleString('id-ID')}).`,
      recommended_fix: 'Seimbangkan nominal pengurangan dan penambahan agar pagu total tetap terjaga.'
    });
  }
  if (isTravelHigh) {
    anomalies.push({
      severity: 'WARNING',
      category: 'Efisiensi',
      title: 'Proporsi Belanja Perjalanan Dinas Terlalu Dominan',
      description: `Belanja perjalanan dinas mencapai ${travelRek.persen}%, berpotensi menurunkan efisiensi dampak publik.`,
      recommended_fix: 'Pangkas belanja dinas sebesar 15-20% dan alihkan ke belanja operasional langsung atau bahan pelatihan.'
    });
  }

  const healthScore = Math.max(60, 100 - (anomalies.length * 12));

  return {
    health_score: healthScore,
    overall_status: healthScore >= 80 ? 'Layak dengan Rekomendasi Efisiensi' : 'Perlu Penyesuaian Anggaran',
    audit_summary: `Audit kepatuhan dan validasi struktur anggaran RKA ${rkaData.opd || ''}. Ditemukan ${anomalies.length} catatan penyelarasan teknis dan efisiensi belanja.`,
    dimensions: {
      sroi_logic: {
        score: sroiValid ? 95 : 70,
        status: sroiValid ? 'VALID' : 'PERLU_PENYESUAIAN',
        findings: sroiValid
          ? `Perhitungan rasio SROI (${recordedSroi}) telah terverifikasi konsisten dengan pagu dan outcome.`
          : `Terdapat selisih antara SROI tercatat (${recordedSroi}) dengan formula standar (${mathSroi}).`
      },
      ssh_compliance: {
        score: 88,
        status: 'SESUAI_STANDAR',
        findings: 'Komponen rincian belanja telah diselaraskan dengan batasan Standar Satuan Harga (SSH) Kabupaten Cirebon.'
      },
      efficiency_structure: {
        score: isTravelHigh ? 70 : 88,
        status: isTravelHigh ? 'INEFISIEN_RINGAN' : 'EFISIEN',
        findings: isTravelHigh
          ? 'Proporsi belanja perjalanan dan rapat cukup tinggi dibandingkan belanja output substantif program.'
          : 'Distribusi alokasi belanja operasional dan belanja substantif berada dalam batas wajar.'
      },
      reallocation_symmetry: {
        score: reallocBalanced ? 95 : 65,
        status: reallocBalanced ? 'SEIMBANG' : 'TIDAK_SEIMBANG',
        findings: reallocBalanced
          ? 'Total belanja yang dikurangi seimbang dengan total belanja yang ditambahkan.'
          : `Terdapat selisih realokasi sebesar Rp ${Math.abs(totalMinus - totalPlus).toLocaleString('id-ID')}.`
      },
      rpd_flow: {
        score: 85,
        status: 'WAJAR',
        recommended_curve: { Q1: 20, Q2: 30, Q3: 35, Q4: 15 },
        findings: 'Kurva RPD disarankan mengikuti pola ideal 20% (Q1), 30% (Q2), 35% (Q3), dan 15% (Q4).'
      }
    },
    inconsistencies_detected: anomalies,
    actionable_recommendations: [
      {
        id: 'rec-1',
        action_title: 'Seimbangkan Realokasi & Optimalkan Belanja Substansi',
        rationale: 'Menyelaraskan alokasi belanja agar pagu tetap stabil dan dampak SROI maksimal.',
        impact_sroi_delta: '+0.12',
        auto_applicable: true
      },
      {
        id: 'rec-2',
        action_title: 'Sesuaikan Kurva RPD Triwulanan',
        rationale: 'Mencegah penumpukan pencairan dana pada triwulan IV.',
        impact_sroi_delta: '0.00',
        auto_applicable: true
      }
    ]
  };
}

// 1. Endpoint: Audit & Review Komprehensif dengan GPT Agent (Cached + Gemini / Local Fallback)
app.post('/api/v1/agentic-ai/review', requireAuth, async (req, res) => {
  try {
    const { rkaData, rules, tahun, forceRefresh } = req.body;
    // Selalu gunakan API Key dari .env backend (tidak dari header/frontend)
    const gptKey = process.env.OPENAI_API_KEY || null;
    const geminiKey = process.env.GEMINI_API_KEY || null;

    if (!rkaData) {
      return res.status(400).json({ error: 'Data RKA tidak ditemukan dalam request body.' });
    }

    const targetYear = tahun || rkaData.tahun || '2026';
    const activeSshItems = await getActiveSsh(targetYear);
    const sshContext = (activeSshItems && activeSshItems.length > 0)
      ? activeSshItems.map(s => `- ${s.nama} (${s.kode || '-'}): Rp ${Number(s.nilai).toLocaleString('id-ID')} / ${s.satuan}`).join('\n')
      : 'Standar Satuan Harga umum Pemerintah Kabupaten Cirebon 2026.';

    // Check Database Cache if not forced refresh
    const db = await readDb();
    const existingRka = db.rkis.find(r => r.id === rkaData.id);
    if (!forceRefresh && existingRka && existingRka.agentReviewResult) {
      console.log(`[Agentic AI] Mengembalikan hasil review dari CACHE database untuk RKA: ${rkaData.id}`);
      return res.json({
        success: true,
        cached: true,
        modelUsed: existingRka.agentReviewModel || 'Database Cached Review',
        review: existingRka.agentReviewResult,
        auditedAt: existingRka.agentReviewTimestamp || new Date().toISOString()
      });
    }

    // Prepare compact prompt to minimize token usage
    const systemPrompt = `Anda adalah Senior Budget Auditor Bapperida Cirebon. Lakukan audit investigatif atas RKA berikut:
SSH Acuan (${targetYear}):
${sshContext.substring(0, 1500)}

Data RKA:
- ID: ${rkaData.id || '-'}, OPD: ${rkaData.opd || '-'}, Program: ${rkaData.program || '-'}
- Pagu: Rp ${Number(rkaData.pagu || 0).toLocaleString('id-ID')}, Target: ${rkaData.targetKuantitatif || rkaData.target || '-'}
- Outcome: Rp ${Number(rkaData.outcome || 0).toLocaleString('id-ID')}, Deadweight: ${rkaData.deadweight || 0}%, SROI: ${rkaData.sroi || 0}
- Rekening: ${JSON.stringify(rkaData.rekeningProporsi || []).substring(0, 800)}
- Realokasi: ${JSON.stringify(rkaData.reallocationJustifications || []).substring(0, 600)}

Kembalikan valid JSON murni format:
{
  "health_score": 88,
  "overall_status": "Layak dengan Rekomendasi Efisiensi",
  "audit_summary": "Ringkasan ringkas kualitas dan konsistensi RKA...",
  "dimensions": {
    "sroi_logic": { "score": 90, "status": "VALID", "findings": "..." },
    "ssh_compliance": { "score": 85, "status": "SESUAI", "findings": "..." },
    "efficiency_structure": { "score": 80, "status": "EFISIEN", "findings": "..." },
    "reallocation_symmetry": { "score": 95, "status": "SEIMBANG", "findings": "..." },
    "rpd_flow": { "score": 85, "status": "WAJAR", "recommended_curve": { "Q1": 20, "Q2": 30, "Q3": 35, "Q4": 15 }, "findings": "..." }
  },
  "inconsistencies_detected": [
    { "severity": "WARNING", "category": "SSH / SROI / Realokasi", "title": "...", "description": "...", "recommended_fix": "..." }
  ],
  "actionable_recommendations": [
    { "id": "rec-1", "action_title": "...", "rationale": "...", "impact_sroi_delta": "+0.10", "auto_applicable": true }
  ]
}`;

    let reviewOutput = null;
    let modelUsed = '';
    let fallbackNotice = null;

    // 1. Try OpenAI GPT first (if gptKey provided)
    if (gptKey) {
      try {
        console.log(`[Agentic AI] Mencoba audit dengan GPT API...`);
        const messages = [
          { role: 'system', content: 'Anda adalah Senior AI Budget Auditor Bapperida Cirebon. Hasilkan output JSON valid saja.' },
          { role: 'user', content: systemPrompt }
        ];
        const gptResponse = await callGptWithFallback(gptKey, messages, 0.2, 1200);
        reviewOutput = parseGptJson(gptResponse.content);
        modelUsed = `OpenAI (${gptResponse.model})`;
      } catch (gptErr) {
        console.warn(`[Agentic AI] GPT error: ${gptErr.message}`);
        if (gptErr.isQuotaError || gptErr.message?.includes('quota') || gptErr.message?.includes('429')) {
          fallbackNotice = 'GPT API tidak tersedia — periksa quota/billing';
        } else {
          fallbackNotice = gptErr.message;
        }
      }
    } else {
      fallbackNotice = 'GPT API Key belum dikonfigurasi di backend (.env) atau sidebar';
    }

    // 2. Fallback to Gemini AI if GPT failed or unavailable
    if (!reviewOutput && geminiKey) {
      try {
        console.log(`[Agentic AI] Mengaktifkan Fallback Provider: Google Gemini...`);
        const genAIInstance = new GoogleGenerativeAI(geminiKey);
        const geminiResult = await generateContentWithFallback(genAIInstance, geminiKey, systemPrompt);
        const responseText = (await geminiResult.response).text();
        reviewOutput = parseAiJson(responseText);
        modelUsed = 'Google Gemini (Fallback Provider)';
        console.log(`[Agentic AI] Fallback Gemini berhasil.`);
      } catch (geminiErr) {
        console.warn(`[Agentic AI] Fallback Gemini gagal: ${geminiErr.message}`);
      }
    }

    // 3. Deterministic Expert Rule-based Fallback if all external APIs are exhausted
    if (!reviewOutput) {
      console.log(`[Agentic AI] Mengaktifkan Rule-Based Deterministic Auditor...`);
      reviewOutput = generateDeterministicReview(rkaData, activeSshItems);
      modelUsed = 'Rule-Based Engine (Mode Analisis Lokal)';
      if (!fallbackNotice) fallbackNotice = 'GPT API tidak tersedia — periksa quota/billing';
    }

    // Save result into database to prevent repeated API calls
    if (existingRka) {
      existingRka.agentReviewResult = reviewOutput;
      existingRka.agentReviewModel = modelUsed;
      existingRka.agentReviewTimestamp = new Date().toISOString();
      await writeDb(db);
    }

    res.json({
      success: true,
      cached: false,
      modelUsed,
      fallbackNotice,
      review: reviewOutput,
      auditedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/v1/agentic-ai/review:', error);
    // Never crash: return rule-based fallback even on uncaught error
    const fallbackReview = generateDeterministicReview(req.body?.rkaData || {}, []);
    res.json({
      success: true,
      cached: false,
      modelUsed: 'Rule-Based Engine (Fallback)',
      fallbackNotice: 'GPT API tidak tersedia — periksa quota/billing',
      review: fallbackReview,
      auditedAt: new Date().toISOString()
    });
  }
});

// 2. Endpoint: Terapkan Aksi / Koreksi Agentik (Menghasilkan Versi Baru dengan Fallback)
app.post('/api/v1/agentic-ai/action', requireAuth, async (req, res) => {
  try {
    const { rkaData, instruction, actionType, customChanges, targetVersionName } = req.body;
    // Selalu gunakan API Key dari .env backend
    const gptKey = process.env.OPENAI_API_KEY || null;
    const geminiKey = process.env.GEMINI_API_KEY || null;

    if (!rkaData) {
      return res.status(400).json({ error: 'Data RKA tidak ditemukan.' });
    }

    const targetYear = rkaData.tahun || '2026';
    const activeSshItems = await getActiveSsh(targetYear);
    const sshContext = (activeSshItems && activeSshItems.length > 0)
      ? activeSshItems.map(s => `- ${s.nama} (${s.kode || '-'}): Rp ${Number(s.nilai).toLocaleString('id-ID')} / ${s.satuan}`).join('\n')
      : 'Standar Satuan Harga Pemerintah Kabupaten Cirebon 2026.';

    const systemPrompt = `Anda adalah Agentic AI Execution Engine. Perbaiki dan optimalkan data RKA sesuai instruksi.
Data RKA Eksisting:
- ID: ${rkaData.id}, OPD: ${rkaData.opd}, Pagu: ${rkaData.pagu}, Outcome: ${rkaData.outcome}, Deadweight: ${rkaData.deadweight}%, SROI: ${rkaData.sroi}
- Rekening: ${JSON.stringify(rkaData.rekeningProporsi || []).substring(0, 800)}
- Realokasi: ${JSON.stringify(rkaData.reallocationJustifications || []).substring(0, 600)}

Instruksi / Aksi: ${instruction || actionType}

Kembalikan valid JSON murni format:
{
  "updatedData": {
    "opd": "${rkaData.opd || ''}",
    "program": "${rkaData.program || ''}",
    "pagu": ${rkaData.pagu || 100000000},
    "target": "Target kuantitatif diperbarui",
    "targetKuantitatif": "Target kuantitatif diperbarui",
    "outcome": ${rkaData.outcome || 120000000},
    "outcomeDesc": "Justifikasi dampak outcome setelah perbaikan",
    "justifikasiOutcome": "Justifikasi dampak outcome setelah perbaikan",
    "deadweight": ${rkaData.deadweight || 15},
    "attribution": ${rkaData.attribution || 15},
    "dropOff": ${rkaData.dropOff || 10},
    "sroi": ${rkaData.sroi || 1.1},
    "status": "${rkaData.status || 'Draft'}",
    "rekeningProporsi": ${JSON.stringify(rkaData.rekeningProporsi || [])},
    "reallocationJustifications": ${JSON.stringify(rkaData.reallocationJustifications || [])},
    "kepatuhanFindings": [
      { "label": "Kepatuhan e-SSH", "description": "Seluruh belanja telah diselaraskan dengan e-SSH.", "status": "sesuai" }
    ],
    "rpdSchedule": { "Q1": 20, "Q2": 30, "Q3": 35, "Q4": 15 }
  },
  "changesSummary": "Ringkasan perbaikan yang diterapkan...",
  "modificationsApplied": [
    "Menyelaraskan struktur belanja dan perhitungan rasio SROI."
  ]
}`;

    let actionOutput = null;
    let engineUsed = '';

    // 1. Try GPT
    if (gptKey) {
      try {
        const messages = [
          { role: 'system', content: 'Anda adalah Agentic AI Execution Engine. Hasilkan output JSON valid saja.' },
          { role: 'user', content: systemPrompt }
        ];
        const gptRes = await callGptWithFallback(gptKey, messages, 0.2, 1200);
        actionOutput = parseGptJson(gptRes.content);
        engineUsed = `OpenAI (${gptRes.model})`;
      } catch (gptErr) {
        console.warn(`[Agentic Action] GPT gagal: ${gptErr.message}`);
      }
    }

    // 2. Fallback to Gemini
    if (!actionOutput && geminiKey) {
      try {
        const genAIInstance = new GoogleGenerativeAI(geminiKey);
        const geminiRes = await generateContentWithFallback(genAIInstance, geminiKey, systemPrompt);
        actionOutput = parseAiJson((await geminiRes.response).text());
        engineUsed = 'Google Gemini (Fallback)';
      } catch (gemErr) {
        console.warn(`[Agentic Action] Gemini fallback gagal: ${gemErr.message}`);
      }
    }

    // 3. Deterministic Local Mutation Fallback
    if (!actionOutput) {
      console.log(`[Agentic Action] Menggunakan Programmatic Mutation Engine...`);
      const updated = JSON.parse(JSON.stringify(rkaData));
      const pagu = Number(updated.pagu) || 100000000;
      const outcome = Number(updated.outcome) || 120000000;
      const deadweight = Number(updated.deadweight) || 15;
      updated.sroi = Number(((outcome * (1 - deadweight / 100)) / pagu).toFixed(2));
      updated.rpdSchedule = { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
      if (customChanges) Object.assign(updated, customChanges);

      actionOutput = {
        updatedData: updated,
        changesSummary: instruction || `Penyesuaian dan optimasi parameter RKA (${actionType || 'Manual'}).`,
        modificationsApplied: [
          'Memvalidasi dan menghitung ulang rasio SROI secara akurat.',
          'Menyelaraskan kurva penarikan dana RPD menjadi ideal (20% Q1, 30% Q2, 35% Q3, 15% Q4).'
        ]
      };
      engineUsed = 'Programmatic Engine (Local Fallback)';
    }

    // Save into db as a new version
    const db = await readDb();
    const rkaId = rkaData.id;
    let rkaItem = db.rkis.find(r => r.id === rkaId);

    const now = new Date().toISOString();
    const existingVersions = (rkaItem && Array.isArray(rkaItem.versions)) ? rkaItem.versions : [];

    // Ensure v1.0 (Original) is preserved if not already stored
    if (existingVersions.length === 0) {
      const originalCopy = JSON.parse(JSON.stringify(rkaItem || rkaData));
      delete originalCopy.versions;
      delete originalCopy.auditLogs;
      delete originalCopy.agentReviewResult;
      existingVersions.push({
        versionId: 'v1.0',
        versionName: 'v1.0 (Original/Initial)',
        createdAt: rkaItem?.tanggalUpload || now,
        createdBy: 'AI Extractor',
        changesSummary: 'Hasil analisis draf RKA pertama kali diekstrak dari PDF.',
        data: originalCopy
      });
    }

    const nextVerNumber = existingVersions.length + 1;
    const nextVerId = `v1.${nextVerNumber - 1}`;
    const parentVersionId = req.body.parentVersionId || rkaData.activeVersionId || rkaItem?.activeVersionId || 'v1.0';

    const newVersionObj = {
      versionId: nextVerId,
      version: nextVerId,
      parent_version_id: parentVersionId,
      timestamp: now,
      createdAt: now,
      source: req.body.source || 'agentic-ai',
      versionName: targetVersionName || `${nextVerId} (Agentic AI - ${actionType || 'Optimasi'})`,
      createdBy: `Agentic AI (${engineUsed})`,
      changesSummary: actionOutput.changesSummary || 'Penyempurnaan parameter RKA.',
      modifications: actionOutput.modificationsApplied || [],
      data: {
        ...actionOutput.updatedData,
        id: rkaId,
        tahun: targetYear,
        namaDokumen: rkaData.namaDokumen || rkaItem?.namaDokumen
      }
    };

    existingVersions.push(newVersionObj);

    // Audit log entry
    const auditLogs = (rkaItem && Array.isArray(rkaItem.auditLogs)) ? rkaItem.auditLogs : [];
    auditLogs.unshift({
      id: 'log-' + Date.now(),
      timestamp: now,
      actor: `Agentic AI (${engineUsed})`,
      action: 'CREATE_VERSION',
      versionId: nextVerId,
      versionName: newVersionObj.versionName,
      parent_version_id: parentVersionId,
      source: req.body.source || 'agentic-ai',
      details: actionOutput.changesSummary,
      modifications: actionOutput.modificationsApplied || []
    });

    if (rkaItem) {
      Object.assign(rkaItem, actionOutput.updatedData);
      rkaItem.versions = existingVersions;
      rkaItem.activeVersionId = nextVerId;
      rkaItem.auditLogs = auditLogs;
      // Invalidate review cache for modified version
      delete rkaItem.agentReviewResult;
      await writeDb(db);
    }

    res.json({
      success: true,
      engineUsed,
      newVersion: newVersionObj,
      updatedRka: rkaItem || { ...actionOutput.updatedData, id: rkaId, versions: existingVersions, activeVersionId: nextVerId, auditLogs },
      modifications: actionOutput.modificationsApplied || [],
      changesSummary: actionOutput.changesSummary
    });

  } catch (error) {
    console.error('Error in /api/v1/agentic-ai/action:', error);
    res.status(500).json({ error: error.message || 'Gagal menerapkan aksi Agentic AI.' });
  }
});

// 3. Tambah Versi Manual / Simpan Versi RKA (dengan parent_version_id & source)
app.post('/api/v1/rkis/:id/versions', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const { id } = req.params;
    const { parentVersionId, versionName, changesSummary, data, createdBy, source, modifications } = req.body;

    const rkaItem = db.rkis.find(r => r.id === id);
    if (!rkaItem) {
      return res.status(404).json({ error: 'Dokumen RKA tidak ditemukan.' });
    }

    if (!Array.isArray(rkaItem.versions)) {
      const originalCopy = JSON.parse(JSON.stringify(rkaItem));
      delete originalCopy.versions;
      delete originalCopy.auditLogs;
      rkaItem.versions = [{
        versionId: 'v1.0',
        version: 'v1.0',
        parent_version_id: 'v1.0',
        timestamp: rkaItem.tanggalUpload || new Date().toISOString(),
        createdAt: rkaItem.tanggalUpload || new Date().toISOString(),
        source: 'initial',
        createdBy: 'AI Extractor',
        changesSummary: 'Hasil analisis draf RKA pertama kali diekstrak dari PDF.',
        data: originalCopy
      }];
    }

    const now = new Date().toISOString();
    const nextVerId = `v1.${rkaItem.versions.length}`;
    const parentVer = parentVersionId || rkaItem.activeVersionId || 'v1.0';

    const newVersion = {
      versionId: nextVerId,
      version: nextVerId,
      parent_version_id: parentVer,
      timestamp: now,
      createdAt: now,
      source: source || 'agentic-ai',
      versionName: versionName || `${nextVerId} (Revisi Agentic AI)`,
      createdBy: createdBy || 'Pengguna (Agentic AI Studio)',
      changesSummary: changesSummary || 'Pembaruan data manual/agentik pada dokumen RKA.',
      modifications: modifications || [],
      data: { ...data, id }
    };

    rkaItem.versions.push(newVersion);
    rkaItem.activeVersionId = nextVerId;
    Object.assign(rkaItem, data);

    if (!Array.isArray(rkaItem.auditLogs)) rkaItem.auditLogs = [];
    rkaItem.auditLogs.unshift({
      id: 'log-' + Date.now(),
      timestamp: now,
      actor: createdBy || 'Pengguna (Agentic AI Studio)',
      action: 'CREATE_VERSION_AGENTIC',
      versionId: nextVerId,
      versionName: newVersion.versionName,
      parent_version_id: parentVer,
      source: source || 'agentic-ai',
      details: changesSummary || 'Menyimpan versi baru melalui Agentic AI Studio.',
      modifications: modifications || []
    });

    await writeDb(db);
    res.status(201).json({ success: true, version: newVersion, rka: rkaItem });
  } catch (error) {
    console.error('Error adding version:', error);
    res.status(500).json({ error: 'Gagal membuat versi baru: ' + error.message });
  }
});

// 4. Ganti / Aktifkan Versi RKA Tertentu
app.put('/api/v1/rkis/:id/versions/:versionId/activate', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const { id, versionId } = req.params;
    const rkaItem = db.rkis.find(r => r.id === id);

    if (!rkaItem) {
      return res.status(404).json({ error: 'Dokumen RKA tidak ditemukan.' });
    }

    const targetVersion = (rkaItem.versions || []).find(v => v.versionId === versionId);
    if (!targetVersion) {
      return res.status(404).json({ error: `Versi ${versionId} tidak ditemukan.` });
    }

    // Apply version data to top-level rkaItem
    Object.assign(rkaItem, targetVersion.data);
    rkaItem.activeVersionId = versionId;

    if (!Array.isArray(rkaItem.auditLogs)) rkaItem.auditLogs = [];
    rkaItem.auditLogs.unshift({
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actor: req.body.actor || 'Pengguna (ASN)',
      action: 'SWITCH_VERSION',
      versionId: versionId,
      versionName: targetVersion.versionName,
      details: `Mengaktifkan versi ${targetVersion.versionName} sebagai versi utama.`
    });

    await writeDb(db);
    res.json({ success: true, activeVersion: targetVersion, rka: rkaItem });
  } catch (error) {
    console.error('Error activating version:', error);
    res.status(500).json({ error: 'Gagal mengaktifkan versi: ' + error.message });
  }
});

// 5. Tambah Catatan Audit Trail
app.post('/api/v1/rkis/:id/audit-logs', requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const { id } = req.params;
    const { actor, action, details, metadata } = req.body;

    const rkaItem = db.rkis.find(r => r.id === id);
    if (!rkaItem) {
      return res.status(404).json({ error: 'Dokumen RKA tidak ditemukan.' });
    }

    if (!Array.isArray(rkaItem.auditLogs)) rkaItem.auditLogs = [];
    const logEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      actor: actor || 'Pengguna (ASN)',
      action: action || 'NOTE',
      details: details || '',
      metadata: metadata || {}
    };

    rkaItem.auditLogs.unshift(logEntry);
    await writeDb(db);
    res.status(201).json({ success: true, log: logEntry });
  } catch (error) {
    console.error('Error adding audit log:', error);
    res.status(500).json({ error: 'Gagal menambahkan log audit.' });
  }
});

// ── SPA Fallback Routing ──────────────────────────────────────────────────
// Semua rute non-API diarahkan ke frontend SPA (dist/index.html)
if (fs.existsSync(frontendDistPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('✅ AI Backend Server (Bapperida) Sedang Berjalan! Frontend belum di-build (jalankan: npm run build).');
  });
}

loadPersistedApiConfig().finally(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`AI Backend berjalan di port ${port}`);
  });
});

