import type {
  AdminProvidersSnapshot,
  ApiHealthResponse,
  GroundingSource,
  QuizEvaluationResult,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitRequest,
  SummarizeRequest,
  SummaryOutput,
  TutorRequest,
} from '../types/index.ts';

const CLIENT_TIMEOUT_MS = 30_000;

export async function fetchApiHealth(): Promise<ApiHealthResponse> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { ok: false, apiConfigured: false, model: '' };
    }
    return (await res.json()) as ApiHealthResponse;
  } catch {
    return { ok: false, apiConfigured: false, model: '' };
  }
}

export async function fetchAdminProviders(
  token: string,
): Promise<AdminProvidersSnapshot> {
  const res = await fetch('/api/admin/providers', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await res.json().catch(() => ({}))) as AdminProvidersSnapshot & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || 'Gagal memuat status provider AI.');
  }
  return body;
}

async function parseSseStream(
  response: Response,
  onEvent: (data: Record<string, unknown>) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error('Browser tidak mendukung pembacaan stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      if (!rawEvent) continue;
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            onEvent(parsed);
          } catch {
            // Skip malformed SSE line
          }
        }
      }
    }
  }
}

export async function streamTutorApi(
  token: string,
  payload: TutorRequest,
  callbacks: {
    onChunk: (delta: string) => void;
    onDone: (meta: { sources: GroundingSource[]; hasGrounding: boolean }) => void;
    onError: (message: string) => void;
  },
  externalSignal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  const abortFromParent = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromParent);

  try {
    const res = await fetch('/api/tutor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      callbacks.onError(
        errBody.error || `Gagal menghubungi AI Tutor (kode ${res.status}).`,
      );
      return;
    }

    let finished = false;
    await parseSseStream(res, (event) => {
      if (event.type === 'chunk' && typeof event.text === 'string') {
        callbacks.onChunk(event.text);
      } else if (event.type === 'done') {
        finished = true;
        callbacks.onDone({
          sources: Array.isArray(event.sources)
            ? (event.sources as GroundingSource[])
            : [],
          hasGrounding: Boolean(event.hasGrounding),
        });
      } else if (event.type === 'error' && typeof event.message === 'string') {
        finished = true;
        callbacks.onError(event.message);
      }
    });

    if (!finished) {
      callbacks.onError('Koneksi stream terputus sebelum jawaban selesai.');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onError(
        'Waktu permintaan habis (30 detik) atau dibatalkan. Silakan coba lagi.',
      );
      return;
    }
    callbacks.onError(
      'Gagal terhubung ke server AI Tutor. Periksa koneksi internet lalu coba lagi.',
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromParent);
  }
}

export async function streamSummarizeApi(
  token: string,
  payload: SummarizeRequest,
  callbacks: {
    onReceived: (charCount: number) => void;
    onPartial: (partial: Partial<SummaryOutput>) => void;
    onDone: (summary: SummaryOutput) => void;
    onError: (message: string) => void;
  },
  externalSignal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  const abortFromParent = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromParent);

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      callbacks.onError(
        errBody.error || `Gagal merangkum materi (kode ${res.status}).`,
      );
      return;
    }

    let finished = false;
    await parseSseStream(res, (event) => {
      if (event.type === 'received' && typeof event.charCount === 'number') {
        callbacks.onReceived(event.charCount);
      } else if (event.type === 'delta' && event.partial && typeof event.partial === 'object') {
        callbacks.onPartial(event.partial as Partial<SummaryOutput>);
      } else if (event.type === 'done' && event.summary && typeof event.summary === 'object') {
        finished = true;
        callbacks.onDone(event.summary as SummaryOutput);
      } else if (event.type === 'error' && typeof event.message === 'string') {
        finished = true;
        callbacks.onError(event.message);
      }
    });

    if (!finished) {
      callbacks.onError('Koneksi rangkuman terputus sebelum selesai. Silakan coba lagi.');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onError(
        'Waktu permintaan habis (30 detik) atau dibatalkan. Silakan coba lagi.',
      );
      return;
    }
    callbacks.onError(
      'Gagal terhubung ke server perangkum. Periksa koneksi internet lalu coba lagi.',
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromParent);
  }
}

export async function generateQuizApi(
  token: string,
  payload: QuizGenerateRequest,
): Promise<QuizGenerateResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as QuizGenerateResponse & {
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error || `Gagal membuat kuis (kode ${res.status}).`);
    }
    return body;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Waktu pembuatan kuis habis (30 detik). Silakan coba lagi.');
    }
    if (err instanceof Error) throw err;
    throw new Error('Gagal membuat kuis. Periksa koneksi jaringan.');
  } finally {
    clearTimeout(timer);
  }
}

export async function submitQuizApi(
  token: string,
  payload: QuizSubmitRequest,
): Promise<QuizEvaluationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as QuizEvaluationResult & {
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error || `Gagal mengirim jawaban kuis (kode ${res.status}).`);
    }
    return body;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Waktu pengiriman jawaban habis (30 detik). Silakan coba lagi.');
    }
    if (err instanceof Error) throw err;
    throw new Error('Gagal mengirim jawaban kuis. Periksa koneksi jaringan.');
  } finally {
    clearTimeout(timer);
  }
}
