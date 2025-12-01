import { XmlBuilder } from '../core/XmlBuilder';
import { DomainCreateRequest, DomainUpdateRequest } from '../types';

export class DomainCommand {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  check(domains: string[]): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'check': {
          'domain:check': {
            'domain:name': domains
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  info(domain: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'info': {
          'domain:info': {
            'domain:name': domain
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  create(data: DomainCreateRequest): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'create': {
          'domain:create': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  update(data: DomainUpdateRequest): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'update': {
          'domain:update': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  renew(domain: string, curExpDate: string, period: number): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'renew': {
          'domain:renew': {
            'domain:name': domain,
            'domain:curExpDate': curExpDate,
            'domain:period': {
              '$': { unit: 'y' },
              '_': period.toString()
            }
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  delete(domain: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'delete': {
          'domain:delete': {
            'domain:name': domain
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }
}