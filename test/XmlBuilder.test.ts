/**
 * XML Builder Tests
 * Testing XML generation and structure
 */

import { XmlBuilder } from '../src/core/XmlBuilder';

describe('XmlBuilder', () => {
  let xmlBuilder: XmlBuilder;

  beforeEach(() => {
    xmlBuilder = new XmlBuilder();
  });

  describe('EPP Request Building', () => {
    it('should build EPP request with proper XML structure', () => {
      const command = {
        command: {
          login: {
            clID: 'test',
            pw: 'password'
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<epp');
      expect(xml).toContain('</epp>');
    });

    it('should include all required namespaces', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('xmlns="urn:ietf:params:xml:ns:epp-1.0"');
      expect(xml).toContain('xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"');
      expect(xml).toContain('xmlns:contact="urn:ietf:params:xml:ns:contact-1.0"');
      expect(xml).toContain('xmlns:host="urn:ietf:params:xml:ns:host-1.0"');
      expect(xml).toContain('xmlns:fee="urn:ietf:params:xml:ns:fee-0.11"');
      expect(xml).toContain('xmlns:secDNS="urn:ietf:params:xml:ns:secDNS-1.1"');
    });

    it('should properly nest command structure', () => {
      const command = {
        command: {
          check: {
            'domain:check': {
              'domain:name': 'example.com'
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<command>');
      expect(xml).toContain('<check>');
      expect(xml).toContain('<domain:check>');
      expect(xml).toContain('</domain:check>');
      expect(xml).toContain('</check>');
      expect(xml).toContain('</command>');
    });

    it('should handle attributes correctly', () => {
      const command = {
        command: {
          transfer: {
            $: { op: 'request' },
            'domain:transfer': {
              'domain:name': 'example.com'
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('op="request"');
    });

    it('should handle arrays correctly', () => {
      const command = {
        command: {
          check: {
            'domain:check': {
              'domain:name': ['example.com', 'test.com']
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<domain:name>example.com</domain:name>');
      expect(xml).toContain('<domain:name>test.com</domain:name>');
    });

    it('should handle nested objects', () => {
      const command = {
        command: {
          create: {
            'contact:create': {
              'contact:id': 'CONTACT-001',
              'contact:postalInfo': {
                $: { type: 'int' },
                'contact:name': 'John Doe',
                'contact:addr': {
                  'contact:street': '123 Main St',
                  'contact:city': 'New York'
                }
              }
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<contact:postalInfo type="int">');
      expect(xml).toContain('<contact:name>John Doe</contact:name>');
      expect(xml).toContain('<contact:addr>');
      expect(xml).toContain('</contact:addr>');
    });

    it('should handle extension elements', () => {
      const command = {
        command: {
          create: {
            'domain:create': {
              'domain:name': 'example.com'
            }
          },
          extension: {
            'secDNS:create': {
              'secDNS:maxSigLife': 604800
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<extension>');
      expect(xml).toContain('<secDNS:create>');
      expect(xml).toContain('<secDNS:maxSigLife>604800</secDNS:maxSigLife>');
      expect(xml).toContain('</extension>');
    });
  });

  describe('Transaction ID Generation', () => {
    it('should generate unique transaction IDs', () => {
      const id1 = xmlBuilder.generateClTRID();
      const id2 = xmlBuilder.generateClTRID();

      expect(id1).not.toBe(id2);
    });

    it('should generate transaction IDs with correct format', () => {
      const id = xmlBuilder.generateClTRID();

      expect(id).toMatch(/^CLTRID-\d+-[a-z0-9]+$/);
    });

    it('should include timestamp in transaction ID', () => {
      const beforeTime = Date.now();
      const id = xmlBuilder.generateClTRID();
      const afterTime = Date.now();

      const timestamp = parseInt(id.split('-')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should generate 100 unique transaction IDs', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        ids.add(xmlBuilder.generateClTRID());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('XML Format', () => {
    it('should not include pretty printing', () => {
      const command = {
        command: {
          check: { 'domain:check': { 'domain:name': 'example.com' } },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      // Should not have extra whitespace/newlines for pretty printing
      expect(xml).not.toMatch(/\n\s+</);
    });

    it('should be valid XML', () => {
      const command = {
        command: {
          check: { 'domain:check': { 'domain:name': 'example.com' } },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      // Basic XML validity checks
      expect(xml).toContain('<?xml');
      expect(xml.split('<epp').length).toBe(2); // One opening tag
      expect(xml.split('</epp>').length).toBe(2); // One closing tag
    });

    it('should properly escape special characters', () => {
      const command = {
        command: {
          create: {
            'contact:create': {
              'contact:name': 'John & Jane <Doe>'
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('&amp;'); // & should be escaped
      expect(xml).toContain('&lt;'); // < should be escaped
      expect(xml).toContain('&gt;'); // > should be escaped
    });

    it('should handle empty elements', () => {
      const command = {
        command: {
          logout: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<logout/>');
    });
  });

  describe('RFC Compliance', () => {
    it('should use UTF-8 encoding', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('encoding="UTF-8"');
    });

    it('should use XML version 1.0', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('version="1.0"');
    });

    it('should include EPP-1.0 namespace as default', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('xmlns="urn:ietf:params:xml:ns:epp-1.0"');
    });

    it('should support all object namespaces per RFC', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      // RFC 5731 - Domain
      expect(xml).toContain('xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"');
      
      // RFC 5732 - Host
      expect(xml).toContain('xmlns:host="urn:ietf:params:xml:ns:host-1.0"');
      
      // RFC 5733 - Contact
      expect(xml).toContain('xmlns:contact="urn:ietf:params:xml:ns:contact-1.0"');
    });

    it('should support extension namespaces', () => {
      const command = {
        command: {
          check: {},
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      // RFC 8748 - Fee Extension
      expect(xml).toContain('xmlns:fee="urn:ietf:params:xml:ns:fee-0.11"');
      
      // RFC 5910 - DNSSEC Extension
      expect(xml).toContain('xmlns:secDNS="urn:ietf:params:xml:ns:secDNS-1.1"');
    });
  });

  describe('Complex Structures', () => {
    it('should handle domain create with all options', () => {
      const command = {
        command: {
          create: {
            'domain:create': {
              'domain:name': 'example.com',
              'domain:period': {
                $: { unit: 'y' },
                _: 2
              },
              'domain:ns': {
                'domain:hostObj': ['ns1.example.com', 'ns2.example.com']
              },
              'domain:registrant': 'CONTACT-001',
              'domain:contact': [
                { $: { type: 'admin' }, _: 'CONTACT-002' },
                { $: { type: 'tech' }, _: 'CONTACT-003' }
              ],
              'domain:authInfo': {
                'domain:pw': 'auth-code'
              }
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<domain:name>example.com</domain:name>');
      expect(xml).toContain('unit="y"');
      expect(xml).toContain('ns1.example.com');
      expect(xml).toContain('CONTACT-001');
      expect(xml).toContain('type="admin"');
    });

    it('should handle contact create with postal info', () => {
      const command = {
        command: {
          create: {
            'contact:create': {
              'contact:id': 'CONTACT-001',
              'contact:postalInfo': {
                $: { type: 'int' },
                'contact:name': 'John Doe',
                'contact:addr': {
                  'contact:street': ['123 Main St', 'Suite 100'],
                  'contact:city': 'New York',
                  'contact:sp': 'NY',
                  'contact:pc': '10001',
                  'contact:cc': 'US'
                }
              },
              'contact:voice': '+1.2125551234',
              'contact:email': 'john@example.com'
            }
          },
          clTRID: 'TEST-123'
        }
      };

      const xml = xmlBuilder.buildEppRequest(command);

      expect(xml).toContain('<contact:postalInfo type="int">');
      expect(xml).toContain('<contact:street>123 Main St</contact:street>');
      expect(xml).toContain('<contact:street>Suite 100</contact:street>');
    });
  });
});
