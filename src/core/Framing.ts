/**
 * EPP data unit framing (RFC 5734 Section 4).
 *
 * Each EPP data unit is a 4-byte big-endian header holding the total length
 * of the unit (header included), followed by the UTF-8 XML instance.
 */

export const FRAME_HEADER_LENGTH = 4;

/** Default upper bound for an incoming data unit: 10 MiB. */
export const DEFAULT_MAX_FRAME_SIZE = 10 * 1024 * 1024;

/** Encode an XML instance as an EPP data unit. */
export function encodeFrame(xml: string): Buffer {
  const body = Buffer.from(xml, 'utf8');
  const frame = Buffer.allocUnsafe(FRAME_HEADER_LENGTH + body.length);
  frame.writeUInt32BE(FRAME_HEADER_LENGTH + body.length, 0);
  body.copy(frame, FRAME_HEADER_LENGTH);
  return frame;
}

/**
 * Reassembles EPP data units from a TCP byte stream.
 *
 * Throws on a header that cannot describe a valid data unit, so a corrupt or
 * hostile peer cannot stall the client or make it buffer without limit.
 */
export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private readonly maxFrameSize: number = DEFAULT_MAX_FRAME_SIZE) {}

  /**
   * Add received bytes and return every XML instance completed by them.
   *
   * @throws {Error} when a header announces a length of 4 bytes or less, or
   * more than `maxFrameSize`.
   */
  push(chunk: Buffer): string[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const frames: string[] = [];
    while (this.buffer.length >= FRAME_HEADER_LENGTH) {
      const total = this.buffer.readUInt32BE(0);
      if (total <= FRAME_HEADER_LENGTH) {
        throw new Error(`Invalid EPP frame length ${total}: a data unit must be longer than its ${FRAME_HEADER_LENGTH}-byte header`);
      }
      if (total > this.maxFrameSize) {
        throw new Error(`EPP frame of ${total} bytes exceeds the ${this.maxFrameSize}-byte limit`);
      }
      if (this.buffer.length < total) break;
      frames.push(this.buffer.subarray(FRAME_HEADER_LENGTH, total).toString('utf8'));
      this.buffer = this.buffer.subarray(total);
    }
    return frames;
  }

  /** Number of buffered bytes that do not yet form a complete data unit. */
  get pendingBytes(): number {
    return this.buffer.length;
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }
}
