import type { EppResponse, EppResult } from '../types/Common';

/**
 * Base class of every error thrown by this library.
 *
 * `code` is the EPP result code (RFC 5730 Section 3) for errors reported by
 * the server, and 0 for errors raised on the client side.
 */
export class EppError extends Error {
  readonly code: number;

  constructor(message: string, code = 0) {
    super(message);
    this.name = 'EppError';
    this.code = code;
  }
}

/** The server answered a command with a 2xxx result code. */
export class EppCommandError extends EppError {
  /** The parsed response, including every `<result>` element. */
  readonly response: EppResponse<unknown>;
  readonly results: EppResult[];
  readonly clTRID?: string;
  readonly svTRID?: string;

  constructor(response: EppResponse<unknown>) {
    const reason = response.results[0]?.extValues[0]?.reason;
    super(`EPP ${response.code}: ${response.message}${reason ? ` (${reason})` : ''}`, response.code);
    this.name = 'EppCommandError';
    this.response = response;
    this.results = response.results;
    this.clTRID = response.clTRID;
    this.svTRID = response.svTRID;
  }
}

/** The connection could not be established, or was lost. */
export class EppConnectionError extends EppError {
  constructor(message: string, readonly cause?: Error) {
    super(message);
    this.name = 'EppConnectionError';
  }
}

/** No greeting or response arrived in time. The connection is closed. */
export class EppTimeoutError extends EppError {
  constructor(message: string) {
    super(message);
    this.name = 'EppTimeoutError';
  }
}

/** The server sent a malformed frame or document, or an unexpected response. */
export class EppProtocolError extends EppError {
  constructor(message: string, readonly xml?: string) {
    super(message);
    this.name = 'EppProtocolError';
  }
}

/** A request was rejected on the client side before being sent. */
export class EppValidationError extends EppError {
  constructor(message: string) {
    super(message);
    this.name = 'EppValidationError';
  }
}
