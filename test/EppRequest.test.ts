/**
 * EPP Request Test Suite
 * Testing all EPP commands according to RFC 5730-5734
 * 
 * This test suite validates XML generation for all EPP operations
 * to ensure RFC compliance.
 */

import { EppRequest } from '../src/core/EppRequest';

describe('EppRequest - RFC Compliance Tests', () => {
  let eppRequest: EppRequest;

  beforeEach(() => {
    eppRequest = new EppRequest();
  });

  /**
   * Session Management Commands (RFC 5730)
   */
  describe('Session Management (RFC 5730)', () => {
    describe('Login Command (RFC 5730 Section 2.9.1.1)', () => {
      it('should generate valid login XML', () => {
        const xml = eppRequest.login('registrar-001', 'password123');
        
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<epp xmlns="urn:ietf:params:xml:ns:epp-1.0"');
        expect(xml).toContain('<login>');
        expect(xml).toContain('<clID>registrar-001</clID>');
        expect(xml).toContain('<pw>password123</pw>');
        expect(xml).toContain('<version>1.0</version>');
        expect(xml).toContain('<lang>en</lang>');
        expect(xml).toContain('<clTRID>');
      });

      it('should include service URIs', () => {
        const xml = eppRequest.login('test', 'pass');
        
        expect(xml).toContain('urn:ietf:params:xml:ns:domain-1.0');
        expect(xml).toContain('urn:ietf:params:xml:ns:contact-1.0');
        expect(xml).toContain('urn:ietf:params:xml:ns:host-1.0');
      });

      it('should include DNSSEC extension URI', () => {
        const xml = eppRequest.login('test', 'pass');
        
        expect(xml).toContain('urn:ietf:params:xml:ns:secDNS-1.1');
      });

      it('should include new password when provided', () => {
        const xml = eppRequest.login('test', 'oldpass', { newPassword: 'newpass' });
        
        expect(xml).toContain('<newPW>newpass</newPW>');
      });

      it('should support custom version and language', () => {
        const xml = eppRequest.login('test', 'pass', { version: '1.0', lang: 'fr' });
        
        expect(xml).toContain('<version>1.0</version>');
        expect(xml).toContain('<lang>fr</lang>');
      });
    });

    describe('Logout Command (RFC 5730 Section 2.9.1.2)', () => {
      it('should generate valid logout XML', () => {
        const xml = eppRequest.logout();
        
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<logout/>');
        expect(xml).toContain('<clTRID>');
      });
    });

    describe('Hello Command (RFC 5730 Section 2.3)', () => {
      it('should generate valid hello XML', () => {
        const xml = eppRequest.hello();
        
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<hello/>');
      });
    });

    describe('Poll Command (RFC 5730 Section 2.9.2.3)', () => {
      it('should generate poll request XML', () => {
        const xml = eppRequest.poll('req');
        
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<poll op="req"/>');
        expect(xml).toContain('<clTRID>');
      });

      it('should generate poll ack XML with msgID', () => {
        const xml = eppRequest.poll('ack', '12345');
        
        expect(xml).toContain('<poll op="ack" msgID="12345"/>');
        expect(xml).toContain('<clTRID>');
      });

      it('should include command structure', () => {
        const xml = eppRequest.poll('req');
        
        expect(xml).toContain('<command>');
        expect(xml).toContain('<poll');
        expect(xml).toContain('</command>');
      });
    });
  });

  /**
   * Domain Commands (RFC 5731)
   */
  describe('Domain Commands (RFC 5731)', () => {
    describe('Domain Check (RFC 5731 Section 3.1.1)', () => {
      it('should generate valid domain check XML for single domain', () => {
        const xml = eppRequest.domainCheck(['example.com']);
        
        expect(xml).toContain('<domain:check');
        expect(xml).toContain('<domain:name>example.com</domain:name>');
        expect(xml).toContain('xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"');
      });

      it('should support multiple domains in bulk check', () => {
        const xml = eppRequest.domainCheck(['example.com', 'test.com', 'demo.net']);
        
        expect(xml).toContain('<domain:name>example.com</domain:name>');
        expect(xml).toContain('<domain:name>test.com</domain:name>');
        expect(xml).toContain('<domain:name>demo.net</domain:name>');
      });
    });

    describe('Domain Info (RFC 5731 Section 3.1.2)', () => {
      it('should generate valid domain info XML', () => {
        const xml = eppRequest.domainInfo('example.com');
        
        expect(xml).toContain('<domain:info');
        expect(xml).toContain('<domain:name>example.com</domain:name>');
      });

      it('should include authInfo when provided', () => {
        const xml = eppRequest.domainInfo('example.com', { pw: 'auth-code-123' });
        
        expect(xml).toContain('<domain:authInfo>');
        expect(xml).toContain('<domain:pw>auth-code-123</domain:pw>');
      });
    });

    describe('Domain Create (RFC 5731 Section 3.2.1)', () => {
      const createData = {
        name: 'example.com',
        period: { value: 1, unit: 'y' },
        registrant: 'CONTACT-001',
        contacts: [
          { type: 'admin', id: 'CONTACT-002' },
          { type: 'tech', id: 'CONTACT-003' }
        ],
        ns: {
          hostObj: ['ns1.example.com', 'ns2.example.com']
        },
        authInfo: { pw: 'auth-code-2024' }
      };

      it('should generate valid domain create XML', () => {
        const xml = eppRequest.domainCreate(createData);
        
        expect(xml).toContain('<domain:create');
        expect(xml).toContain('<name>example.com</name>');
        expect(xml).toContain('<registrant>CONTACT-001</registrant>');
      });

      it('should include period with correct unit', () => {
        const xml = eppRequest.domainCreate(createData);
        
        expect(xml).toContain('<unit>y</unit>');
        expect(xml).toContain('<value>1</value>');
      });

      it('should include contacts', () => {
        const xml = eppRequest.domainCreate(createData);
        
        expect(xml).toContain('<type>admin</type>');
        expect(xml).toContain('CONTACT-002');
        expect(xml).toContain('<type>tech</type>');
        expect(xml).toContain('CONTACT-003');
      });

      it('should include nameservers', () => {
        const xml = eppRequest.domainCreate(createData);
        
        expect(xml).toContain('ns1.example.com');
        expect(xml).toContain('ns2.example.com');
        expect(xml).toContain('<hostObj>');
      });

      it('should include authInfo', () => {
        const xml = eppRequest.domainCreate(createData);
        
        expect(xml).toContain('<authInfo>');
        expect(xml).toContain('<pw>auth-code-2024</pw>');
      });

      it('should support DNSSEC extension (RFC 5910)', () => {
        const dataWithDnssec = {
          ...createData,
          dnssec: {
            maxSigLife: 604800,
            dsData: [{
              keyTag: 12345,
              alg: 8,
              digestType: 2,
              digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
            }]
          }
        };

        const xml = eppRequest.domainCreate(dataWithDnssec);
        
        expect(xml).toContain('<extension>');
        expect(xml).toContain('<secDNS:create>');
        expect(xml).toContain('<secDNS:maxSigLife>604800</secDNS:maxSigLife>');
        expect(xml).toContain('<secDNS:keyTag>12345</secDNS:keyTag>');
        expect(xml).toContain('<secDNS:alg>8</secDNS:alg>');
      });
    });

    describe('Domain Update (RFC 5731 Section 3.2.5)', () => {
      it('should generate valid domain update XML with add operation', () => {
        const updateData = {
          name: 'example.com',
          add: {
            ns: { hostObj: ['ns3.example.com'] },
            contacts: [{ type: 'tech', id: 'CONTACT-004' }],
            status: ['clientHold']
          }
        };

        const xml = eppRequest.domainUpdate(updateData);
        
        expect(xml).toContain('<domain:update');
        expect(xml).toContain('<name>example.com</name>');
        expect(xml).toContain('<add>');
        expect(xml).toContain('ns3.example.com');
      });

      it('should support remove operation', () => {
        const updateData = {
          name: 'example.com',
          rem: {
            contacts: [{ type: 'tech', id: 'CONTACT-003' }],
            status: ['clientHold']
          }
        };

        const xml = eppRequest.domainUpdate(updateData);
        
        expect(xml).toContain('<rem>');
        expect(xml).toContain('CONTACT-003');
      });

      it('should support change operation', () => {
        const updateData = {
          name: 'example.com',
          chg: {
            registrant: 'CONTACT-NEW',
            authInfo: { pw: 'new-auth-code' }
          }
        };

        const xml = eppRequest.domainUpdate(updateData);
        
        expect(xml).toContain('<chg>');
        expect(xml).toContain('<registrant>CONTACT-NEW</registrant>');
        expect(xml).toContain('new-auth-code');
      });

      it('should support DNSSEC update extension', () => {
        const updateData = {
          name: 'example.com',
          dnssec: {
            add: {
              dsData: [{
                keyTag: 54321,
                alg: 13,
                digestType: 4,
                digest: '2BB183AF5F22588179A53B0A98631FAD1A292118'
              }]
            }
          }
        };

        const xml = eppRequest.domainUpdate(updateData);
        
        expect(xml).toContain('<extension>');
        expect(xml).toContain('<secDNS:update>');
        expect(xml).toContain('<secDNS:add>');
      });

      it('should support DNSSEC remove all operation', () => {
        const updateData = {
          name: 'example.com',
          dnssec: {
            rem: { all: true }
          }
        };

        const xml = eppRequest.domainUpdate(updateData);
        
        expect(xml).toContain('<secDNS:rem>');
        expect(xml).toContain('<secDNS:all>true</secDNS:all>');
      });
    });

    describe('Domain Renew (RFC 5731 Section 3.2.3)', () => {
      it('should generate valid domain renew XML', () => {
        const renewData = {
          name: 'example.com',
          curExpDate: '2024-12-01',
          period: { value: 1, unit: 'y' }
        };

        const xml = eppRequest.domainRenew(renewData);
        
        expect(xml).toContain('<domain:renew');
        expect(xml).toContain('<name>example.com</name>');
        expect(xml).toContain('<curExpDate>2024-12-01</curExpDate>');
        expect(xml).toContain('<unit>y</unit>');
        expect(xml).toContain('<value>1</value>');
      });
    });

    describe('Domain Delete (RFC 5731 Section 3.2.2)', () => {
      it('should generate valid domain delete XML', () => {
        const xml = eppRequest.domainDelete('example.com');
        
        expect(xml).toContain('<domain:delete');
        expect(xml).toContain('<domain:name>example.com</domain:name>');
      });
    });

    describe('Domain Transfer (RFC 5731 Section 3.2.4)', () => {
      it('should generate transfer request XML', () => {
        const transferData = {
          name: 'example.com',
          op: 'request',
          authInfo: { pw: 'transfer-auth-code' },
          period: { value: 1, unit: 'y' }
        };

        const xml = eppRequest.domainTransfer(transferData);
        
        expect(xml).toContain('<transfer op="request">');
        expect(xml).toContain('<domain:name>example.com</domain:name>');
        expect(xml).toContain('transfer-auth-code');
      });

      it('should support transfer query', () => {
        const xml = eppRequest.domainTransfer({ name: 'example.com', op: 'query' });
        
        expect(xml).toContain('<transfer op="query">');
      });

      it('should support transfer approve', () => {
        const xml = eppRequest.domainTransfer({ name: 'example.com', op: 'approve' });
        
        expect(xml).toContain('<transfer op="approve">');
      });

      it('should support transfer reject', () => {
        const xml = eppRequest.domainTransfer({ name: 'example.com', op: 'reject' });
        
        expect(xml).toContain('<transfer op="reject">');
      });

      it('should support transfer cancel', () => {
        const xml = eppRequest.domainTransfer({ name: 'example.com', op: 'cancel' });
        
        expect(xml).toContain('<transfer op="cancel">');
      });
    });
  });

  /**
   * Contact Commands (RFC 5733)
   */
  describe('Contact Commands (RFC 5733)', () => {
    describe('Contact Check (RFC 5733 Section 3.1.1)', () => {
      it('should generate valid contact check XML', () => {
        const xml = eppRequest.contactCheck(['CONTACT-001', 'CONTACT-002']);
        
        expect(xml).toContain('<contact:check');
        expect(xml).toContain('<contact:id>CONTACT-001</contact:id>');
        expect(xml).toContain('<contact:id>CONTACT-002</contact:id>');
      });
    });

    describe('Contact Info (RFC 5733 Section 3.1.2)', () => {
      it('should generate valid contact info XML', () => {
        const xml = eppRequest.contactInfo('CONTACT-001');
        
        expect(xml).toContain('<contact:info');
        expect(xml).toContain('<contact:id>CONTACT-001</contact:id>');
      });

      it('should include authInfo when provided', () => {
        const xml = eppRequest.contactInfo('CONTACT-001', { pw: 'auth-code' });
        
        expect(xml).toContain('<contact:authInfo>');
        expect(xml).toContain('<contact:pw>auth-code</contact:pw>');
      });
    });

    describe('Contact Create (RFC 5733 Section 3.2.1)', () => {
      const contactData = {
        id: 'CONTACT-001',
        postalInfo: {
          type: 'int',
          name: 'John Doe',
          org: 'Example Inc',
          addr: {
            street: ['123 Example St', 'Suite 100'],
            city: 'New York',
            sp: 'NY',
            pc: '10001',
            cc: 'US'
          }
        },
        voice: '+1.2125551234',
        fax: '+1.2125551235',
        email: 'john.doe@example.com',
        authInfo: { pw: 'contact-auth-2024' }
      };

      it('should generate valid contact create XML', () => {
        const xml = eppRequest.contactCreate(contactData);
        
        expect(xml).toContain('<contact:create');
        expect(xml).toContain('<id>CONTACT-001</id>');
        expect(xml).toContain('<postalInfo>');
        expect(xml).toContain('<type>int</type>');
        expect(xml).toContain('<name>John Doe</name>');
        expect(xml).toContain('<org>Example Inc</org>');
      });

      it('should include address information', () => {
        const xml = eppRequest.contactCreate(contactData);
        
        expect(xml).toContain('<street>123 Example St</street>');
        expect(xml).toContain('<street>Suite 100</street>');
        expect(xml).toContain('<city>New York</city>');
        expect(xml).toContain('<sp>NY</sp>');
        expect(xml).toContain('<pc>10001</pc>');
        expect(xml).toContain('<cc>US</cc>');
      });

      it('should include contact details', () => {
        const xml = eppRequest.contactCreate(contactData);
        
        expect(xml).toContain('<voice>+1.2125551234</voice>');
        expect(xml).toContain('<fax>+1.2125551235</fax>');
        expect(xml).toContain('<email>john.doe@example.com</email>');
      });

      it('should support localized postal info', () => {
        const localizedContact = {
          ...contactData,
          postalInfo: {
            type: 'loc',
            name: 'ジョン・ドウ',
            addr: {
              street: ['東京都渋谷区'],
              city: '渋谷',
              pc: '150-0001',
              cc: 'JP'
            }
          }
        };

        const xml = eppRequest.contactCreate(localizedContact);
        
        expect(xml).toContain('<type>loc</type>');
        expect(xml).toContain('ジョン・ドウ');
      });
    });

    describe('Contact Update (RFC 5733 Section 3.2.5)', () => {
      it('should generate valid contact update XML', () => {
        const updateData = {
          id: 'CONTACT-001',
          chg: {
            postalInfo: {
              type: 'int',
              name: 'Jane Doe',
              addr: {
                street: ['456 New St'],
                city: 'Boston',
                sp: 'MA',
                pc: '02101',
                cc: 'US'
              }
            },
            email: 'jane.doe@example.com'
          }
        };

        const xml = eppRequest.contactUpdate(updateData);
        
        expect(xml).toContain('<contact:update');
        expect(xml).toContain('<id>CONTACT-001</id>');
        expect(xml).toContain('<chg>');
        expect(xml).toContain('Jane Doe');
      });

      it('should support status changes', () => {
        const updateData = {
          id: 'CONTACT-001',
          add: {
            status: ['clientDeleteProhibited', 'clientTransferProhibited']
          }
        };

        const xml = eppRequest.contactUpdate(updateData);
        
        expect(xml).toContain('<add>');
        expect(xml).toContain('clientDeleteProhibited');
        expect(xml).toContain('clientTransferProhibited');
      });
    });

    describe('Contact Delete (RFC 5733 Section 3.2.2)', () => {
      it('should generate valid contact delete XML', () => {
        const xml = eppRequest.contactDelete('CONTACT-001');
        
        expect(xml).toContain('<contact:delete');
        expect(xml).toContain('<contact:id>CONTACT-001</contact:id>');
      });
    });

    describe('Contact Transfer (RFC 5733 Section 3.2.4)', () => {
      it('should generate contact transfer request XML', () => {
        const transferData = {
          id: 'CONTACT-001',
          op: 'request',
          authInfo: { pw: 'contact-transfer-auth' }
        };

        const xml = eppRequest.contactTransfer(transferData);
        
        expect(xml).toContain('<transfer op="request">');
        expect(xml).toContain('<contact:id>CONTACT-001</contact:id>');
        expect(xml).toContain('contact-transfer-auth');
      });
    });
  });

  /**
   * Host Commands (RFC 5732)
   */
  describe('Host Commands (RFC 5732)', () => {
    describe('Host Check (RFC 5732 Section 3.1.1)', () => {
      it('should generate valid host check XML', () => {
        const xml = eppRequest.hostCheck(['ns1.example.com', 'ns2.example.com']);
        
        expect(xml).toContain('<host:check');
        expect(xml).toContain('<host:name>ns1.example.com</host:name>');
        expect(xml).toContain('<host:name>ns2.example.com</host:name>');
      });
    });

    describe('Host Info (RFC 5732 Section 3.1.2)', () => {
      it('should generate valid host info XML', () => {
        const xml = eppRequest.hostInfo('ns1.example.com');
        
        expect(xml).toContain('<host:info');
        expect(xml).toContain('<host:name>ns1.example.com</host:name>');
      });
    });

    describe('Host Create (RFC 5732 Section 3.2.1)', () => {
      it('should generate valid host create XML with IPv4', () => {
        const hostData = {
          name: 'ns1.example.com',
          addr: [
            { ip: '192.0.2.1', type: 'v4' }
          ]
        };

        const xml = eppRequest.hostCreate(hostData);
        
        expect(xml).toContain('<host:create');
        expect(xml).toContain('<name>ns1.example.com</name>');
        expect(xml).toContain('<addr>');
        expect(xml).toContain('<ip>192.0.2.1</ip>');
        expect(xml).toContain('<type>v4</type>');
      });

      it('should support IPv6 addresses', () => {
        const hostData = {
          name: 'ns1.example.com',
          addr: [
            { ip: '2001:db8::1', type: 'v6' }
          ]
        };

        const xml = eppRequest.hostCreate(hostData);
        
        expect(xml).toContain('<type>v6</type>');
        expect(xml).toContain('2001:db8::1');
      });

      it('should support multiple IP addresses', () => {
        const hostData = {
          name: 'ns1.example.com',
          addr: [
            { ip: '192.0.2.1', type: 'v4' },
            { ip: '192.0.2.2', type: 'v4' },
            { ip: '2001:db8::1', type: 'v6' }
          ]
        };

        const xml = eppRequest.hostCreate(hostData);
        
        expect(xml).toContain('192.0.2.1');
        expect(xml).toContain('192.0.2.2');
        expect(xml).toContain('2001:db8::1');
      });

      it('should support external hosts without IP addresses', () => {
        const hostData = {
          name: 'ns1.otherdomain.com'
        };

        const xml = eppRequest.hostCreate(hostData);
        
        expect(xml).toContain('<name>ns1.otherdomain.com</name>');
        expect(xml).not.toContain('<addr');
      });
    });

    describe('Host Update (RFC 5732 Section 3.2.5)', () => {
      it('should generate valid host update XML', () => {
        const updateData = {
          name: 'ns1.example.com',
          add: {
            addr: [{ ip: '192.0.2.3', type: 'v4' }],
            status: ['clientUpdateProhibited']
          }
        };

        const xml = eppRequest.hostUpdate(updateData);
        
        expect(xml).toContain('<host:update');
        expect(xml).toContain('<name>ns1.example.com</name>');
        expect(xml).toContain('<add>');
        expect(xml).toContain('192.0.2.3');
      });

      it('should support IP address removal', () => {
        const updateData = {
          name: 'ns1.example.com',
          rem: {
            addr: [{ ip: '192.0.2.1', type: 'v4' }]
          }
        };

        const xml = eppRequest.hostUpdate(updateData);
        
        expect(xml).toContain('<rem>');
        expect(xml).toContain('192.0.2.1');
      });

      it('should support name changes', () => {
        const updateData = {
          name: 'ns1.example.com',
          chg: {
            name: 'ns2.example.com'
          }
        };

        const xml = eppRequest.hostUpdate(updateData);
        
        expect(xml).toContain('<chg>');
        expect(xml).toContain('ns2.example.com');
      });
    });

    describe('Host Delete (RFC 5732 Section 3.2.2)', () => {
      it('should generate valid host delete XML', () => {
        const xml = eppRequest.hostDelete('ns1.example.com');
        
        expect(xml).toContain('<host:delete');
        expect(xml).toContain('<host:name>ns1.example.com</host:name>');
      });
    });
  });

  /**
   * XML Structure Tests
   */
  describe('XML Structure Validation', () => {
    it('should include XML declaration in all commands', () => {
      const commands = [
        eppRequest.login('user', 'pass'),
        eppRequest.logout(),
        eppRequest.domainCheck(['example.com']),
        eppRequest.contactCheck(['CONTACT-001']),
        eppRequest.hostCheck(['ns1.example.com'])
      ];

      commands.forEach(xml => {
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      });
    });

    it('should include EPP namespace in all commands', () => {
      const commands = [
        eppRequest.domainCheck(['example.com']),
        eppRequest.contactCreate({ id: 'C1', email: 'test@test.com' }),
        eppRequest.hostInfo('ns1.example.com')
      ];

      commands.forEach(xml => {
        expect(xml).toContain('xmlns="urn:ietf:params:xml:ns:epp-1.0"');
      });
    });

    it('should include client transaction ID in all commands', () => {
      const commands = [
        eppRequest.login('user', 'pass'),
        eppRequest.domainCheck(['example.com']),
        eppRequest.contactInfo('CONTACT-001'),
        eppRequest.hostDelete('ns1.example.com')
      ];

      commands.forEach(xml => {
        expect(xml).toContain('<clTRID>');
        expect(xml).toMatch(/<clTRID>CLTRID-\d+-[a-z0-9]+<\/clTRID>/);
      });
    });

    it('should generate unique transaction IDs', () => {
      const xml1 = eppRequest.domainCheck(['example.com']);
      const xml2 = eppRequest.domainCheck(['example.com']);
      
      const clTRID1 = xml1.match(/<clTRID>(.*?)<\/clTRID>/)?.[1];
      const clTRID2 = xml2.match(/<clTRID>(.*?)<\/clTRID>/)?.[1];
      
      expect(clTRID1).not.toBe(clTRID2);
    });

    it('should properly format namespaces', () => {
      const xml = eppRequest.domainCreate({
        name: 'example.com',
        period: { value: 1, unit: 'y' },
        registrant: 'C1',
        authInfo: { pw: 'auth' }
      });
      
      expect(xml).toContain('xmlns:domain="urn:ietf:params:xml:ns:domain-1.0"');
      expect(xml).toContain('xmlns:contact="urn:ietf:params:xml:ns:contact-1.0"');
      expect(xml).toContain('xmlns:host="urn:ietf:params:xml:ns:host-1.0"');
    });

    it('should include DNSSEC namespace', () => {
      const xml = eppRequest.login('user', 'pass');
      
      expect(xml).toContain('xmlns:secDNS="urn:ietf:params:xml:ns:secDNS-1.1"');
    });
  });
});
