import { XmlBuilder } from '../core/XmlBuilder';
import { FeeCheckRequest } from '../types';

export class FeeCommand {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  check(data: FeeCheckRequest): string {
    const clTRID = this.xmlBuilder.generateClTRID();
    
    const feeData: any = {
      'fee:command': data.command
    };

    if (data.domain) {
      feeData['fee:domain'] = data.domain;
    }

    if (data.period) {
      feeData['fee:period'] = {
        '$': { unit: 'y' },
        '_': data.period.toString()
      };
    }

    if (data.currency) {
      feeData['fee:currency'] = data.currency;
    }

    const command = {
      'command': {
        'check': {
          'fee:check': {
            '$': {
              'xmlns:fee': 'urn:ietf:params:xml:ns:fee-0.11'
            },
            ...feeData
          }
        },
        'clTRID': clTRID
      }
    };

    return this.xmlBuilder.buildEppRequest(command);
  }
}