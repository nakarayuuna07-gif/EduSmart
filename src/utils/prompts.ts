import type { EducationLevel, QuizDifficulty, Subject } from '../types/index.ts';

export function buildTutorSystemInstruction(
  level: EducationLevel,
  subject: Subject,
): string {
  return [
    `Kamu tutor yang sabar untuk level ${level} pada mata pelajaran ${subject}. Jawab dalam bahasa Indonesia, jelas dan bertahap. Kalau pertanyaan tentang fakta terkini atau kamu tidak yakin, katakan terus terang dan sarankan verifikasi, jangan mengarang.`,
    'Susun jawaban dengan rapi dan ringkas (Penjelasan Singkat, Langkah/Poin Utama, dan Contoh Konkret) agar mudah dipelajari siswa tanpa kalimat pengantar basa-basi.',
  ].join('\n');
}

const FACTUAL_KEYWORDS = [
  'siapa',
  'kapan',
  'tahun berapa',
  'tanggal',
  'dimana',
  'di mana',
  'sejarah',
  'peristiwa',
  'undang-undang',
  'pasal',
  'uud',
  'ibukota',
  'ibu kota',
  'penemu',
  'ilmuwan',
  'teori',
  'hukum',
  'berita',
  'terbaru',
  'terkini',
  'data',
  'statistik',
  'populasi',
  'negara',
  'sumber',
  'referensi',
  'penelitian',
  'fakta',
  'geografi',
  'ekonomi indonesia',
  'inflasi',
  'apbn',
  'kurikulum',
  'snbt',
  'utbk',
];

const PURE_CALC_OR_CONVERSATIONAL = [
  /^\s*(halo|hai|hi|pagi|siang|sore|malam|terima kasih|makasih)\b/i,
  /^\s*hitung(lah)?\s+[\d\s+\-*/^()=.,]+\s*\??$/i,
  /^\s*berapa\s+[\d\s+\-*/^().,]+\s*\??$/i,
];

export function shouldUseSearchGrounding(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (normalized.length < 12) return false;
  if (PURE_CALC_OR_CONVERSATIONAL.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return FACTUAL_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function buildSummarySystemInstruction(level: EducationLevel): string {
  return [
    `Kamu adalah asisten perangkum materi akademik untuk tingkat ${level}.`,
    'Rangkum HANYA berdasarkan materi yang diberikan oleh pengguna.',
    'DILARANG KERAS menambah fakta, angka, rumus, tanggal, nama tokoh, atau istilah baru yang tidak ada di dalam teks materi.',
    'Jika materi tidak cukup jelas atau terlalu abstrak untuk dirangkum, nyatakan hal tersebut secara jujur pada bagian intiPembahasan dan kesimpulan.',
    `Sesuaikan gaya bahasa rangkuman agar mudah dipahami oleh pelajar tingkat ${level} tanpa mengubah makna asli materi.`,
    'Keluarkan HANYA JSON valid dengan properti: {"judul": string, "intiPembahasan": string, "poinPenting": string[], "kesimpulan": string}.',
    'Seluruh output wajib berbahasa Indonesia yang baku, ringkas, dan terstruktur.',
  ].join('\n');
}

export function buildQuizPrompt(params: {
  topic: string;
  level: EducationLevel;
  difficulty: QuizDifficulty;
  count: number;
  partIndex?: number;
  totalParts?: number;
}): string {
  const { topic, level, difficulty, count, partIndex, totalParts } = params;
  const difficultyGuide: Record<QuizDifficulty, string> = {
    Mudah: 'Menguji pemahaman dasar, definisi, dan pengenalan konsep inti.',
    Sedang: 'Menguji penerapan konsep, analisis hubungan sebab-akibat, atau perhitungan standar.',
    Sulit: 'Menguji analisis mendalam, penalaran tingkat tinggi (HOTS), sintesis, atau kasus kompleks.',
  };

  const partNote =
    totalParts && totalParts > 1 && partIndex
      ? `Ini adalah bagian ${partIndex} dari ${totalParts}. Fokus pada sub-aspek yang berbeda agar soal tidak duplikat (${
          partIndex === 1
            ? 'fokus pada konsep fundamental dan prinsip utama'
            : 'fokus pada penerapan, analisis kasus, dan variasi sudut pandang'
        }).`
      : '';

  return [
    `Buatlah tepat ${count} soal pilihan ganda berbahasa Indonesia.`,
    `Tingkat pendidikan: ${level}.`,
    `Tingkat kesulitan: ${difficulty} (${difficultyGuide[difficulty]}).`,
    partNote,
    'Aturan wajib setiap soal:',
    '- Memiliki 4 opsi jawaban yang jelas, masuk akal, dan tidak ambigu.',
    '- indexJawabanBenar adalah bilangan bulat 0, 1, 2, atau 3 yang menunjuk ke opsi yang benar.',
    '- pembahasan menjelaskan secara singkat mengapa jawaban tersebut benar.',
    '- Keluarkan HANYA array JSON valid dengan item {"pertanyaan": string, "opsi": [string, string, string, string], "indexJawabanBenar": 0|1|2|3, "pembahasan": string} tanpa teks lain.',
    `- Topik / Materi acuan:\n"""\n${topic}\n"""`,
  ]
    .filter(Boolean)
    .join('\n');
}
