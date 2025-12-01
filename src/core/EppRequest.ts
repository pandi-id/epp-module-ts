import { XmlBuilder } from './XmlBuilder';
import { SessionOptions } from '../types';

export class EppRequest {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  login(username: string, password: string, options?: SessionOptions): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'login': {
          'clID': username,
          'pw': password,
          'options': {
            'version': options?.version || '1.0',
            'lang': options?.lang || 'en'
          },
          'svcs': {
            'objURI': [
              'urn:ietf:params:xml:ns:domain-1.0',
              'urn:ietf:params:xml:ns:contact-1.0',
              'urn:ietf:params:xml:ns:host-1.0'
            ],
            'svcExtension': {
              'extURI': [
                'urn:ietf:params:xml:ns:fee-0.11'
              ]
            }
          }
        },
        'clTRID': clTRID
      }
    };

    if (options?.newPassword) {
      command.command.login['newPW'] = options.newPassword;
    }

    return this.xmlBuilder.buildEppRequest(command);
  }

  logout(): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'logout': {},
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  contactCheck(ids: string[]): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'check': {
          'contact:check': {
            'contact:id': ids
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  contactInfo(id: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'info': {
          'contact:info': {
            'contact:id': id
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  contactCreate(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'create': {
          'contact:create': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  domainCheck(domains: string[]): string {
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

  domainInfo(domain: string): string {
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

  domainCreate(data: any): string {
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

  hostCheck(names: string[]): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'check': {
          'host:check': {
            'host:name': names
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  hostInfo(name: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'info': {
          'host:info': {
            'host:name': name
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  hostCreate(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'create': {
          'host:create': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  feeCheck(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'check': {
          'fee:check': {
            '$': {
              'xmlns:fee': 'urn:ietf:params:xml:ns:fee-0.11'
            },
            ...data
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }
}