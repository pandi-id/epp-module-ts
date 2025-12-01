import { EppClient } from '../src';
import { EppRequest } from '../src/core/EppRequest';
import * as tls from 'tls';

// Mock tls module
jest.mock('tls');

describe('EppClient', () => {
  let client: EppClient;
  const mockConfig = {
    host: 'epp.test.com',
    port: 700,
    username: 'test-user',
    password: 'test-pass',
    rejectUnauthorized: false // For testing only
  };

  beforeEach(() => {
    client = new EppClient(mockConfig);
  });

  describe('Initialization', () => {
    it('should create instance with config', () => {
      expect(client).toBeInstanceOf(EppClient);
    });

    it('should set default values', () => {
      expect(client['config'].lang).toBe('en');
      expect(client['config'].version).toBe('1.0');
      expect(client['config'].timeout).toBe(30000);
      expect(client['config'].port).toBe(700);
    });
  });

  describe('Connection', () => {
    it('should have isConnected method', () => {
      expect(typeof client.isConnected).toBe('function');
      expect(client.isConnected()).toBe(false);
    });
  });
});

describe('EppRequest', () => {
  let eppRequest: EppRequest;

  beforeEach(() => {
    eppRequest = new EppRequest();
  });

  it('should generate login XML', () => {
    const xml = eppRequest.login('user', 'pass');
    
    expect(xml).toContain('<login>');
    expect(xml).toContain('<clID>user</clID>');
    expect(xml).toContain('<pw>pass</pw>');
    expect(xml).toContain('<clTRID>');
  });

  it('should generate domain check XML', () => {
    const xml = eppRequest.domainCheck(['example.com', 'test.com']);
    
    expect(xml).toContain('<domain:check>');
    expect(xml).toContain('<domain:name>example.com</domain:name>');
    expect(xml).toContain('<domain:name>test.com</domain:name>');
  });
});