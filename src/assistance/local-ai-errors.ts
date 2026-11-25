export type LocalAiFailureKind = 'download' | 'storage' | 'graphics' | 'cache' | 'worker' | 'timeout' | 'runtime';

export class LocalAiFailure extends Error {
  constructor(readonly kind: LocalAiFailureKind, message: string = kind) {
    super(message);
  }
}

/** Share a bounded failure kind across the worker boundary, never raw error text. */
export function localAiFailureKind(error: unknown): LocalAiFailureKind {
  if (error instanceof LocalAiFailure) return error.kind;
  const detail = error as { name?: unknown; message?: unknown } | null | undefined;
  const name = typeof detail?.name === 'string' ? detail.name : '';
  const message = typeof detail?.message === 'string' ? detail.message : '';

  if (name === 'QuotaExceededError' || /quota exceeded|storage quota/i.test(message)) return 'storage';
  if (/WebGPU|shader-f16|maxStorageBuffer|maxBufferSize|maxComputeWorkgroup|device was lost|GPU memory/i.test(message)) return 'graphics';
  if (name === 'SyntaxError' && /JSON|unexpected end/i.test(message)) return 'cache';
  if (name === 'NetworkError' || /load failed|failed to fetch|failed to load resource|network error|network request failed|network connection was lost|HTTP (408|5\d\d)\b/i.test(message)) return 'download';
  return 'runtime';
}

export function localAiLoadMessage(kind: LocalAiFailureKind): string {
  switch (kind) {
    case 'download':
      return 'Olive couldn’t finish downloading the model. Check your connection and try again. Saved model files can be reused.';
    case 'storage':
      return 'This browser ran out of space for the model. Free some space or choose Remove model files, then try again.';
    case 'graphics':
      return 'This browser’s graphics device couldn’t start the model. Olive’s written guidance and the activity parser are ready.';
    case 'cache':
      return 'A saved model file couldn’t be read. Choose Remove model files, then download the model again.';
    case 'worker':
      return 'Olive’s model worker couldn’t start. Reopen PROS and try again, or use the written guidance.';
    case 'timeout':
      return 'The model took too long to prepare. Keep PROS open and try again when your connection is stable.';
    default:
      return 'Olive couldn’t prepare the model on this device. You can try again or use the written guidance.';
  }
}
