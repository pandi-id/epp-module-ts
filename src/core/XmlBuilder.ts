import { Builder } from 'xml2js';

export class XmlBuilder {
  private builder: Builder;

  constructor() {
    this.builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: false },
    });
  }

  buildEppRequest(command: any): string {
    const eppObject = {
      'epp': {
        '$': {
          'xmlns': 'urn:ietf:params:xml:ns:epp-1.0',
          'xmlns:domain': 'urn:ietf:params:xml:ns:domain-1.0',
          'xmlns:contact': 'urn:ietf:params:xml:ns:contact-1.0',
          'xmlns:host': 'urn:ietf:params:xml:ns:host-1.0',
          'xmlns:fee': 'urn:ietf:params:xml:ns:fee-0.11',
        },
        ...command
      }
    };

    return this.builder.buildObject(eppObject);
  }

  generateClTRID(): string {
    return `CLTRID-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}