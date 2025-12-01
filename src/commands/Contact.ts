import { XmlBuilder } from '../core/XmlBuilder';
import { ContactCreateRequest, ContactUpdateRequest } from '../types';

export class ContactCommand {
  private xmlBuilder: XmlBuilder;

  constructor() {
    this.xmlBuilder = new XmlBuilder();
  }

  check(ids: string[]): string {
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

  info(id: string): string {
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

  create(data: ContactCreateRequest): string {
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

  update(data: ContactUpdateRequest): string {
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

  delete(id: string): string {
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
}