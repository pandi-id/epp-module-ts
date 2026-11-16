import { readFileSync } from 'fs';
import { AddressInfo } from 'net';
import * as path from 'path';
import * as tls from 'tls';
import { encodeFrame, FrameDecoder } from '../../src/core/Framing';

const TLS_DIR = path.join(__dirname, '..', 'fixtures', 'tls');
export const SERVER_CERT = readFileSync(path.join(TLS_DIR, 'server-cert.pem'));
export const SERVER_KEY = readFileSync(path.join(TLS_DIR, 'server-key.pem'));
export const CLIENT_CERT = readFileSync(path.join(TLS_DIR, 'client-cert.pem'));
export const CLIENT_KEY = readFileSync(path.join(TLS_DIR, 'client-key.pem'));

export const DEFAULT_EXT_URIS = [
  'urn:ietf:params:xml:ns:secDNS-1.1',
  'urn:ietf:params:xml:ns:rgp-1.0',
  'urn:ietf:params:xml:ns:launch-1.0',
  'urn:ietf:params:xml:ns:epp:fee-1.0',
  'urn:ietf:params:xml:ns:epp:loginSec-1.0',
];

/** A greeting offering the domain, contact and host mappings and the given extensions. */
export function greetingXml(extURIs: string[] = DEFAULT_EXT_URIS, objURIs = ['domain', 'contact', 'host']): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><greeting>
<svID>Example EPP server epp.example.com</svID><svDate>2026-11-16T22:00:00.0Z</svDate>
<svcMenu><version>1.0</version><lang>en</lang>
${objURIs.map((o) => `<objURI>urn:ietf:params:xml:ns:${o}-1.0</objURI>`).join('')}
${extURIs.length ? `<svcExtension>${extURIs.map((u) => `<extURI>${u}</extURI>`).join('')}</svcExtension>` : ''}
</svcMenu>
<dcp><access><all/></access><statement><purpose><admin/><prov/></purpose><recipient><ours/><public/></recipient><retention><stated/></retention></statement></dcp>
</greeting></epp>`;
}

/** The clTRID of a command, if any. */
export function clTRIDOf(xml: string): string | undefined {
  return /<clTRID>([^<]+)<\/clTRID>/.exec(xml)?.[1];
}

/** Build a response that echoes the request's clTRID. */
export function responseXml(
  request: string,
  options: { code?: number; msg?: string; resData?: string; extension?: string; msgQ?: string; extra?: string } = {},
): string {
  const code = options.code ?? 1000;
  const clTRID = clTRIDOf(request);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><response>
<result code="${code}"><msg>${options.msg ?? 'Command completed successfully'}</msg>${options.extra ?? ''}</result>
${options.msgQ ?? ''}${options.resData ? `<resData>${options.resData}</resData>` : ''}${options.extension ? `<extension>${options.extension}</extension>` : ''}
<trID>${clTRID ? `<clTRID>${clTRID}</clTRID>` : ''}<svTRID>SV-${Math.random().toString(36).slice(2, 10)}</svTRID></trID>
</response></epp>`;
}

export interface ServerContext {
  socket: tls.TLSSocket;
  /** Send an XML document as one EPP frame. */
  send(xml: string): void;
  /** Write raw bytes, for malformed-frame tests. */
  sendRaw(bytes: Buffer): void;
}

/**
 * Answers a received command: return a response document, or nothing to
 * stay silent (the handler may answer later through `ctx.send`).
 */
export type Handler = (xml: string, ctx: ServerContext) => string | void | Promise<string | void>;

export interface MockServer {
  port: number;
  /** Every frame received, in order. */
  received: string[];
  /** Number of TLS connections accepted. */
  connections: number;
  sockets: tls.TLSSocket[];
  close(): Promise<void>;
}

/** Default handler: success for everything; logout answers 1500 and closes. */
export const defaultHandler: Handler = (xml, ctx) => {
  if (xml.includes('<hello/>')) return greetingXml();
  if (xml.includes('<logout/>')) {
    ctx.send(responseXml(xml, { code: 1500, msg: 'Command completed successfully; ending session' }));
    ctx.socket.end();
    return;
  }
  return responseXml(xml);
};

export async function startMockServer(
  handler: Handler = defaultHandler,
  options: { greeting?: string | null; requestCert?: boolean } = {},
): Promise<MockServer> {
  const received: string[] = [];
  const sockets: tls.TLSSocket[] = [];
  const state = { connections: 0 };
  const server = tls.createServer(
    {
      cert: SERVER_CERT,
      key: SERVER_KEY,
      requestCert: options.requestCert ?? false,
      rejectUnauthorized: options.requestCert ?? false,
      ca: options.requestCert ? [CLIENT_CERT] : undefined,
    },
    (socket) => {
      state.connections++;
      sockets.push(socket);
      const decoder = new FrameDecoder();
      const ctx: ServerContext = {
        socket,
        send: (xml) => {
          if (!socket.destroyed) socket.write(encodeFrame(xml));
        },
        sendRaw: (bytes) => {
          if (!socket.destroyed) socket.write(bytes);
        },
      };
      socket.on('error', () => undefined);
      if (options.greeting !== null) ctx.send(options.greeting ?? greetingXml());
      socket.on('data', async (chunk: Buffer) => {
        for (const xml of decoder.push(chunk)) {
          received.push(xml);
          const answer = await handler(xml, ctx);
          if (answer) ctx.send(answer);
        }
      });
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    received,
    sockets,
    get connections() {
      return state.connections;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
