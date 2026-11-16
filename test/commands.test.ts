/**
 * Every command the client can generate is validated against the official
 * IANA schemas (test/schemas). Element order, namespaces and value types are
 * therefore checked by the same rules a strict registry server applies.
 */

import { EppValidationError } from '../src/core/Errors';
import { NS } from '../src/core/Namespaces';
import {
  buildContactCheck,
  buildContactCreate,
  buildContactDelete,
  buildContactInfo,
  buildContactTransfer,
  buildContactUpdate,
} from '../src/mapping/Contact';
import {
  buildDomainCheck,
  buildDomainCreate,
  buildDomainDelete,
  buildDomainInfo,
  buildDomainRenew,
  buildDomainRestore,
  buildDomainTransfer,
  buildDomainUpdate,
} from '../src/mapping/Domain';
import { buildCommandXml, buildHelloXml } from '../src/mapping/Envelope';
import { buildHostCheck, buildHostCreate, buildHostDelete, buildHostInfo, buildHostUpdate } from '../src/mapping/Host';
import { buildLogin, buildLogout, buildPoll, LoginParams } from '../src/mapping/Session';
import { CommandParts } from '../src/mapping/Shared';
import { RgpRestoreReport } from '../src/types/Rgp';
import { el } from '../src/xml/XmlWriter';
import { expectSchemaValid } from './helpers/xsd';

const DS = { keyTag: 12345, alg: 13, digestType: 2, digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB' };
const KEY = { flags: 257, protocol: 3, alg: 13, pubKey: 'mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ==' };
const REPORT: RgpRestoreReport = {
  preData: 'Pre-delete registration data goes here. Both XML and free text are allowed.',
  postData: 'Post-restore registration data goes here. Both XML and free text are allowed.',
  delTime: '2003-07-10T22:00:00.0Z',
  resTime: '2003-07-20T22:00:00.0Z',
  resReason: 'Registrant error.',
  statement: [
    'This registrar has not restored the Registered Name in order to assume the rights to use or sell the Registered Name for itself or for any third party.',
    { text: 'The information in this report is true to best of this registrar\'s knowledge.', lang: 'en' },
  ],
  other: 'Supporting information goes here.',
};

const xmlOf = (parts: CommandParts) => buildCommandXml(parts, 'ABC-12345');

async function valid(parts: CommandParts): Promise<string> {
  const xml = xmlOf(parts);
  await expectSchemaValid(xml);
  return xml;
}

function login(overrides: Partial<LoginParams> = {}): LoginParams {
  return {
    clID: 'ClientX',
    pw: 'foo-BAR2',
    version: '1.0',
    lang: 'en',
    objURIs: [NS.domain, NS.contact, NS.host],
    extURIs: [NS.secDNS],
    ...overrides,
  };
}

describe('envelope (RFC 5730 Section 2.5)', () => {
  it('puts <extension> before <clTRID>', async () => {
    const xml = await valid(buildDomainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' }, dnssec: { dsData: [DS] } }));
    expect(xml.indexOf('<extension>')).toBeLessThan(xml.indexOf('<clTRID>'));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')).toBe(true);
  });

  it('builds a schema-valid <hello>', async () => {
    await expectSchemaValid(buildHelloXml());
  });
});

describe('session commands', () => {
  it('login announces object and extension services', async () => {
    const xml = await valid(buildLogin(login()));
    expect(xml).toContain('<clID>ClientX</clID>');
    expect(xml).toContain(`<objURI>${NS.contact}</objURI>`);
    expect(xml).toContain(`<extURI>${NS.secDNS}</extURI>`);
    expect(xml).not.toContain('loginSec');
  });

  it('login with a password change', async () => {
    const xml = await valid(buildLogin(login({ newPW: 'bar-FOO2' })));
    expect(xml).toContain('<newPW>bar-FOO2</newPW>');
  });

  it('moves long passwords to loginSec (RFC 8807)', async () => {
    const xml = await valid(
      buildLogin(
        login({
          pw: 'this is a long password',
          newPW: 'new password that is still long',
          extURIs: [NS.loginSec],
          userAgent: { app: 'EPP SDK 1.0.0', tech: 'Node.js v22', os: 'Linux' },
        }),
      ),
    );
    expect(xml).toContain('<pw>[LOGIN-SECURITY]</pw>');
    expect(xml).toContain('<newPW>[LOGIN-SECURITY]</newPW>');
    expect(xml).toContain('<loginSec:pw>this is a long password</loginSec:pw>');
    expect(xml).toContain('<loginSec:app>EPP SDK 1.0.0</loginSec:app>');
  });

  it('sends only the user agent through loginSec for short passwords', async () => {
    const xml = await valid(buildLogin(login({ extURIs: [NS.loginSec], userAgent: { tech: 'Node.js v22' } })));
    expect(xml).toContain('<pw>foo-BAR2</pw>');
    expect(xml).toContain('<loginSec:tech>Node.js v22</loginSec:tech>');
    expect(xml).not.toContain('<loginSec:pw>');
  });

  it('rejects passwords RFC 5730 cannot carry', () => {
    expect(() => buildLogin(login({ pw: 'short' }))).toThrow(EppValidationError);
    expect(() => buildLogin(login({ pw: 'a password that is too long' }))).toThrow(/loginSec/);
    expect(() => buildLogin(login({ clID: 'ab' }))).toThrow(EppValidationError);
    expect(() => buildLogin(login({ objURIs: [] }))).toThrow(EppValidationError);
  });

  it('logout and poll', async () => {
    await valid(buildLogout());
    expect(await valid(buildPoll('req'))).toContain('<poll op="req"/>');
    expect(await valid(buildPoll('ack', '12345'))).toContain('<poll op="ack" msgID="12345"/>');
    expect(() => buildPoll('ack')).toThrow(EppValidationError);
  });
});

describe('domain commands (RFC 5731)', () => {
  it('check', async () => {
    const xml = await valid(buildDomainCheck(['example.com', 'example.net']));
    expect(xml).toContain('<domain:name>example.net</domain:name>');
    expect(() => buildDomainCheck([])).toThrow(EppValidationError);
  });

  it('check with fee, claims and allocation token extensions', async () => {
    const xml = await valid(
      buildDomainCheck(['example.com'], {
        fee: { currency: 'USD', commands: [{ name: 'create', period: 2 }, 'renew', { name: 'custom', customName: 'premium-hold' }] },
        launch: { type: 'claims', phase: 'claims' },
        allocationToken: 'abc123',
      }),
    );
    expect(xml).toContain('<fee:command name="create"><fee:period unit="y">2</fee:period></fee:command>');
    expect(xml).toContain('<launch:check xmlns:launch="urn:ietf:params:xml:ns:launch-1.0" type="claims">');
  });

  it('rejects an availability launch check without a phase', () => {
    expect(() => buildDomainCheck(['example.com'], { launch: { type: 'avail' } })).toThrow(EppValidationError);
  });

  it('info with hosts filter, authInfo and extensions', async () => {
    const xml = await valid(
      buildDomainInfo('example.com', {
        hosts: 'del',
        authInfo: { pw: '2fooBAR', roid: 'SH8013-REP' },
        launch: { phase: 'sunrise', applicationID: 'abc123', includeMark: true },
        allocationToken: true,
      }),
    );
    expect(xml).toContain('<domain:name hosts="del">example.com</domain:name>');
    expect(xml).toContain('<domain:pw roid="SH8013-REP">2fooBAR</domain:pw>');
    expect(xml).toContain('<allocationToken:info');
  });

  it('create with only the elements RFC 5731 requires', async () => {
    const xml = await valid(buildDomainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' } }));
    expect(xml).not.toContain('domain:registrant');
  });

  it('create with period, host objects, registrant and contacts', async () => {
    const xml = await valid(
      buildDomainCreate({
        name: 'example.com',
        period: { value: 6, unit: 'm' },
        ns: ['ns1.example.net', 'ns2.example.net'],
        registrant: 'jd1234',
        contacts: [
          { type: 'admin', id: 'sh8013' },
          { type: 'tech', id: 'sh8013' },
          { type: 'billing', id: 'sh8013' },
        ],
        authInfo: { pw: '2fooBAR' },
      }),
    );
    expect(xml).toContain('<domain:period unit="m">6</domain:period>');
    expect(xml).toContain('<domain:contact type="billing">sh8013</domain:contact>');
  });

  it('create with host attributes, detecting IPv6', async () => {
    const xml = await valid(
      buildDomainCreate({
        name: 'example.com',
        ns: {
          hostAttr: [
            { hostName: 'ns1.example.com', hostAddr: ['192.0.2.2', { ip: '1080:0:0:0:8:800:200C:417A' }] },
            { hostName: 'ns2.example.net' },
          ],
        },
        authInfo: { pw: '2fooBAR' },
      }),
    );
    expect(xml).toContain('<domain:hostAddr ip="v6">1080:0:0:0:8:800:200C:417A</domain:hostAddr>');
  });

  it('create with DNSSEC key data', async () => {
    const xml = await valid(buildDomainCreate({ name: 'example.com', authInfo: { pw: '2fooBAR' }, dnssec: { keyData: [KEY] } }));
    expect(xml).toContain('<secDNS:flags>257</secDNS:flags>');
  });

  it('create for sunrise with an encoded signed mark (RFC 8334, RFC 7848)', async () => {
    const xml = await valid(
      buildDomainCreate({
        name: 'example.tld',
        authInfo: { pw: '2fooBAR' },
        launch: { phase: 'sunrise', type: 'application', encodedSignedMark: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4K' },
      }),
    );
    expect(xml).toContain('<smd:encodedSignedMark xmlns:smd="urn:ietf:params:xml:ns:signedMark-1.0">');
  });

  it('create during claims with an accepted notice', async () => {
    const xml = await valid(
      buildDomainCreate({
        name: 'example.tld',
        authInfo: { pw: '2fooBAR' },
        launch: {
          phase: 'claims',
          notice: {
            noticeID: '370d0b7c9223372036854775807',
            validatorID: 'tmch',
            notAfter: '2010-08-16T09:00:00.0Z',
            acceptedDate: new Date('2009-10-16T09:00:00.0Z'),
          },
        },
      }),
    );
    expect(xml).toContain('<launch:noticeID validatorID="tmch">370d0b7c9223372036854775807</launch:noticeID>');
    expect(xml).toContain('<launch:acceptedDate>2009-10-16T09:00:00.000Z</launch:acceptedDate>');
  });

  it('create with a mark code, a custom phase, a fee and an allocation token', async () => {
    await valid(
      buildDomainCreate({
        name: 'example.tld',
        authInfo: { pw: '2fooBAR' },
        launch: { phase: 'custom', subPhase: 'landrush-premium', codeMark: { code: '49FD46E6C4B45C55D4AC', validatorID: 'sample' } },
        fee: { currency: 'USD', amount: 5 },
        allocationToken: 'abc123',
      }),
    );
  });

  it('rejects creates the schema or RFCs forbid', () => {
    const base = { name: 'example.com', authInfo: { pw: '2fooBAR' } };
    expect(() => buildDomainCreate({ ...base, period: 100 })).toThrow(EppValidationError);
    expect(() => buildDomainCreate({ ...base, ns: { hostObj: ['a.example'], hostAttr: [{ hostName: 'b.example' }] } })).toThrow(
      EppValidationError,
    );
    expect(() => buildDomainCreate({ ...base, dnssec: { dsData: [DS], keyData: [KEY] } })).toThrow(EppValidationError);
    expect(() => buildDomainCreate({ ...base, dnssec: { dsData: [{ ...DS, digest: 'ABCD' }] } })).toThrow(/Invalid DS data/);
    expect(() => buildDomainCreate({ ...base, launch: { phase: 'custom' } })).toThrow(/subPhase/);
    expect(() =>
      buildDomainCreate({ ...base, launch: { phase: 'sunrise', encodedSignedMark: 'AAAA', codeMark: { code: 'x' } } }),
    ).toThrow(EppValidationError);
    expect(() => buildDomainCreate({ ...base, fee: { currency: 'usd', amount: 5 } })).toThrow(/Currency/);
    expect(() => buildDomainCreate({ ...base, fee: { amount: '-5' } })).toThrow(/non-negative/);
    expect(() => buildDomainCreate({ ...base, contacts: [{ type: 'owner' as 'admin', id: 'x' }] })).toThrow(EppValidationError);
  });

  it('delete, including a launch application', async () => {
    await valid(buildDomainDelete('example.com'));
    await valid(buildDomainDelete('example.tld', { launch: { phase: 'sunrise', applicationID: 'abc123' } }));
  });

  it('renew converts the current expiry to an xs:date', async () => {
    expect(await valid(buildDomainRenew({ name: 'example.com', curExpDate: '2000-04-03T22:00:00.0Z', period: 5 }))).toContain(
      '<domain:curExpDate>2000-04-03</domain:curExpDate>',
    );
    expect(await valid(buildDomainRenew({ name: 'example.com', curExpDate: new Date('2026-12-01T00:00:00Z') }))).toContain(
      '<domain:curExpDate>2026-12-01</domain:curExpDate>',
    );
    await valid(buildDomainRenew({ name: 'example.com', curExpDate: '2026-12-01', fee: { currency: 'EUR', amount: '9.99' } }));
    expect(() => buildDomainRenew({ name: 'example.com', curExpDate: 'not a date' })).toThrow(EppValidationError);
  });

  it('transfer operations', async () => {
    for (const op of ['query', 'approve', 'reject', 'cancel'] as const) {
      expect(await valid(buildDomainTransfer({ name: 'example.com', op }))).toContain(`<transfer op="${op}">`);
    }
    await valid(
      buildDomainTransfer({
        name: 'example.com',
        op: 'request',
        period: 1,
        authInfo: { pw: '2fooBAR', roid: 'JD1234-REP' },
        fee: { amount: '5.00' },
        allocationToken: 'abc123',
      }),
    );
    expect(() => buildDomainTransfer({ name: 'example.com', op: 'query', fee: { amount: 1 } })).toThrow(EppValidationError);
    expect(() => buildDomainTransfer({ name: 'example.com', op: 'steal' as 'request' })).toThrow(EppValidationError);
  });

  it('update with add, rem and chg', async () => {
    const xml = await valid(
      buildDomainUpdate({
        name: 'example.com',
        add: {
          ns: ['ns2.example.com'],
          contacts: [{ type: 'tech', id: 'mak21' }],
          status: [{ s: 'clientHold', lang: 'en', reason: 'Payment overdue.' }],
        },
        rem: { ns: { hostObj: ['ns1.example.com'] }, contacts: [{ type: 'tech', id: 'sh8013' }], status: ['clientUpdateProhibited'] },
        chg: { registrant: 'sh8013', authInfo: { pw: '2BARfoo' } },
      }),
    );
    expect(xml.indexOf('<domain:add>')).toBeLessThan(xml.indexOf('<domain:rem>'));
    expect(xml).toContain('<domain:status s="clientHold" lang="en">Payment overdue.</domain:status>');
  });

  it('update can clear the registrant and remove authInfo (RFC 9154)', async () => {
    const xml = await valid(buildDomainUpdate({ name: 'example.com', chg: { registrant: '', authInfo: { null: true } } }));
    expect(xml).toContain('<domain:null/>');
  });

  it('update DNSSEC data with rem before add before chg (RFC 5910)', async () => {
    const xml = await valid(
      buildDomainUpdate({
        name: 'example.com',
        dnssec: { urgent: true, rem: { all: true }, add: { dsData: [DS] }, chg: { maxSigLife: 604800 } },
      }),
    );
    expect(xml).toContain('<secDNS:update xmlns:secDNS="urn:ietf:params:xml:ns:secDNS-1.1" urgent="true">');
    expect(xml.indexOf('<secDNS:rem>')).toBeLessThan(xml.indexOf('<secDNS:add>'));
    expect(xml.indexOf('<secDNS:add>')).toBeLessThan(xml.indexOf('<secDNS:chg>'));
    await valid(buildDomainUpdate({ name: 'example.com', dnssec: { rem: { keyData: [KEY] } } }));
    expect(() => buildDomainUpdate({ name: 'example.com', dnssec: { rem: { all: true, dsData: [DS] } } })).toThrow(EppValidationError);
    expect(() => buildDomainUpdate({ name: 'example.com', dnssec: {} })).toThrow(EppValidationError);
  });

  it('update a launch application', async () => {
    await valid(
      buildDomainUpdate({
        name: 'example.tld',
        add: { status: ['clientHold'] },
        launch: { phase: 'sunrise', applicationID: 'abc123' },
      }),
    );
  });

  it('rejects an update with nothing to change', () => {
    expect(() => buildDomainUpdate({ name: 'example.com' })).toThrow(/add, rem or chg/);
    expect(() => buildDomainUpdate({ name: 'example.com', add: {}, chg: {} })).toThrow(EppValidationError);
  });

  it('restore request and report (RFC 3915)', async () => {
    const request = await valid(buildDomainRestore('example.com'));
    expect(request).toContain('<domain:chg/>');
    expect(request).toContain('<rgp:restore op="request"/>');
    const report = await valid(buildDomainRestore('example.com', { report: REPORT, fee: { currency: 'USD', amount: 40 } }));
    expect(report).toContain('<rgp:restore op="report"><rgp:report><rgp:preData>');
    expect(report).toContain('<fee:update');
    expect(() => buildDomainRestore('example.com', { report: { ...REPORT, statement: ['Only one statement.'] } })).toThrow(
      /two statements/,
    );
  });

  it('appends custom extension elements', async () => {
    const xml = xmlOf(
      buildDomainCreate({
        name: 'example.com',
        authInfo: { pw: '2fooBAR' },
        extensions: [el('ext:create', { 'xmlns:ext': 'urn:example:ext-1.0' }, el('ext:flag', null, 'on'))],
      }),
    );
    expect(xml).toContain('<extension><ext:create xmlns:ext="urn:example:ext-1.0"><ext:flag>on</ext:flag></ext:create></extension>');
  });
});

describe('contact commands (RFC 5733)', () => {
  const postalInfo = {
    type: 'int' as const,
    name: 'John Doe',
    org: 'Example Inc.',
    addr: { street: ['123 Example Dr.', 'Suite 100'], city: 'Dulles', sp: 'VA', pc: '20166-6503', cc: 'US' },
  };

  it('check and info', async () => {
    await valid(buildContactCheck(['sh8013', 'sah8013', '8013sah']));
    expect(await valid(buildContactInfo('sh8013', { authInfo: '2fooBAR' }))).toContain('<contact:pw>2fooBAR</contact:pw>');
  });

  it('create with both postal info forms, phone extension and disclosure', async () => {
    const xml = await valid(
      buildContactCreate({
        id: 'sh8013',
        postalInfo: [postalInfo, { type: 'loc', name: 'Jöhn Döe', addr: { city: 'Dulles', cc: 'US' } }],
        voice: { number: '+1.7035555555', ext: '1234' },
        fax: '+1.7035555556',
        email: 'jdoe@example.com',
        authInfo: { pw: '2fooBAR' },
        disclose: { flag: false, name: ['int', 'loc'], addr: 'int', voice: true, email: true },
      }),
    );
    expect(xml).toContain('<contact:voice x="1234">+1.7035555555</contact:voice>');
    expect(xml).toContain('<contact:disclose flag="0"><contact:name type="int"/><contact:name type="loc"/>');
  });

  it('accepts the { type } disclose form', async () => {
    await valid(
      buildContactCreate({
        id: 'sh8013',
        postalInfo,
        email: 'jdoe@example.com',
        authInfo: { pw: '2fooBAR' },
        disclose: { flag: 1, org: { type: 'int' } },
      }),
    );
  });

  it('update statuses, postal info and disclosure', async () => {
    await valid(
      buildContactUpdate({
        id: 'sh8013',
        add: { status: ['clientDeleteProhibited'] },
        rem: { status: [{ s: 'clientUpdateProhibited' }] },
        chg: {
          postalInfo: { type: 'int', org: '', addr: { street: ['124 Example Dr.'], city: 'Dulles', cc: 'US' } },
          voice: '',
          email: 'jdoe@example.org',
          authInfo: { pw: '2fooBAR' },
          disclose: { flag: true, voice: true, email: true },
        },
      }),
    );
  });

  it('delete and transfer', async () => {
    await valid(buildContactDelete('sh8013'));
    await valid(buildContactTransfer({ id: 'sh8013', op: 'request', authInfo: { pw: '2fooBAR' } }));
    await valid(buildContactTransfer({ id: 'sh8013', op: 'query' }));
  });

  it('rejects invalid contacts', () => {
    const base = { id: 'sh8013', email: 'jdoe@example.com', authInfo: { pw: '2fooBAR' } };
    expect(() => buildContactCreate({ ...base, postalInfo: [postalInfo, postalInfo] })).toThrow(/different types/);
    expect(() => buildContactCreate({ ...base, postalInfo: [] })).toThrow(EppValidationError);
    expect(() => buildContactCreate({ ...base, postalInfo, voice: '703-555-5555' })).toThrow(/\+CC\.NUMBER/);
    expect(() =>
      buildContactCreate({ ...base, postalInfo: { ...postalInfo, addr: { ...postalInfo.addr, street: ['a', 'b', 'c', 'd'] } } }),
    ).toThrow(/street/);
    expect(() => buildContactUpdate({ id: 'sh8013' })).toThrow(EppValidationError);
  });
});

describe('host commands (RFC 5732)', () => {
  it('check, info and delete', async () => {
    await valid(buildHostCheck(['ns1.example.com', 'ns2.example.com']));
    await valid(buildHostInfo('ns1.example.com'));
    await valid(buildHostDelete('ns1.example.com'));
  });

  it('create with glue addresses, detecting IP versions', async () => {
    const xml = await valid(buildHostCreate({ name: 'ns1.example.com', addr: ['192.0.2.2', '192.0.2.29', '1080:0:0:0:8:800:200C:417A'] }));
    expect(xml).toContain('<host:addr ip="v4">192.0.2.29</host:addr>');
    expect(xml).toContain('<host:addr ip="v6">1080:0:0:0:8:800:200C:417A</host:addr>');
    await valid(buildHostCreate({ name: 'ns1.example.net' }));
  });

  it('update addresses, statuses and name', async () => {
    await valid(
      buildHostUpdate({
        name: 'ns1.example.com',
        add: { addr: [{ ip: '192.0.2.22', type: 'v4' }], status: ['clientUpdateProhibited'] },
        rem: { addr: ['1080:0:0:0:8:800:200C:417A'] },
        chg: { name: 'ns2.example.com' },
      }),
    );
    expect(() => buildHostUpdate({ name: 'ns1.example.com' })).toThrow(EppValidationError);
  });
});
