import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Crown,
  FileText,
  Globe,
  GraduationCap,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { CREDIT_PACKAGES } from '../utils/credits.ts';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

interface EducationArticle {
  id: string;
  category: string;
  readTime: string;
  date: string;
  title: string;
  excerpt: string;
  image: string;
  paragraphs: string[];
}

const ARTICLES: EducationArticle[] = [
  {
    id: 'active-recall',
    category: 'Strategi Belajar',
    readTime: '4 menit baca',
    date: '12 November 2026',
    title: 'Teknik Active Recall dan Latihan Soal Bertahap untuk Meningkatkan Retensi',
    excerpt:
      'Mengapa membaca ulang catatan berkali-kali kalah efektif dibanding menguji pemahaman sendiri melalui tanya jawab dan kuis terstruktur.',
    image: '/src/assets/images/article_active_recall_1794819036471.jpg',
    paragraphs: [
      'Banyak pelajar dan mahasiswa menghabiskan berjam-jam membaca ulang catatan atau menyorot buku teks dengan stabilo, namun tetap kesulitan saat menghadapi soal ujian. Fenomena ini terjadi karena otak hanya mengenali kalimat yang akrab tanpa benar-benar melatih proses pemanggilan informasi.',
      'Active recall membalik pendekatan tersebut: setelah membaca satu sub-bab, tutup catatan lalu coba jelaskan ulang konsepnya dengan kata-kata sendiri atau kerjakan 5 soal latihan langsung. Proses mengingat aktif memperkuat jalur memori jangka panjang jauh lebih cepat.',
      'Di EduSmart AI, kamu dapat menggabungkan Rangkuman Materi untuk memetakan konsep inti, lalu langsung menguji diri melalui fitur Kuis AI bertingkat dari Mudah hingga Sulit beserta pembahasan setiap butir soal.',
    ],
  },
  {
    id: 'smart-summary',
    category: 'Produktivitas Kuliah',
    readTime: '5 menit baca',
    date: '8 November 2026',
    title: 'Cara Merangkum Diktat Dosen dan Bab Buku Tebal Tanpa Kehilangan Fakta Inti',
    excerpt:
      'Panduan menyaring paragraf panjang menjadi struktur Judul, Inti Pembahasan, Poin Penting, dan Kesimpulan yang akurat.',
    image: '/src/assets/images/article_smart_summary_1794819036384.jpg',
    paragraphs: [
      'Materi kuliah atau modul sekolah sering kali terdiri atas ribuan kata yang bercampur antara definisi utama, contoh kasus, dan penjelasan tambahan. Merangkum secara asal justru berisiko menghilangkan angka, syarat, atau konsep kunci yang sering keluar di ujian.',
      'Teknik terbaik adalah membagi ringkasan menjadi empat lapisan jelas: judul topik sebagai jangkar konteks, satu paragraf inti pembahasan, daftar poin penting berisi hubungan sebab-akibat, serta kesimpulan ringkas untuk review cepat sebelum kelas dimulai.',
      'Alat Rangkuman Materi di EduSmart AI dirancang khusus untuk bekerja murni berdasarkan teks yang kamu tempel—tanpa menambah fakta di luar sumber—sehingga catatan tetap setia pada materi dosen atau guru.',
    ],
  },
  {
    id: 'exam-strategy',
    category: 'Persiapan Ujian',
    readTime: '4 menit baca',
    date: '3 November 2026',
    title: 'Menaklukkan Soal Penalaran HOTS di UTBK-SNBT dan Ujian Akhir Semester',
    excerpt:
      'Langkah sistematis membedah soal analisis kasus dengan bantuan tutor bertingkat sesuai jenjang SMP, SMA/SMK, maupun Mahasiswa.',
    image: '/src/assets/images/article_exam_strategy_1794819037713.jpg',
    paragraphs: [
      'Soal Higher Order Thinking Skills (HOTS) tidak lagi sekadar menanyakan hafalan definisi, melainkan menuntut kemampuan menghubungkan dua atau tiga konsep sekaligus dalam konteks studi kasus nyata.',
      'Mulailah dengan mengidentifikasi variabel yang diketahui, menentukan prinsip dasar yang berlaku, lalu memeriksa setiap opsi jawaban dengan eliminasi logis. Jangan terpaku pada satu rumus sebelum memahami alasan fisis atau ekonomis di balik soal.',
      'Gunakan AI Tutor EduSmart dengan memilih mata pelajaran dan jenjang yang tepat agar penjelasan langkah demi langkah selalu relevan dengan tingkat ujian yang sedang kamu hadapi.',
    ],
  },
];

function InstagramIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { user } = useAuth();
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [deskImgFailed, setDeskImgFailed] = useState(false);
  const [activeArticle, setActiveArticle] = useState<EducationArticle | null>(
    null,
  );

  return (
    <div className="bg-white text-ink">
      {/* Seksi 1: Hero (Putih) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-sm font-semibold text-primary">
              Platform Edukasi Cerdas Indonesia · SMP · SMA/SMK · Mahasiswa
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-navy leading-tight">
              Asisten Belajar Terstruktur untuk Memahami Materi Lebih Cepat dan Tepat
            </h1>
            <p className="text-base sm:text-lg text-ink-muted leading-relaxed max-w-xl">
              EduSmart AI menghadirkan AI Tutor interaktif, Rangkuman Materi berbasis teks dosen atau buku, serta Kuis AI adaptif dengan evaluasi lengkap dalam Bahasa Indonesia.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {user ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap"
                >
                  <span>Buka Dashboard Belajar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate('/daftar')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap"
                  >
                    <span>Daftar &amp; Dapat 100 Kredit Gratis</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/masuk')}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-ink font-semibold text-sm sm:text-base transition-colors whitespace-nowrap"
                  >
                    Masuk ke Akun
                  </button>
                </>
              )}
            </div>
            <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>100 Kredit awal gratis tiap akun</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Streaming cepat &amp; akurat</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Data riwayat privat terpisah</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-xl overflow-hidden border border-border-soft bg-surface-alt shadow-sm">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_edusmart_study_1794817537461.jpg"
                  alt="Pelajar Indonesia belajar di ruang baca modern dengan buku dan catatan digital"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-64 sm:h-80 lg:h-full object-cover"
                />
              ) : (
                <div className="w-full h-64 sm:h-80 lg:h-full min-h-[300px] bg-gradient-to-br from-surface-alt to-primary-light flex flex-col items-center justify-center p-8 text-center">
                  <GraduationCap className="w-12 h-12 text-primary mb-3" />
                  <p className="font-semibold text-navy">Ruang Belajar EduSmart AI</p>
                  <p className="text-sm text-ink-muted mt-1">
                    AI Tutor, Rangkuman Materi, dan Evaluasi Kuis Terintegrasi
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Strip Metrik Ringkas */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border-soft pt-8">
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-navy tabular-nums">3 Jenjang</p>
            <p className="text-xs sm:text-sm text-ink-muted">SMP, SMA/SMK, dan Mahasiswa</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-navy tabular-nums">10 Mapel</p>
            <p className="text-xs sm:text-sm text-ink-muted">Matematika hingga Informatika</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">100 Kredit</p>
            <p className="text-xs sm:text-sm text-ink-muted">Bonus awal saat mendaftar akun</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-navy tabular-nums">12.000 Kar</p>
            <p className="text-xs sm:text-sm text-ink-muted">Kapasitas teks per rangkuman materi</p>
          </div>
        </div>
      </section>

      {/* Seksi 2: Fitur Utama (Biru sangat muda #EFF6FF) */}
      <section id="fitur" className="bg-surface-alt border-y border-border-soft py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold text-primary">Ekosistem Belajar</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy">
              Tiga Fitur Utama yang Saling Melengkapi
            </h2>
            <p className="text-ink-muted text-sm sm:text-base">
              Mulai dari memahami konsep dasar, meringkas bahan kuliah, hingga mengevaluasi kesiapan ujian dalam satu alur terpadu.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 grid grid-cols-1 gap-6">
              <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-navy">01. AI Tutor Kontekstual</h3>
                    <p className="text-xs text-ink-muted">Streaming cepat · 10 Mata Pelajaran · Pencarian Sumber Faktual</p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                  Diskusi materi secara interaktif dengan kedalaman bahasa yang otomatis menyesuaikan jenjang SMP, SMA/SMK, atau Mahasiswa beserta rujukan web asli untuk pertanyaan faktual.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-3">
                  <span className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-navy">02. Rangkuman Materi</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Tempel materi kuliah atau catatan PDF hingga 12.000 karakter. Output terstruktur dalam 4 bagian rapi tanpa menambah fakta di luar sumber.
                  </p>
                </div>

                <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm space-y-3">
                  <span className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-navy">03. Kuis AI &amp; Evaluasi</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Buat 5 atau 10 soal tingkat Mudah, Sedang, atau Sulit. Kunci jawaban tersimpan aman di server dan langsung dinilai disertai pembahasan.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex">
              <div className="w-full bg-white border border-border-soft rounded-xl overflow-hidden shadow-sm flex flex-col">
                {!deskImgFailed ? (
                  <img
                    src="/src/assets/images/feature_academic_desk_1794817537417.jpg"
                    alt="Buku referensi, catatan matematika dan fisika di meja belajar rapi"
                    referrerPolicy="no-referrer"
                    onError={() => setDeskImgFailed(true)}
                    className="w-full h-56 lg:h-72 object-cover"
                  />
                ) : (
                  <div className="w-full h-56 lg:h-72 bg-primary-light/50 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-primary" />
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-navy">
                      Kredit Aman Tanpa Risiko Error
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      Saldo kredit hanya berkurang ketika AI berhasil menuntaskan jawaban, rangkuman, atau pembuatan soal. Jika terjadi kendala jaringan atau error, kredit Anda tidak berkurang sama sekali.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/dashboard' : '/daftar')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors w-fit"
                  >
                    <span>{user ? 'Masuk ke Dashboard Saya' : 'Mulai dengan 100 Kredit Gratis'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seksi 3: 3 Artikel Edukasi (Putih) */}
      <section id="artikel" className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold text-primary">Wawasan Akademik</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy">
            Artikel &amp; Panduan Belajar Efektif
          </h2>
          <p className="text-sm sm:text-base text-ink-muted">
            Baca strategi belajar berbasis riset untuk memaksimalkan persiapan ujian sekolah maupun perkuliahan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ARTICLES.map((article) => (
            <article
              key={article.id}
              className="bg-white border border-border-soft rounded-xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-surface-alt overflow-hidden border-b border-border-soft">
                  <img
                    src={article.image}
                    alt={article.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2.5">
                  <p className="text-xs text-ink-muted">
                    <span className="font-semibold text-primary">{article.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{article.readTime}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{article.date}</span>
                  </p>
                  <h3 className="text-base sm:text-lg font-bold text-navy leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveArticle(article)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                >
                  <span>Baca Artikel</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Seksi 4: Paket Kredit & Langganan (Biru sangat muda #EFF6FF) */}
      <section id="paket" className="bg-surface-alt border-y border-border-soft py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2.5">
              <p className="text-sm font-semibold text-primary">Paket Kredit &amp; Langganan</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">
                Fleksibel Mulai dari Akun Gratis hingga Unlimited
              </h2>
              <p className="text-sm sm:text-base text-ink-muted">
                Setiap akun baru memperoleh 100 kredit (~10x AI Tutor / Rangkuman atau maksimal 3x Kuis Mudah 5 soal). Tambah kredit atau aktifkan Unlimited kapan saja via QRIS &amp; E-Wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(user ? '/paket' : '/daftar')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 w-fit"
            >
              <span>{user ? 'Kelola Kredit & Paket' : 'Coba Gratis 100 Kredit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-border-soft rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                  <Coins className="w-4 h-4" />
                  <span>Akun Baru</span>
                </div>
                <h3 className="text-lg font-bold text-navy">Gratis 100 Kredit</h3>
                <p className="text-2xl font-bold text-navy tabular-nums">Rp 0</p>
                <ul className="space-y-2 text-sm text-ink-muted pt-2 border-t border-border-soft">
                  <li>100 kredit otomatis saat mendaftar</li>
                  <li>~10x AI Tutor atau Rangkuman Materi</li>
                  <li>Hingga 3x Kuis Mudah (5 soal)</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(user ? '/dashboard' : '/daftar')}
                className="w-full py-2.5 px-4 rounded-lg border border-border-soft bg-white hover:bg-surface-alt text-sm font-semibold text-navy transition-colors"
              >
                {user ? 'Sudah Aktif' : 'Daftar Gratis'}
              </button>
            </div>

            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-5 border ${
                  pkg.id === 'unlimited_yearly' ? 'border-primary' : 'border-border-soft'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                    {pkg.id === 'unlimited_yearly' ? (
                      <Crown className="w-4 h-4" />
                    ) : (
                      <Coins className="w-4 h-4" />
                    )}
                    <span>{pkg.badge}</span>
                  </div>
                  <h3 className="text-lg font-bold text-navy">{pkg.title}</h3>
                  <p className="text-2xl font-bold text-navy tabular-nums">
                    {pkg.priceLabel}
                  </p>
                  <ul className="space-y-2 text-sm text-ink-muted pt-2 border-t border-border-soft">
                    {pkg.benefits.slice(0, 3).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(user ? '/paket' : '/daftar')}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    pkg.id === 'unlimited_yearly'
                      ? 'bg-primary hover:bg-primary-dark text-white'
                      : 'bg-navy hover:bg-primary text-white'
                  }`}
                >
                  Pilih via QRIS / E-Wallet
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Profesional */}
      <footer className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </span>
                <span className="text-lg font-bold tracking-tight">EduSmart AI</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                Platform pembelajaran cerdas berbasis kecerdasan buatan untuk siswa SMP, SMA/SMK, dan mahasiswa di seluruh Indonesia. Membantu memahami materi lebih terarah dengan teknologi AI yang cepat dan aman.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://instagram.com/edusmart.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram EduSmart AI"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-primary text-xs font-medium text-white transition-colors"
                >
                  <InstagramIcon />
                  <span>@edusmart.id</span>
                </a>
                <a
                  href="https://facebook.com/edusmartindonesia"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook EduSmart AI Indonesia"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-primary text-xs font-medium text-white transition-colors"
                >
                  <FacebookIcon />
                  <span>EduSmart AI Indonesia</span>
                </a>
              </div>
            </div>

            <div className="md:col-span-3 space-y-3">
              <h3 className="text-sm font-semibold text-white">Navigasi Platform</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/tutor' : '/daftar')}
                    className="hover:text-white transition-colors"
                  >
                    AI Tutor Kontekstual
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/rangkuman' : '/daftar')}
                    className="hover:text-white transition-colors"
                  >
                    Rangkuman Materi
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/kuis' : '/daftar')}
                    className="hover:text-white transition-colors"
                  >
                    Kuis AI &amp; Evaluasi
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate(user ? '/paket' : '/daftar')}
                    className="hover:text-white transition-colors"
                  >
                    Paket Kredit &amp; Unlimited
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Kontak Resmi</h3>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-primary-light shrink-0" />
                  <a
                    href="mailto:halo@edusmart.id"
                    className="hover:text-white transition-colors"
                  >
                    halo@edusmart.id
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-primary-light shrink-0" />
                  <a
                    href="https://edusmart.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    https://edusmart.id
                  </a>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
                  <span>Jl. Kemang Raya No. 42, Jakarta Selatan, Indonesia</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 EduSmart AI Indonesia. Seluruh hak cipta dilindungi.</p>
            <p>Didesain untuk Pelajar SMP, SMA/SMK, dan Mahasiswa Indonesia</p>
          </div>
        </div>
      </footer>

      {/* Modal Baca Artikel */}
      {activeArticle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-navy/50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white border border-border-soft rounded-xl shadow-xl">
            <div className="aspect-[16/9] bg-surface-alt overflow-hidden relative">
              <img
                src={activeArticle.image}
                alt={activeArticle.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label="Tutup artikel"
                onClick={() => setActiveArticle(null)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-white/95 text-navy hover:bg-white shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-4">
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-primary">
                  {activeArticle.category}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{activeArticle.readTime}</span>
                <span aria-hidden="true"> · </span>
                <span>{activeArticle.date}</span>
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-navy leading-snug">
                {activeArticle.title}
              </h2>
              <div className="space-y-3 text-sm sm:text-base text-ink leading-relaxed">
                {activeArticle.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              <div className="pt-4 border-t border-border-soft flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveArticle(null);
                    onNavigate(user ? '/tutor' : '/daftar');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold"
                >
                  <span>Praktikkan di EduSmart AI</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  className="px-4 py-2 rounded-lg border border-border-soft text-sm font-semibold text-ink hover:bg-surface-alt"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
