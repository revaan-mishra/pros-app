/**
 * Select a single byte range without coercing attacker-controlled integers to
 * imprecise Numbers. Multipart ranges are deliberately unsupported.
 * @param {string | undefined} header
 * @param {number} size
 * @returns {{ status: 200 | 206 | 416, start: number, end: number, length: number, contentRange?: string }}
 */
export function selectByteRange(header, size) {
  if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('File size must be a nonnegative safe integer');
  const full = { status: /** @type {const} */ (200), start: 0, end: size - 1, length: size };
  if (header === undefined) return full;
  const invalid = () => ({ status: /** @type {const} */ (416), start: 0, end: -1, length: 0, contentRange: `bytes */${size}` });
  if (typeof header !== 'string' || header.length > 256 || size === 0) return invalid();
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return invalid();
  const total = BigInt(size);
  let start;
  let end;
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (suffix === 0n) return invalid();
    start = suffix >= total ? 0n : total - suffix;
    end = total - 1n;
  } else {
    start = BigInt(match[1]);
    end = match[2] ? BigInt(match[2]) : total - 1n;
    if (start >= total || end < start) return invalid();
    if (end >= total) end = total - 1n;
  }
  return { status: 206, start: Number(start), end: Number(end), length: Number(end - start + 1n), contentRange: `bytes ${start}-${end}/${size}` };
}
