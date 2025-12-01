import { XmlBuilder } from '../core/XmlBuilder';
import { HostCreateRequest, HostUpdateRequest } from '../types';

export class HostCommand {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  check(names: string[]): string {
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

  info(name: string): string {
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

  create(data: HostCreateRequest): string {
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

  update(data: HostUpdateRequest): string {
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

  delete(name: string): string {
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
}