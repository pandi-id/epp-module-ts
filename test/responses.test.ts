/**
 * Response parsing, using fixtures modelled on the RFC examples. Every
 * fixture except unknown-extension.xml is itself checked against the
 * official schemas, so the parsers are tested on valid server output.
 */

import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { EppCommandError, EppProtocolError } from '../src/core/Errors';
import { NS } from '../src/core/Namespaces';
import { redactXml } from '../src/core/Redact';
import { parseContactCheck, parseContactInfo } from '../src/mapping/Contact';
import { parseDomainCheck, parseDomainCreate, parseDomainInfo, parseDomainRenew, parseDomainTransfer } from '../src/mapping/Domain';
import { parseHostInfo } from '../src/mapping/Host';
import { parseEppDocument, parsePollData, parseResponse, toEppResponse } from '../src/mapping/Response';
import { parseGreeting } from '../src/mapping/Session';
import { parseXml } from '../src/xml/XmlReader';
import { expectSchemaValid } from './helpers/xsd';

const FIXTURES = path.join(__dirname, 'fixtures', 'responses');
const load = (name: string) => readFileSync(path.join(FIXTURES, name), 'utf8');

function parsed(name: string) {
  const xml = load(name);
  const result = parseResponse(parseEppDocument(xml), xml);
  return { xml, ...result };
}

describe('fixtures', () => {
  const files: string[] = readdirSync(FIXTURES).filter((f) => f.endsWith('.xml') && f !== 'unknown-extension.xml');
  it.each(files)('%s is valid against the EPP schemas', async (file) => {
    await expectSchemaValid(load(file));
  });
});

describe('greeting (RFC 5730 Section 2.4)', () => {
  it('parses the service menu and data collection policy', () => {
    const greeting = parseGreeting(parseEppDocument(load('greeting.xml')).child(NS.epp, 'greeting')!);
    expect(greeting).toEqual({
      svID: 'Example EPP server epp.example.com',
      svDate: '2000-06-08T22:00:00.0Z',
      versions: ['1.0'],
      languages: ['en', 'fr'],
      objURIs: [NS.domain, NS.host],
      extURIs: [NS.secDNS, NS.rgp, 'http://custom/obj1ext-1.0'],
      dcp: {
        access: 'all',
        statements: [{ purpose: ['admin', 'prov'], recipient: ['ours', 'public'], retention: 'stated' }],
        expiry: { relative: 'P1Y' },
      },
    });
  });
});

describe('response envelope (RFC 5730 Section 2.6)', () => {
  it('reads every result with values and extValues', () => {
    const { xml, ...rest } = parsed('error-multiple.xml');
    const response = toEppResponse(rest, xml, undefined);
    expect(response.success).toBe(false);
    expect(response.code).toBe(2004);
    expect(response.results).toHaveLength(2);
    expect(response.results[0].values[0]).toBe('<obj:elem1 xmlns:obj="urn:ietf:params:xml:ns:obj">2525</obj:elem1>');
    expect(response.results[1].extValues[0]).toEqual({
      value: '<obj:elem3 xmlns:obj="urn:ietf:params:xml:ns:obj">abc.ex(ample</obj:elem3>',
      reason: 'Invalid character found.',
    });
    expect(response.clTRID).toBe('ABC-12345');
    expect(response.svTRID).toBe('54322-XYZ');

    const error = new EppCommandError(response);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(2004);
    expect(error.results).toHaveLength(2);
  });

  it('includes the first extValue reason in the error message', () => {
    const { xml, results, extensions } = parsed('error-multiple.xml');
    const response = toEppResponse({ results: [results[1]], extensions }, xml, undefined);
    expect(new EppCommandError(response).message).toBe('EPP 2005: Parameter value syntax error (Invalid character found.)');
  });

  it('rejects documents that are not EPP responses', () => {
    expect(() => parseEppDocument('not xml')).toThrow(EppProtocolError);
    expect(() => parseEppDocument('<foo xmlns="urn:example"/>')).toThrow(/Expected <epp>/);
    expect(() => parseEppDocument('<!DOCTYPE epp [<!ENTITY x "y">]><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"/>')).toThrow(/DOCTYPE/);
    const greeting = load('greeting.xml');
    expect(() => parseResponse(parseEppDocument(greeting), greeting)).toThrow(/Expected an EPP <response>/);
    const noCode = '<epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><response><result><msg>x</msg></result><trID><svTRID>abc</svTRID></trID></response></epp>';
    expect(() => parseResponse(parseEppDocument(noCode), noCode)).toThrow(/code/);
  });
});

describe('domain responses (RFC 5731)', () => {
  it('check data, whatever the prefix', () => {
    expect(parseDomainCheck(parsed('domain-check.xml').resData!)).toEqual([
      { name: 'example.com', available: true },
      { name: 'example.net', available: false, reason: 'In use' },
      { name: 'example.org', available: true },
    ]);
    expect(parseDomainCheck(parsed('domain-check-single.xml').resData!)).toEqual([
      { name: 'example.com', available: false, reason: 'Reserved' },
    ]);
  });

  it('info data with DNSSEC and RGP extensions', () => {
    const response = parsed('domain-info.xml');
    expect(parseDomainInfo(response.resData!)).toEqual({
      name: 'example.com',
      roid: 'EXAMPLE1-REP',
      status: ['ok', 'clientHold'],
      statusDetails: [{ s: 'ok' }, { s: 'clientHold', lang: 'en', reason: 'Payment overdue.' }],
      registrant: 'jd1234',
      contacts: [
        { type: 'admin', id: 'sh8013' },
        { type: 'tech', id: 'sh8013' },
      ],
      ns: { hostObj: ['ns1.example.com', 'ns1.example.net'] },
      hosts: ['ns1.example.com', 'ns2.example.com'],
      clID: 'ClientX',
      crID: 'ClientY',
      crDate: '1999-04-03T22:00:00.0Z',
      upID: 'ClientX',
      upDate: '1999-12-03T09:00:00.0Z',
      exDate: '2005-04-03T22:00:00.0Z',
      trDate: '2000-04-08T09:00:00.0Z',
      authInfo: { pw: '2fooBAR' },
    });
    expect(response.extensions.secDNS).toEqual({
      maxSigLife: 604800,
      dsData: [
        {
          keyTag: 12345,
          alg: 3,
          digestType: 1,
          digest: '49FD46E6C4B45C55D4AC',
          keyData: { flags: 257, protocol: 3, alg: 1, pubKey: 'AQPJ////4Q==' },
        },
      ],
    });
    expect(response.extensions.rgp).toEqual({ rgpStatus: [{ s: 'redemptionPeriod' }] });
  });

  it('info data with host attributes', () => {
    const info = parseDomainInfo(parsed('domain-info-hostattr.xml').resData!);
    expect(info.status).toEqual([]);
    expect(info.ns).toEqual({
      hostAttr: [
        {
          hostName: 'ns1.example.com',
          hostAddr: [
            { ip: '192.0.2.2', type: 'v4' },
            { ip: '1080:0:0:0:8:800:200C:417A', type: 'v6' },
          ],
        },
        { hostName: 'ns2.example.net', hostAddr: [] },
      ],
    });
  });

  it('create data with launch and fee extensions', () => {
    const response = parsed('domain-create.xml');
    expect(parseDomainCreate(response.resData!)).toEqual({
      name: 'example.com',
      crDate: '1999-04-03T22:00:00.0Z',
      exDate: '2001-04-03T22:00:00.0Z',
    });
    expect(response.extensions.launchCreate).toEqual({ phase: 'sunrise', applicationID: '2393-9323-E08C-03B1' });
    expect(response.extensions.fee).toEqual({
      currency: 'USD',
      fees: [{ fee: '5.00', description: 'Registration Fee', refundable: true, gracePeriod: 'P5D' }],
      credits: [],
      balance: '-5.00',
      creditLimit: '1000.00',
    });
  });

  it('renew and transfer data', () => {
    expect(parseDomainRenew(parsed('domain-renew.xml').resData!)).toEqual({ name: 'example.com', exDate: '2005-04-03T22:00:00.0Z' });
    const transfer = parsed('domain-transfer.xml');
    expect(transfer.results[0].code).toBe(1001);
    expect(parseDomainTransfer(transfer.resData!)).toEqual({
      name: 'example.com',
      trStatus: 'pending',
      reID: 'ClientX',
      reDate: '2000-06-08T22:00:00.0Z',
      acID: 'ClientY',
      acDate: '2000-06-13T22:00:00.0Z',
      exDate: '2002-09-08T22:00:00.0Z',
    });
  });
});

describe('poll responses (RFC 5730 Section 2.9.2.3)', () => {
  it('message queue with a transfer notification', () => {
    const response = parsed('poll-transfer.xml');
    expect(response.msgQ).toEqual({ id: '12345', count: 5, qDate: '2000-06-08T22:00:00.0Z', message: 'Transfer requested.' });
    const data = parsePollData(response.resData!);
    expect(data.type).toBe('domain:trnData');
    expect(data.type === 'domain:trnData' && data.value.acID).toBe('ClientY');
  });

  it('empty queue', () => {
    const response = parsed('poll-empty.xml');
    expect(response.results[0].code).toBe(1300);
    expect(response.msgQ).toBeUndefined();
    expect(response.resData).toBeUndefined();
  });

  it('pending action notification with a mixed-content message', () => {
    const response = parsed('poll-pandata.xml');
    expect(response.msgQ).toMatchObject({ id: '12346', count: 1, lang: 'en', message: 'Pending action completed successfully.' });
    expect(response.msgQ!.messageXml).toContain('<b xmlns="urn:example:markup">successfully</b>');
    expect(parsePollData(response.resData!)).toEqual({
      type: 'domain:panData',
      value: { name: 'example.com', paResult: true, paTRID: { clTRID: 'ABC-12345', svTRID: '54321-XYZ' }, paDate: '2000-06-08T22:00:00.0Z' },
    });
  });

  it('change poll extension (RFC 8590)', () => {
    const response = parsed('poll-changepoll.xml');
    expect(parsePollData(response.resData!).type).toBe('domain:infData');
    expect(response.extensions.changePoll).toEqual({
      state: 'after',
      operation: 'custom',
      op: 'purge',
      date: '2013-10-22T14:25:57.0Z',
      svTRID: '12345-XYZ',
      who: 'URS Admin',
      caseId: { id: 'urs123', type: 'urs' },
      reason: 'URS Lock',
    });
  });

  it('unknown payloads keep their XML', () => {
    const node = parseXml('<x:foo xmlns:x="urn:example">bar</x:foo>');
    expect(parsePollData(node)).toEqual({ type: 'unknown', namespace: 'urn:example', element: 'foo', xml: '<x:foo xmlns:x="urn:example">bar</x:foo>' });
  });
});

describe('contact and host responses', () => {
  it('contact info (RFC 5733)', () => {
    const info = parseContactInfo(parsed('contact-info.xml').resData!);
    expect(info.status).toEqual(['linked', 'clientDeleteProhibited']);
    expect(info.postalInfo).toEqual([
      {
        type: 'int',
        name: 'John Doe',
        org: 'Example Inc.',
        addr: { street: ['123 Example Dr.', 'Suite 100'], city: 'Dulles', sp: 'VA', pc: '20166-6503', cc: 'US' },
      },
      { type: 'loc', name: 'Jöhn Döe', addr: { street: [], city: 'Dulles', cc: 'US' } },
    ]);
    expect(info).toMatchObject({
      voice: '+1.7035555555',
      voiceExt: '1234',
      fax: '+1.7035555556',
      email: 'jdoe@example.com',
      clID: 'ClientY',
      authInfo: { pw: '2fooBAR' },
      disclose: { flag: false, name: [], org: [], addr: [], voice: true, fax: false, email: true },
    });
  });

  it('contact check', () => {
    expect(parseContactCheck(parsed('contact-check.xml').resData!)).toEqual([
      { id: 'sh8013', available: true },
      { id: 'sah8013', available: false, reason: 'In use' },
    ]);
  });

  it('host info (RFC 5732)', () => {
    expect(parseHostInfo(parsed('host-info.xml').resData!)).toEqual({
      name: 'ns1.example.com',
      roid: 'NS1_EXAMPLE1-REP',
      status: ['linked', 'clientUpdateProhibited'],
      statusDetails: [{ s: 'linked' }, { s: 'clientUpdateProhibited' }],
      addr: [
        { ip: '192.0.2.2', type: 'v4' },
        { ip: '192.0.2.29', type: 'v4' },
        { ip: '1080:0:0:0:8:800:200C:417A', type: 'v6' },
      ],
      clID: 'ClientY',
      crID: 'ClientX',
      crDate: '1999-04-03T22:00:00.0Z',
      upID: 'ClientX',
      upDate: '1999-12-03T09:00:00.0Z',
      trDate: '2000-04-08T09:00:00.0Z',
    });
  });
});

describe('extension responses', () => {
  it('launch claims check (RFC 8334)', () => {
    expect(parsed('launch-claims-check.xml').extensions.launchCheck).toEqual({
      phase: 'claims',
      results: [
        { name: 'example1.tld', exists: false, claimKeys: [] },
        {
          name: 'example2.tld',
          exists: true,
          claimKeys: [
            { key: '2013041500/2/6/9/rJ1NrDO92vDsAzf7EQzgjX4R0000000001', validatorID: 'tmch' },
            { key: '20140423200/1/2/3/rJ1Nr2vDsAzasdff7EasdfgjX4R000000002', validatorID: 'custom-tmch' },
          ],
        },
      ],
    });
  });

  it('launch info with the mark (RFC 8334, RFC 7848)', () => {
    const info = parsed('launch-info.xml').extensions.launchInfo!;
    expect(info).toMatchObject({ phase: 'sunrise', applicationID: 'abc123', status: { s: 'pendingValidation' } });
    expect(info.marks).toHaveLength(1);
    const mark = parseXml(info.marks[0]);
    expect(mark.is(NS.mark, 'mark')).toBe(true);
    expect(mark.child(NS.mark, 'trademark')?.childText(NS.mark, 'markName')).toBe('Example One');
  });

  it('fee check (RFC 8748)', () => {
    expect(parsed('fee-check.xml').extensions.feeCheck).toEqual({
      currency: 'USD',
      items: [
        {
          objID: 'example.com',
          available: true,
          class: 'Premium',
          commands: [
            {
              name: 'create',
              standard: false,
              period: { value: 2, unit: 'y' },
              fees: [{ fee: '10.00', description: 'Registration Fee', refundable: true, gracePeriod: 'P5D' }],
              credits: [],
            },
            {
              name: 'renew',
              standard: false,
              period: { value: 1, unit: 'y' },
              fees: [{ fee: '10.00', description: 'Renewal Fee', refundable: true, gracePeriod: 'P5D', applied: 'immediate' }],
              credits: [{ amount: '-2.00', description: 'Promotional credit' }],
            },
          ],
        },
        {
          objID: 'example.xyz',
          available: false,
          commands: [{ name: 'create', standard: false, period: { value: 2, unit: 'y' }, fees: [], credits: [] }],
          reason: 'Only 1 year registration periods are valid.',
        },
      ],
    });
  });

  it('login security events (RFC 8807)', () => {
    expect(parsed('login-loginsec.xml').extensions.loginSec).toEqual([
      { type: 'password', level: 'warning', exDate: '2020-03-25T00:00:00Z', lang: 'en', message: 'Password expiring in a week' },
      { type: 'cipher', level: 'warning', value: 'TLS_RSA_WITH_AES_128_CBC_SHA', message: 'Non-PFS Cipher negotiated' },
    ]);
  });

  it('keeps unknown extensions as XML', () => {
    expect(parsed('unknown-extension.xml').extensions.unknown).toEqual([
      '<ext:infData xmlns:ext="urn:example:ext-1.0"><ext:flag>on</ext:flag></ext:infData>',
    ]);
  });
});

describe('redaction', () => {
  it('hides passwords, authorization info and allocation tokens', () => {
    const xml =
      '<epp><command><login><clID>ClientX</clID><pw>foo-BAR2</pw><newPW>bar-FOO2</newPW></login>' +
      '<extension><loginSec:loginSec xmlns:loginSec="x"><loginSec:pw>long secret</loginSec:pw></loginSec:loginSec>' +
      '<allocationToken:allocationToken xmlns:allocationToken="y">tok</allocationToken:allocationToken></extension></command>' +
      '<domain:authInfo><domain:pw roid="SH8013-REP">2fooBAR</domain:pw></domain:authInfo><domain:pw/></epp>';
    const redacted = redactXml(xml);
    for (const secret of ['foo-BAR2', 'bar-FOO2', 'long secret', '>tok<', '2fooBAR']) expect(redacted).not.toContain(secret);
    expect(redacted).toContain('<pw>***</pw>');
    expect(redacted).toContain('<domain:pw roid="SH8013-REP">***</domain:pw>');
    expect(redacted).toContain('<clID>ClientX</clID>');
    expect(redacted).toContain('<domain:pw/>');
  });
});
