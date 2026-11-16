/**
 * Launch Phase extension (RFC 8334): helpers, builders and parsers.
 */

import { EppValidationError } from '../src/core/Errors';
import { NS } from '../src/core/Namespaces';
import {
  buildLaunchCheck,
  buildLaunchCreate,
  buildLaunchIdContainer,
  buildLaunchInfo,
  parseLaunchCheck,
  parseLaunchCreate,
  parseLaunchInfo,
} from '../src/extensions/Launch';
import { isValidLaunchPhase, isValidLaunchStatus, LAUNCH_NAMESPACE } from '../src/types/Launch';
import { parseXml } from '../src/xml/XmlReader';
import { serializeXml } from '../src/xml/XmlWriter';

const xml = (element: Parameters<typeof serializeXml>[0]) => serializeXml(element, { declaration: false });

describe('Launch extension', () => {
  describe('phase and status helpers', () => {
    test('accept RFC 8334 phases only', () => {
      for (const phase of ['sunrise', 'landrush', 'claims', 'open', 'custom']) expect(isValidLaunchPhase(phase)).toBe(true);
      for (const phase of ['invalid', 'SUNRISE', '']) expect(isValidLaunchPhase(phase)).toBe(false);
    });

    test('accept RFC 8334 statuses only', () => {
      for (const status of ['pendingValidation', 'validated', 'invalid', 'pendingAllocation', 'allocated', 'rejected', 'custom']) {
        expect(isValidLaunchStatus(status)).toBe(true);
      }
      for (const status of ['unknown', 'VALIDATED', '']) expect(isValidLaunchStatus(status)).toBe(false);
    });

    test('namespace', () => {
      expect(LAUNCH_NAMESPACE).toBe(NS.launch);
    });
  });

  describe('check forms (RFC 8334 Section 3.1)', () => {
    test('claims check defaults to the claims form', () => {
      expect(xml(buildLaunchCheck({}))).toBe('<launch:check xmlns:launch="urn:ietf:params:xml:ns:launch-1.0" type="claims"/>');
    });

    test('availability check needs a phase', () => {
      expect(xml(buildLaunchCheck({ type: 'avail', phase: 'custom', subPhase: 'idn-release' }))).toContain(
        '<launch:phase name="idn-release">custom</launch:phase>',
      );
      expect(() => buildLaunchCheck({ type: 'avail' })).toThrow(EppValidationError);
    });

    test('trademark check', () => {
      expect(xml(buildLaunchCheck({ type: 'trademark' }))).toContain('type="trademark"');
    });
  });

  describe('create (RFC 8334 Section 3.3)', () => {
    test('sunrise with several signed marks', () => {
      const out = xml(buildLaunchCreate({ phase: 'sunrise', type: 'application', encodedSignedMark: [' AAAA\n', 'BBBB'] }));
      expect(out).toContain('type="application"');
      expect(out.match(/<smd:encodedSignedMark /g)).toHaveLength(2);
      expect(out).toContain('>AAAA</smd:encodedSignedMark>');
    });

    test('claims with several accepted notices', () => {
      const out = xml(
        buildLaunchCreate({
          phase: 'claims',
          notice: [
            { noticeID: '370d0b7c9223372036854775807', validatorID: 'tmch', notAfter: '2010-08-16T09:00:00.0Z', acceptedDate: '2009-10-16T09:00:00.0Z' },
            { noticeID: 'abc123', validatorID: 'custom-tmch', notAfter: new Date('2010-08-16T09:00:00Z'), acceptedDate: new Date('2009-10-16T09:00:00Z') },
          ],
        }),
      );
      expect(out.match(/<launch:notice>/g)).toHaveLength(2);
      expect(out).toContain('<launch:notAfter>2010-08-16T09:00:00.000Z</launch:notAfter>');
    });

    test('rejects mixing signed marks and codes, empty marks, and bad dates', () => {
      expect(() => buildLaunchCreate({ phase: 'sunrise', encodedSignedMark: 'AAAA', codeMark: { code: 'x' } })).toThrow(EppValidationError);
      expect(() => buildLaunchCreate({ phase: 'sunrise', encodedSignedMark: '  ' })).toThrow(/empty/);
      expect(() =>
        buildLaunchCreate({ phase: 'claims', notice: { noticeID: 'x', notAfter: 'soon', acceptedDate: '2009-10-16T09:00:00Z' } }),
      ).toThrow(/notAfter/);
    });
  });

  describe('info, update and delete', () => {
    test('info with includeMark', () => {
      expect(xml(buildLaunchInfo({ phase: 'sunrise', applicationID: 'abc123', includeMark: true }))).toBe(
        '<launch:info xmlns:launch="urn:ietf:params:xml:ns:launch-1.0" includeMark="true"><launch:phase>sunrise</launch:phase><launch:applicationID>abc123</launch:applicationID></launch:info>',
      );
    });

    test('update and delete need an application ID', () => {
      expect(xml(buildLaunchIdContainer('delete', { phase: 'sunrise', applicationID: 'abc123' }))).toContain('<launch:delete');
      expect(() => buildLaunchIdContainer('update', { phase: 'sunrise', applicationID: '' })).toThrow(EppValidationError);
    });
  });

  describe('parsers', () => {
    test('check data without a phase', () => {
      const node = parseXml(
        '<l:chkData xmlns:l="urn:ietf:params:xml:ns:launch-1.0"><l:cd><l:name exists="1">example.tld</l:name><l:claimKey>key-1</l:claimKey></l:cd></l:chkData>',
      );
      expect(parseLaunchCheck(node)).toEqual({ results: [{ name: 'example.tld', exists: true, claimKeys: [{ key: 'key-1' }] }] });
    });

    test('create data with a custom phase', () => {
      const node = parseXml(
        '<launch:creData xmlns:launch="urn:ietf:params:xml:ns:launch-1.0"><launch:phase name="early">custom</launch:phase><launch:applicationID>2393</launch:applicationID></launch:creData>',
      );
      expect(parseLaunchCreate(node)).toEqual({ phase: 'custom', subPhase: 'early', applicationID: '2393' });
    });

    test('info data with a named custom status', () => {
      const node = parseXml(
        '<launch:infData xmlns:launch="urn:ietf:params:xml:ns:launch-1.0"><launch:phase>sunrise</launch:phase><launch:status s="custom" name="review">Under review</launch:status></launch:infData>',
      );
      expect(parseLaunchInfo(node)).toEqual({
        phase: 'sunrise',
        status: { s: 'custom', name: 'review', message: 'Under review' },
        marks: [],
      });
    });
  });
});
