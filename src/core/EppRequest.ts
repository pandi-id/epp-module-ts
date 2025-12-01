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
            'urn:ietf:params:xml:ns:fee-0.11',
            'urn:ietf:params:xml:ns:secDNS-1.1'
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

  hello(): string {
    const helloObject = {
      'epp': {
        '$': {
          'xmlns': 'urn:ietf:params:xml:ns:epp-1.0'
        },
        'hello': {}
      }
    };

    return this.xmlBuilder['builder'].buildObject(helloObject);
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
    
    const command: any = {
      'command': {
        'create': {
          'domain:create': data
        },
        'clTRID': clTRID
      }
    };

    // Add DNSSEC extension if present
    if (data.dnssec) {
      const dnssecExt = this.buildDnssecExtension(data.dnssec);
      if (dnssecExt) {
        command.command['extension'] = dnssecExt;
      }
    }

    return this.xmlBuilder.buildEppRequest(command);
  }

  domainUpdate(data: any): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const command: any = {
      'command': {
        'update': {
          'domain:update': data
        },
        'clTRID': clTRID
      }
    };

    // Add DNSSEC extension if present
    if (data.dnssec) {
      const dnssecExt = this.buildDnssecUpdateExtension(data.dnssec);
      if (dnssecExt) {
        command.command['extension'] = dnssecExt;
      }
    }

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

  /**
   * Build DNSSEC extension for create/update commands (RFC 5910)
   * @private
   */
  private buildDnssecExtension(dnssec: any): any {
    if (!dnssec) return null;

    const secDNS: any = {};

    // For domain create
    if (dnssec.maxSigLife !== undefined) {
      secDNS['secDNS:maxSigLife'] = dnssec.maxSigLife;
    }

    // DS Data
    if (dnssec.dsData && dnssec.dsData.length > 0) {
      secDNS['secDNS:dsData'] = dnssec.dsData.map((ds: any) => {
        const dsItem: any = {
          'secDNS:keyTag': ds.keyTag,
          'secDNS:alg': ds.alg,
          'secDNS:digestType': ds.digestType,
          'secDNS:digest': ds.digest
        };

        // DS Data may include key data
        if (ds.keyData) {
          dsItem['secDNS:keyData'] = {
            'secDNS:flags': ds.keyData.flags,
            'secDNS:protocol': ds.keyData.protocol,
            'secDNS:alg': ds.keyData.alg,
            'secDNS:pubKey': ds.keyData.pubKey
          };
        }

        return dsItem;
      });
    }

    // Key Data (standalone)
    if (dnssec.keyData && dnssec.keyData.length > 0) {
      secDNS['secDNS:keyData'] = dnssec.keyData.map((key: any) => ({
        'secDNS:flags': key.flags,
        'secDNS:protocol': key.protocol,
        'secDNS:alg': key.alg,
        'secDNS:pubKey': key.pubKey
      }));
    }

    return {
      'secDNS:create': secDNS
    };
  }

  /**
   * Build DNSSEC update extension (RFC 5910)
   * @private
   */
  private buildDnssecUpdateExtension(dnssec: any): any {
    if (!dnssec) return null;

    const secDNSUpdate: any = {};

    // Urgent flag
    if (dnssec.urgent !== undefined) {
      secDNSUpdate['$'] = { urgent: dnssec.urgent };
    }

    // Add DS/Key data
    if (dnssec.add) {
      const addData: any = {};
      
      if (dnssec.add.dsData && dnssec.add.dsData.length > 0) {
        addData['secDNS:dsData'] = dnssec.add.dsData.map((ds: any) => ({
          'secDNS:keyTag': ds.keyTag,
          'secDNS:alg': ds.alg,
          'secDNS:digestType': ds.digestType,
          'secDNS:digest': ds.digest
        }));
      }

      if (dnssec.add.keyData && dnssec.add.keyData.length > 0) {
        addData['secDNS:keyData'] = dnssec.add.keyData.map((key: any) => ({
          'secDNS:flags': key.flags,
          'secDNS:protocol': key.protocol,
          'secDNS:alg': key.alg,
          'secDNS:pubKey': key.pubKey
        }));
      }

      if (dnssec.add.maxSigLife !== undefined) {
        addData['secDNS:maxSigLife'] = dnssec.add.maxSigLife;
      }

      if (Object.keys(addData).length > 0) {
        secDNSUpdate['secDNS:add'] = addData;
      }
    }

    // Remove DS/Key data
    if (dnssec.rem) {
      const remData: any = {};

      // Remove all DNSSEC data
      if (dnssec.rem.all) {
        remData['secDNS:all'] = 'true';
      } else {
        if (dnssec.rem.dsData && dnssec.rem.dsData.length > 0) {
          remData['secDNS:dsData'] = dnssec.rem.dsData.map((ds: any) => ({
            'secDNS:keyTag': ds.keyTag,
            'secDNS:alg': ds.alg,
            'secDNS:digestType': ds.digestType,
            'secDNS:digest': ds.digest
          }));
        }

        if (dnssec.rem.keyData && dnssec.rem.keyData.length > 0) {
          remData['secDNS:keyData'] = dnssec.rem.keyData.map((key: any) => ({
            'secDNS:flags': key.flags,
            'secDNS:protocol': key.protocol,
            'secDNS:alg': key.alg,
            'secDNS:pubKey': key.pubKey
          }));
        }
      }

      if (Object.keys(remData).length > 0) {
        secDNSUpdate['secDNS:rem'] = remData;
      }
    }

    // Change maxSigLife
    if (dnssec.chg && dnssec.chg.maxSigLife !== undefined) {
      secDNSUpdate['secDNS:chg'] = {
        'secDNS:maxSigLife': dnssec.chg.maxSigLife
      };
    }

    return {
      'secDNS:update': secDNSUpdate
    };
  }
}