/**
 * EppClient against an in-process TLS server speaking RFC 5734 framing.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import { EppClient } from '../src/core/EppClient';
import { EppCommandError, EppConnectionError, EppProtocolError, EppTimeoutError, EppValidationError } from '../src/core/Errors';
import { NS } from '../src/core/Namespaces';
import { EppConfig } from '../src/types/Common';
import { el } from '../src/xml/XmlWriter';
import {
  CLIENT_CERT,
  CLIENT_KEY,
  clTRIDOf,
  defaultHandler,
  greetingXml,
  Handler,
  MockServer,
  responseXml,
  SERVER_CERT,
  startMockServer,
} from './helpers/mockServer';

const FIXTURES = path.join(__dirname, 'fixtures', 'responses');

/** A fixture whose transaction clTRID is replaced with the request's. */
function fixtureFor(name: string, request: string): string {
  const xml = readFileSync(path.join(FIXTURES, name), 'utf8');
  return xml.replace(/<trID>[\s\S]*?<\/trID>/, `<trID><clTRID>${clTRIDOf(request)}</clTRID><svTRID>54321-XYZ</svTRID></trID>`);
}

let server: MockServer | undefined;
let client: EppClient | undefined;

function newClient(overrides: Partial<EppConfig> = {}): EppClient {
  client = new EppClient({
    host: '127.0.0.1',
    port: server!.port,
    username: 'ClientX',
    password: 'foo-BAR2',
    ca: SERVER_CERT,
    servername: 'localhost',
    timeout: 2000,
    ...overrides,
  });
  return client;
}

async function connectedClient(handler: Handler = defaultHandler, overrides: Partial<EppConfig> = {}, greeting?: string) {
  server = await startMockServer(handler, { greeting });
  const c = newClient(overrides);
  await c.login();
  return c;
}

const until = async (condition: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

afterEach(async () => {
  if (client) {
    client.removeAllListeners();
    await client.disconnect().catch(() => undefined);
  }
  if (server) await server.close();
  client = undefined;
  server = undefined;
});

describe('connection and login', () => {
  it('receives the greeting and announces the services both sides support', async () => {
    server = await startMockServer(defaultHandler, {
      greeting: greetingXml([NS.secDNS, NS.rgp, 'urn:example:custom-1.0'], ['domain', 'host']),
    });
    const c = newClient();
    const greeting = await c.connect();
    expect(greeting.svID).toBe('Example EPP server epp.example.com');
    expect(c.isConnected()).toBe(true);
    expect(c.isLoggedIn()).toBe(false);

    const response = await c.login();
    expect(response.code).toBe(1000);
    expect(c.isLoggedIn()).toBe(true);
    expect(c.getServices()).toEqual({ objURIs: [NS.domain, NS.host], extURIs: [NS.secDNS, NS.rgp] });
    const login = server.received[0];
    expect(login).toContain('<clID>ClientX</clID>');
    expect(login).not.toContain(NS.contact);
    expect(login).not.toContain('urn:example:custom-1.0');
  });

  it('lets configuration override the announced services', async () => {
    const c = await connectedClient(defaultHandler, { extURIs: ['urn:example:custom-1.0'] });
    expect(c.getServices()?.extURIs).toEqual(['urn:example:custom-1.0']);
    expect(server!.received[0]).toContain('<extURI>urn:example:custom-1.0</extURI>');
  });

  it('adds registry-specific extensions the server offers', async () => {
    const offered = 'urn:example:offered-1.0';
    server = await startMockServer(defaultHandler, { greeting: greetingXml([NS.secDNS, offered]) });
    await newClient({ additionalExtURIs: [offered, 'urn:example:not-offered-1.0'] }).login();
    expect(client!.getServices()?.extURIs).toEqual([NS.secDNS, offered]);
    expect(server.received[0]).not.toContain('not-offered');
  });

  it('sends long passwords and a user agent through loginSec', async () => {
    const c = await connectedClient(defaultHandler, { password: 'a much longer password than sixteen' });
    const login = server!.received[0];
    expect(login).toContain('<pw>[LOGIN-SECURITY]</pw>');
    expect(login).toContain('<loginSec:pw>a much longer password than sixteen</loginSec:pw>');
    expect(login).toContain(`<loginSec:app>epp-ts`);
    expect(c.isLoggedIn()).toBe(true);
  });

  it('refuses a long password when the server lacks loginSec', async () => {
    server = await startMockServer(defaultHandler, { greeting: greetingXml([NS.secDNS]) });
    const c = newClient({ password: 'a much longer password than sixteen' });
    await expect(c.login()).rejects.toBeInstanceOf(EppValidationError);
    expect(server.received).toHaveLength(0);
  });

  it('reports a failed login as EppCommandError', async () => {
    server = await startMockServer((xml) => responseXml(xml, { code: 2200, msg: 'Authentication error' }));
    await expect(newClient().login()).rejects.toMatchObject({ name: 'EppCommandError', code: 2200 });
    expect(client!.isLoggedIn()).toBe(false);
  });

  it('times out when no greeting arrives', async () => {
    server = await startMockServer(defaultHandler, { greeting: null });
    await expect(newClient({ connectTimeout: 150 }).connect()).rejects.toBeInstanceOf(EppTimeoutError);
  });

  it('rejects commands before connecting', async () => {
    server = await startMockServer();
    await expect(newClient().domainCheck('example.com')).rejects.toBeInstanceOf(EppConnectionError);
  });

  it('logs out and disconnects', async () => {
    const c = await connectedClient();
    const response = await c.logout();
    expect(response.code).toBe(1500);
    expect(c.isLoggedIn()).toBe(false);
    await c.disconnect();
    expect(c.isConnected()).toBe(false);
  });
});

describe('TLS (RFC 5734 Section 9)', () => {
  it('verifies the server certificate by default', async () => {
    server = await startMockServer();
    await expect(newClient({ ca: undefined }).connect()).rejects.toBeInstanceOf(EppConnectionError);
  });

  it('checks the certificate name unless disabled', async () => {
    server = await startMockServer();
    await expect(newClient({ servername: 'wrong.example' }).connect()).rejects.toBeInstanceOf(EppConnectionError);
    await client!.disconnect();
    const greeting = await newClient({ servername: 'wrong.example', checkServerIdentity: false }).connect();
    expect(greeting.svID).toBeTruthy();
    expect(client!.getConnectionInfo()?.protocol).toMatch(/TLSv1\.[23]/);
  });

  it('wraps unusable key material in EppConnectionError', async () => {
    server = await startMockServer();
    const error = await newClient({ clientCert: CLIENT_CERT, clientKey: 'not a key' }).connect().catch((e) => e);
    expect(error).toBeInstanceOf(EppConnectionError);
    expect(error.message).toMatch(/^Invalid TLS configuration: \S/);
    // Node creates this error outside Jest's sandbox realm, so check its shape rather than instanceof.
    expect(typeof error.cause?.message).toBe('string');
  });

  it('includes the error code when a connection is refused', async () => {
    server = await startMockServer();
    const port = server.port;
    await server.close();
    server = undefined;
    const error = await new EppClient({ host: '127.0.0.1', port, username: 'ClientX', password: 'foo-BAR2' }).connect().catch((e) => e);
    expect(error).toBeInstanceOf(EppConnectionError);
    expect(error.message).toContain('ECONNREFUSED');
  });

  it('authenticates with a client certificate', async () => {
    server = await startMockServer(defaultHandler, { requestCert: true });
    await newClient({ clientCert: CLIENT_CERT, clientKey: CLIENT_KEY }).login();
    expect(client!.isLoggedIn()).toBe(true);
    await client!.disconnect();
    await expect(newClient().connect()).rejects.toBeInstanceOf(Error);
  });
});

describe('commands', () => {
  it('parses check, info and create responses', async () => {
    const c = await connectedClient((xml, ctx) => {
      if (xml.includes('<domain:check')) return fixtureFor('domain-check.xml', xml);
      if (xml.includes('<domain:info')) return fixtureFor('domain-info.xml', xml);
      if (xml.includes('<domain:create')) return fixtureFor('domain-create.xml', xml);
      return defaultHandler(xml, ctx);
    });
    const check = await c.domainCheck(['example.com', 'example.net', 'example.org']);
    expect(check.data?.map((r) => r.available)).toEqual([true, false, true]);

    const info = await c.domainInfo('example.com', '2fooBAR');
    expect(info.data?.registrant).toBe('jd1234');
    expect(info.extensions.rgp?.rgpStatus[0].s).toBe('redemptionPeriod');
    expect(server!.received.at(-1)).toContain('<domain:pw>2fooBAR</domain:pw>');

    const create = await c.domainCreate({ name: 'example.com', period: 1, authInfo: { pw: '2fooBAR' }, fee: { amount: '5.00' } });
    expect(create.data?.exDate).toBe('2001-04-03T22:00:00.0Z');
    expect(create.extensions.fee?.balance).toBe('-5.00');
  });

  it('turns 2xxx results into EppCommandError and keeps the session', async () => {
    const c = await connectedClient((xml, ctx) => {
      if (xml.includes('<domain:create')) {
        return responseXml(xml, {
          code: 2302,
          msg: 'Object exists',
          extra: '<extValue><value><domain:name xmlns:domain="urn:ietf:params:xml:ns:domain-1.0">example.com</domain:name></value><reason>Registered</reason></extValue>',
        });
      }
      return defaultHandler(xml, ctx);
    });
    const error = await c.domainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' } }).catch((e) => e);
    expect(error).toBeInstanceOf(EppCommandError);
    expect(error.code).toBe(2302);
    expect(error.message).toBe('EPP 2302: Object exists (Registered)');
    expect(error.results[0].extValues[0].value).toContain('example.com');
    expect((await c.domainCheck('example.org')).code).toBe(1000);
  });

  it('queues concurrent commands so each gets its own response', async () => {
    const c = await connectedClient((xml, ctx) => {
      const name = /<domain:name>([^<]+)</.exec(xml)?.[1];
      if (!name) return defaultHandler(xml, ctx);
      setTimeout(
        () =>
          ctx.send(
            responseXml(xml, {
              resData: `<domain:chkData xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"><domain:cd><domain:name avail="1">${name}</domain:name></domain:cd></domain:chkData>`,
            }),
          ),
        Math.random() * 20,
      );
    });
    const names = ['a.example', 'b.example', 'c.example', 'd.example', 'e.example'];
    const results = await Promise.all(names.map((name) => c.domainCheck(name)));
    expect(results.map((r) => r.data?.[0].name)).toEqual(names);
  });

  it('polls and acknowledges messages', async () => {
    const c = await connectedClient((xml, ctx) => {
      if (xml.includes('op="req"')) return fixtureFor('poll-transfer.xml', xml);
      if (xml.includes('op="ack"')) return responseXml(xml, { msgQ: '<msgQ count="4" id="12346"/>' });
      return defaultHandler(xml, ctx);
    });
    const message = await c.poll('req');
    expect(message.code).toBe(1301);
    expect(message.msgQ).toMatchObject({ id: '12345', count: 5, message: 'Transfer requested.' });
    expect(message.data?.type).toBe('domain:trnData');
    const ack = await c.poll('ack', message.msgQ!.id);
    expect(ack.msgQ?.count).toBe(4);
    expect(server!.received.at(-1)).toContain('<poll op="ack" msgID="12345"/>');
  });

  it('maps every command to its response data', async () => {
    const c = await connectedClient((xml, ctx) => {
      if (xml.includes('<domain:renew')) return fixtureFor('domain-renew.xml', xml);
      if (xml.includes('<domain:transfer')) return fixtureFor('domain-transfer.xml', xml);
      if (xml.includes('<domain:check') && xml.includes('<fee:check')) return fixtureFor('fee-check.xml', xml);
      if (xml.includes('<contact:check')) return fixtureFor('contact-check.xml', xml);
      if (xml.includes('<contact:info')) return fixtureFor('contact-info.xml', xml);
      if (xml.includes('<contact:create')) {
        return responseXml(xml, {
          resData: `<contact:creData xmlns:contact="${NS.contact}"><contact:id>sh8013</contact:id><contact:crDate>1999-04-03T22:00:00.0Z</contact:crDate></contact:creData>`,
        });
      }
      if (xml.includes('<contact:transfer')) {
        return responseXml(xml, {
          code: 1001,
          resData:
            `<contact:trnData xmlns:contact="${NS.contact}"><contact:id>sh8013</contact:id><contact:trStatus>pending</contact:trStatus>` +
            '<contact:reID>ClientX</contact:reID><contact:reDate>2000-06-06T22:00:00.0Z</contact:reDate>' +
            '<contact:acID>ClientY</contact:acID><contact:acDate>2000-06-11T22:00:00.0Z</contact:acDate></contact:trnData>',
        });
      }
      if (xml.includes('<host:check')) {
        return responseXml(xml, {
          resData: `<host:chkData xmlns:host="${NS.host}"><host:cd><host:name avail="1">ns1.example.com</host:name></host:cd></host:chkData>`,
        });
      }
      if (xml.includes('<host:info')) return fixtureFor('host-info.xml', xml);
      if (xml.includes('<host:create')) {
        return responseXml(xml, {
          resData: `<host:creData xmlns:host="${NS.host}"><host:name>ns1.example.com</host:name><host:crDate>1999-04-03T22:00:00.0Z</host:crDate></host:creData>`,
        });
      }
      if (xml.includes('<domain:update') && xml.includes('<rgp:update')) {
        return responseXml(xml, { extension: `<rgp:upData xmlns:rgp="${NS.rgp}"><rgp:rgpStatus s="pendingRestore"/></rgp:upData>` });
      }
      return defaultHandler(xml, ctx);
    });

    expect((await c.domainRenew({ name: 'example.com', curExpDate: '2000-04-03', period: 5 })).data?.exDate).toBe('2005-04-03T22:00:00.0Z');
    expect((await c.domainTransfer({ name: 'example.com', op: 'request', authInfo: { pw: '2fooBAR' } })).data?.trStatus).toBe('pending');
    expect((await c.domainUpdate({ name: 'example.com', add: { status: ['clientHold'] } })).code).toBe(1000);
    expect((await c.domainDelete('example.com')).code).toBe(1000);
    expect((await c.domainRestore('example.com')).extensions.rgp?.rgpStatus[0].s).toBe('pendingRestore');

    const fees = await c.feeCheck({ domain: ['example.com', 'example.xyz'], command: ['create', 'renew'], period: 2, currency: 'USD' });
    expect(fees.data?.items[0].class).toBe('Premium');
    expect(server!.received.at(-1)).toContain('<fee:command name="create"><fee:period unit="y">2</fee:period></fee:command>');

    expect((await c.contactCheck(['sh8013', 'sah8013'])).data?.[1].available).toBe(false);
    expect((await c.contactInfo('sh8013', '2fooBAR')).data?.voiceExt).toBe('1234');
    const contact = await c.contactCreate({
      id: 'sh8013',
      postalInfo: { type: 'int', name: 'John Doe', addr: { city: 'Dulles', cc: 'US' } },
      email: 'jdoe@example.com',
      authInfo: { pw: '2fooBAR' },
    });
    expect(contact.data?.id).toBe('sh8013');
    expect((await c.contactUpdate({ id: 'sh8013', chg: { email: 'new@example.com' } })).code).toBe(1000);
    expect((await c.contactTransfer({ id: 'sh8013', op: 'request', authInfo: { pw: '2fooBAR' } })).data?.acID).toBe('ClientY');
    expect((await c.contactDelete('sh8013')).code).toBe(1000);

    expect((await c.hostCheck('ns1.example.com')).data?.[0].available).toBe(true);
    expect((await c.hostInfo('ns1.example.com')).data?.addr).toHaveLength(3);
    expect((await c.hostCreate({ name: 'ns1.example.com', addr: ['192.0.2.2'] })).data?.crDate).toBe('1999-04-03T22:00:00.0Z');
    expect((await c.hostUpdate({ name: 'ns1.example.com', chg: { name: 'ns2.example.com' } })).code).toBe(1000);
    expect((await c.hostDelete('ns2.example.com')).code).toBe(1000);
  });

  it('answers hello with a fresh greeting', async () => {
    const c = await connectedClient();
    const greeting = await c.hello();
    expect(greeting.objURIs).toContain(NS.domain);
  });

  it('sends raw XML documents', async () => {
    const c = await connectedClient();
    const raw = '<?xml version="1.0" encoding="UTF-8"?><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><command><check><domain:check xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"><domain:name>x.example</domain:name></domain:check></check><clTRID>RAW-1</clTRID></command></epp>';
    const response = await c.sendRaw(raw);
    expect(response.clTRID).toBe('RAW-1');
  });

  it('sends registry-specific extensions and requires their namespace declaration', async () => {
    const uri = 'urn:example:ext-1.0';
    const c = await connectedClient(defaultHandler, { additionalExtURIs: [uri] }, greetingXml([uri]));
    await c.domainCreate({
      name: 'example.com',
      authInfo: { pw: '2fooBAR' },
      extensions: [el('ext:create', { 'xmlns:ext': uri }, el('ext:flag', null, 'on'))],
    });
    expect(server!.received.at(-1)).toContain('<ext:create xmlns:ext="urn:example:ext-1.0"><ext:flag>on</ext:flag></ext:create>');

    const sent = server!.received.length;
    await expect(
      c.domainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' }, extensions: [el('ext:create', null, 'x')] }),
    ).rejects.toThrow(/must declare its namespace/);
    expect(server!.received).toHaveLength(sent);
  });

  it('refuses extensions that were not announced at login', async () => {
    const c = await connectedClient(defaultHandler, {}, greetingXml([NS.rgp]));
    const sent = server!.received.length;
    await expect(
      c.domainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' }, dnssec: { dsData: [{ keyTag: 1, alg: 13, digestType: 2, digest: 'AB'.repeat(32) }] } }),
    ).rejects.toThrow(/not announced at login/);
    expect(server!.received).toHaveLength(sent);
  });
});

describe('failure handling', () => {
  it('times out a command and closes the connection', async () => {
    const c = await connectedClient(
      (xml, ctx) => (xml.includes('<domain:check') ? undefined : defaultHandler(xml, ctx)),
      { timeout: 200 },
    );
    await expect(c.domainCheck('slow.example')).rejects.toBeInstanceOf(EppTimeoutError);
    await until(() => !c.isConnected());
    await expect(c.domainCheck('next.example')).rejects.toBeInstanceOf(EppConnectionError);
  });

  it('fails the pending command at once when the server closes the connection', async () => {
    const c = await connectedClient((xml, ctx) => (xml.includes('<domain:check') ? void ctx.socket.destroy() : defaultHandler(xml, ctx)), {
      timeout: 10000,
    });
    const start = Date.now();
    await expect(c.domainCheck('example.com')).rejects.toBeInstanceOf(EppConnectionError);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('closes the connection on a zero-length frame instead of hanging', async () => {
    const c = await connectedClient((xml, ctx) => {
      if (!xml.includes('<domain:check')) return defaultHandler(xml, ctx);
      ctx.sendRaw(Buffer.from([0, 0, 0, 0]));
    });
    await expect(c.domainCheck('example.com')).rejects.toBeInstanceOf(EppProtocolError);
    await until(() => !c.isConnected());
  });

  it('closes the connection when the response belongs to another transaction', async () => {
    const c = await connectedClient((xml, ctx) =>
      xml.includes('<domain:check') ? responseXml(xml.replace(/<clTRID>[^<]+/, '<clTRID>OTHER-1'), {}) : defaultHandler(xml, ctx),
    );
    await expect(c.domainCheck('example.com')).rejects.toThrow(/does not match/);
    await until(() => !c.isConnected());
  });

  it('reconnects and logs in again when autoReconnect is on', async () => {
    const c = await connectedClient(defaultHandler, { autoReconnect: true });
    const reconnected = new Promise<void>((resolve) => c.once('reconnect', () => resolve()));
    server!.sockets[0].destroy();
    await until(() => !c.isConnected());
    const response = await c.domainCheck('example.com');
    expect(response.code).toBe(1000);
    await reconnected;
    expect(server!.connections).toBe(2);
    expect(server!.received.filter((xml) => xml.includes('<login>'))).toHaveLength(2);
  });

  it('does not reconnect after an explicit disconnect', async () => {
    const c = await connectedClient(defaultHandler, { autoReconnect: true });
    await c.disconnect();
    await expect(c.domainCheck('example.com')).rejects.toBeInstanceOf(EppConnectionError);
    expect(server!.connections).toBe(1);
  });
});

describe('keep-alive and logging', () => {
  it('sends hello while the session is idle', async () => {
    await connectedClient(defaultHandler, { keepAliveInterval: 50 });
    await until(() => server!.received.filter((xml) => xml.includes('<hello/>')).length >= 2);
  });

  it('never logs passwords or authorization codes', async () => {
    const lines: string[] = [];
    const c = await connectedClient(
      (xml, ctx) => (xml.includes('<domain:info') ? fixtureFor('domain-info.xml', xml) : defaultHandler(xml, ctx)),
      { logger: { debug: (m) => lines.push(m), warn: (m) => lines.push(m) } },
    );
    await c.domainInfo('example.com', { authInfo: 'my-auth-code' });
    const log = lines.join('\n');
    expect(log).toContain('>> ');
    expect(log).toContain('<< ');
    for (const secret of ['foo-BAR2', 'my-auth-code', '2fooBAR']) expect(log).not.toContain(secret);
    expect(log).toContain('<pw>***</pw>');
  });
});
