/**
 * Launch Extension Tests (RFC 8334)
 */

import {
  LaunchPhase,
  LaunchStatus,
  LaunchNotice,
  SignedMarkData,
  LaunchCreateRequest,
  LaunchCheckRequest,
  TradeMark,
  isValidLaunchPhase,
  isValidLaunchStatus,
  LAUNCH_NAMESPACE
} from '../src/types/Launch';

describe('Launch Extension', () => {
  describe('Launch Phase Validation', () => {
    test('should validate valid launch phases', () => {
      expect(isValidLaunchPhase('sunrise')).toBe(true);
      expect(isValidLaunchPhase('landrush')).toBe(true);
      expect(isValidLaunchPhase('claims')).toBe(true);
      expect(isValidLaunchPhase('open')).toBe(true);
      expect(isValidLaunchPhase('custom')).toBe(true);
    });

    test('should reject invalid launch phases', () => {
      expect(isValidLaunchPhase('invalid')).toBe(false);
      expect(isValidLaunchPhase('SUNRISE')).toBe(false);
      expect(isValidLaunchPhase('')).toBe(false);
    });
  });

  describe('Launch Status Validation', () => {
    test('should validate valid launch statuses', () => {
      expect(isValidLaunchStatus('pendingValidation')).toBe(true);
      expect(isValidLaunchStatus('validated')).toBe(true);
      expect(isValidLaunchStatus('invalid')).toBe(true);
      expect(isValidLaunchStatus('pendingAllocation')).toBe(true);
      expect(isValidLaunchStatus('allocated')).toBe(true);
      expect(isValidLaunchStatus('rejected')).toBe(true);
      expect(isValidLaunchStatus('custom')).toBe(true);
    });

    test('should reject invalid launch statuses', () => {
      expect(isValidLaunchStatus('unknown')).toBe(false);
      expect(isValidLaunchStatus('VALIDATED')).toBe(false);
      expect(isValidLaunchStatus('')).toBe(false);
    });
  });

  describe('SignedMarkData', () => {
    test('should create valid SMD structure', () => {
      const smd: SignedMarkData = {
        encodedSignedMark: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4='
      };

      expect(smd.encodedSignedMark).toBeDefined();
      expect(typeof smd.encodedSignedMark).toBe('string');
    });
  });

  describe('LaunchNotice', () => {
    test('should create valid launch notice', () => {
      const notice: LaunchNotice = {
        noticeID: 'claim-notice-12345',
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:30:00Z'
      };

      expect(notice.noticeID).toBe('claim-notice-12345');
      expect(notice.notAfter).toBe('2024-12-31T23:59:59Z');
      expect(notice.acceptedDate).toBe('2024-01-15T10:30:00Z');
    });

    test('should require acceptedDate', () => {
      const notice: LaunchNotice = {
        noticeID: 'claim-notice-12345',
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:30:00Z'
      };

      expect(notice.acceptedDate).toBeDefined();
    });
  });

  describe('LaunchCreateRequest', () => {
    test('should create sunrise registration request', () => {
      const smd: SignedMarkData = {
        encodedSignedMark: 'base64_encoded_smd_data'
      };

      const request: LaunchCreateRequest = {
        phase: { name: 'sunrise' },
        signedMark: smd
      };

      expect(request.phase.name).toBe('sunrise');
      expect(request.signedMark).toBeDefined();
    });

    test('should create claims registration request', () => {
      const notice: LaunchNotice = {
        noticeID: 'claim-12345',
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:30:00Z'
      };

      const request: LaunchCreateRequest = {
        phase: { name: 'claims' },
        notice: notice
      };

      expect(request.phase.name).toBe('claims');
      expect(request.notice).toBeDefined();
    });

    test('should create landrush registration request', () => {
      const request: LaunchCreateRequest = {
        phase: { name: 'landrush' },
        type: 'application'
      };

      expect(request.phase.name).toBe('landrush');
      expect(request.type).toBe('application');
    });

    test('should support custom phase', () => {
      const request: LaunchCreateRequest = {
        phase: { name: 'custom', subPhase: 'early-access' },
        type: 'registration'
      };

      expect(request.phase.name).toBe('custom');
      expect(request.phase.subPhase).toBe('early-access');
      expect(request.type).toBe('registration');
    });
  });

  describe('LaunchCheckRequest', () => {
    test('should create launch check request', () => {
      const request: LaunchCheckRequest = {
        phase: { name: 'sunrise' },
        type: 'avail'
      };

      expect(request.phase.name).toBe('sunrise');
      expect(request.type).toBe('avail');
    });

    test('should support claims check', () => {
      const request: LaunchCheckRequest = {
        phase: { name: 'claims' },
        type: 'claims'
      };

      expect(request.phase.name).toBe('claims');
      expect(request.type).toBe('claims');
    });
  });

  describe('TradeMark', () => {
    test('should create complete trademark structure', () => {
      const trademark: TradeMark = {
        name: 'Example Trademark',
        id: 'mark-12345',
        issuerInfo: {
          org: 'USPTO',
          cc: 'US'
        },
        number: '1234567',
        regDate: '2020-01-15',
        exDate: '2030-01-15',
        class: [35, 42],
        label: ['example']
      };

      expect(trademark.name).toBe('Example Trademark');
      expect(trademark.id).toBe('mark-12345');
      expect(trademark.issuerInfo?.cc).toBe('US');
      expect(trademark.class).toHaveLength(2);
    });

    test('should allow optional fields', () => {
      const trademark: TradeMark = {
        name: 'Simple Mark'
      };

      expect(trademark.number).toBeUndefined();
      expect(trademark.regDate).toBeUndefined();
      expect(trademark.exDate).toBeUndefined();
    });
  });

  describe('Namespace', () => {
    test('should have correct namespace URI', () => {
      expect(LAUNCH_NAMESPACE).toBe('urn:ietf:params:xml:ns:launch-1.0');
    });
  });
});
