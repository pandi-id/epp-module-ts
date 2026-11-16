import { encodeFrame, FrameDecoder } from '../src/core/Framing';

describe('EPP framing (RFC 5734 Section 4)', () => {
  it('writes the total length, header included, in network byte order', () => {
    const frame = encodeFrame('<epp/>');
    expect(frame.readUInt32BE(0)).toBe(10);
    expect(frame.subarray(4).toString()).toBe('<epp/>');
  });

  it('counts UTF-8 bytes, not characters', () => {
    const frame = encodeFrame('Jöhn ✓');
    expect(frame.readUInt32BE(0)).toBe(4 + Buffer.byteLength('Jöhn ✓'));
  });

  it('decodes whole, split and back-to-back frames', () => {
    const decoder = new FrameDecoder();
    expect(decoder.push(encodeFrame('<a/>'))).toEqual(['<a/>']);

    const bytes = Buffer.concat([encodeFrame('<b>Jöhn ✓</b>'), encodeFrame('<c/>')]);
    const frames: string[] = [];
    for (const byte of bytes) frames.push(...decoder.push(Buffer.from([byte])));
    expect(frames).toEqual(['<b>Jöhn ✓</b>', '<c/>']);
    expect(decoder.pendingBytes).toBe(0);
  });

  it('keeps a partial frame until the rest arrives', () => {
    const decoder = new FrameDecoder();
    const frame = encodeFrame('<partial/>');
    expect(decoder.push(frame.subarray(0, 6))).toEqual([]);
    expect(decoder.pendingBytes).toBe(6);
    expect(decoder.push(frame.subarray(6))).toEqual(['<partial/>']);
  });

  it('rejects lengths that cannot describe a data unit instead of looping', () => {
    for (const length of [0, 1, 4]) {
      const header = Buffer.alloc(4);
      header.writeUInt32BE(length, 0);
      expect(() => new FrameDecoder().push(header)).toThrow(/Invalid EPP frame length/);
    }
  });

  it('rejects frames above the size limit without buffering them', () => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(2048, 0);
    expect(() => new FrameDecoder(1024).push(header)).toThrow(/exceeds/);
  });

  it('reset discards buffered bytes', () => {
    const decoder = new FrameDecoder();
    decoder.push(encodeFrame('<x/>').subarray(0, 5));
    decoder.reset();
    expect(decoder.pendingBytes).toBe(0);
  });
});
