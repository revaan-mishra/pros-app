import test from 'node:test';
import assert from 'node:assert/strict';
import { selectByteRange } from './http-range.mjs';

test('a request without Range receives the complete file, including empty files', () => {
  assert.deepEqual(selectByteRange(undefined, 10), { status: 200, start: 0, end: 9, length: 10 });
  assert.deepEqual(selectByteRange(undefined, 0), { status: 200, start: 0, end: -1, length: 0 });
});
test('bounded, open, and suffix ranges select exactly the bytes requested', () => {
  assert.deepEqual(selectByteRange('bytes=2-5', 10), { status: 206, start: 2, end: 5, length: 4, contentRange: 'bytes 2-5/10' });
  assert.deepEqual(selectByteRange('bytes=5-', 10), { status: 206, start: 5, end: 9, length: 5, contentRange: 'bytes 5-9/10' });
  assert.deepEqual(selectByteRange('bytes=-3', 10), { status: 206, start: 7, end: 9, length: 3, contentRange: 'bytes 7-9/10' });
  assert.deepEqual(selectByteRange('bytes=0-0', 10), { status: 206, start: 0, end: 0, length: 1, contentRange: 'bytes 0-0/10' });
});
test('oversized end and suffix ranges clamp to the existing representation', () => {
  assert.deepEqual(selectByteRange('bytes=3-999999999999999999999999999999', 10), { status: 206, start: 3, end: 9, length: 7, contentRange: 'bytes 3-9/10' });
  assert.deepEqual(selectByteRange('bytes=-999999999999999999999999999999', 10), { status: 206, start: 0, end: 9, length: 10, contentRange: 'bytes 0-9/10' });
});
test('malformed, unsatisfiable, multiple, and empty-file ranges are rejected', () => {
  for (const header of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=', '', 'items=0-2', 'bytes=0-1,3-4', 'bytes=0-1,', 'bytes=1.5-3', 'bytes=-1-3', 'bytes=99999999999999999999999999999-']) {
    assert.deepEqual(selectByteRange(header, 10), { status: 416, start: 0, end: -1, length: 0, contentRange: 'bytes */10' }, header);
  }
  assert.equal(selectByteRange('bytes=0-0', 0).status, 416);
  assert.equal(selectByteRange(`bytes=${'9'.repeat(300)}-`, 10).status, 416);
});
test('range-unit casing and outer whitespace do not change the selection', () => {
  assert.deepEqual(selectByteRange('  BYTES=02-05  ', 10), selectByteRange('bytes=2-5', 10));
});
test('invalid filesystem lengths are rejected rather than constructing unsafe offsets', () => {
  for (const size of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => selectByteRange('bytes=0-', size), RangeError);
});
