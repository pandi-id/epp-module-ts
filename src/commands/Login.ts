import { XmlBuilder } from '../core/XmlBuilder';
import { SessionOptions } from '../types';

export class LoginCommand {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  build(username: string, password: string, options?: SessionOptions): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const loginData: any = {
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
      loginData['newPW'] = options.newPassword;
    }

    const command = {
      'command': {
        'login': loginData,
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }
}