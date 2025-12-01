import { EppClient } from '../src';
import { EppRequest } from '../src/core/EppRequest';

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('EppClient', () => {
  let client: EppClient;
  const mockConfig = {
    server: 'https://epp.test.com',
    username: 'test-user',
    password: 'test-pass'
  };

  beforeEach(() => {
    client = new EppClient(mockConfig);
    axios.post.mockClear();
  });

  describe('Initialization', () => {
    it('should create instance with config', () => {
      expect(client).toBeInstanceOf(EppClient);
    });

    it('should set default values', () => {
      expect(client['config'].lang).toBe('en');
      expect(client['config'].version).toBe('1.0');
      expect(client['config'].timeout).toBe(30000);
    });
  });

  describe('Login', () => {
    it('should send login request', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
          <epp xmlns="urn:ietf:params:xml:ns:epp-1.0">
            <response>
              <result code="1000">
                <msg>Command completed successfully</msg>
              </result>
              <trID>
                <clTRID>CLTRID-123</clTRID>
                <svTRID>SVTRID-456</svTRID>
              </trID>
            </response>
          </epp>`
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await client.login();

      expect(axios.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.code).toBe(1000);
    });
  });

  describe('Domain Operations', () => {
    beforeEach(async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
          <epp xmlns="urn:ietf:params:xml:ns:epp-1.0">
            <response>
              <result code="1000">
                <msg>Command completed successfully</msg>
              </result>
              <trID>
                <clTRID>CLTRID-123</clTRID>
                <svTRID>SVTRID-456</svTRID>
              </trID>
            </response>
          </epp>`
      };
      axios.post.mockResolvedValue(mockResponse);
    });

    it('should check domains', async () => {
      const result = await client.domainCheck(['example.com', 'test.com']);
      
      expect(axios.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should get domain info', async () => {
      const result = await client.domainInfo('example.com');
      
      expect(axios.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
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