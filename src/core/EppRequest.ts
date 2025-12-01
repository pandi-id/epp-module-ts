import { XmlBuilder } from './XmlBuilder';
import { SessionOptions } from '../types';

export class EppRequest {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  login(username: string, password: string, options?: SessionOptions): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const loginCmd: any = {
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
    };

    if (options?.newPassword) {
      loginCmd['newPW'] = options.newPassword;
    }

    const command = {
      'command': {
        'login': loginCmd,
        'clTRID': clTRID
      }
    };

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

  contactInfo(id: string, authInfo?: { pw: string }): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const contactInfo: any = {
      'contact:id': id
    };

    if (authInfo) {
      contactInfo['contact:authInfo'] = {
        'contact:pw': authInfo.pw
      };
    }

    const command = {
      'command': {
        'info': {
          'contact:info': contactInfo
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

  contactUpdate(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'update': {
          'contact:update': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  contactDelete(id: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'delete': {
          'contact:delete': {
            'contact:id': id
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  contactTransfer(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'transfer': {
          '$': { 'op': data.op || 'request' },
          'contact:transfer': {
            'contact:id': data.id,
            ...(data.authInfo && {
              'contact:authInfo': {
                'contact:pw': data.authInfo.pw
              }
            })
          }
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

  domainInfo(domain: string, authInfo?: { pw: string }): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const domainInfo: any = {
      'domain:name': domain
    };

    if (authInfo) {
      domainInfo['domain:authInfo'] = {
        'domain:pw': authInfo.pw
      };
    }

    const command = {
      'command': {
        'info': {
          'domain:info': domainInfo
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

  domainUpdate(data: any): string {
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

  domainRenew(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'renew': {
          'domain:renew': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  domainDelete(domain: string): string {
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

  domainTransfer(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'transfer': {
          '$': { 'op': data.op || 'request' },
          'domain:transfer': {
            'domain:name': data.name,
            ...(data.period && {
              'domain:period': {
                '$': { 'unit': data.period.unit || 'y' },
                '_': data.period.value
              }
            }),
            ...(data.authInfo && {
              'domain:authInfo': {
                'domain:pw': data.authInfo.pw
              }
            })
          }
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

  hostUpdate(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'update': {
          'host:update': data
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }

  hostDelete(name: string): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command = {
      'command': {
        'delete': {
          'host:delete': {
            'host:name': name
          }
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