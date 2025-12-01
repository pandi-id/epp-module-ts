import { parseString } from 'xml2js';

export class XmlParser {
  static parse(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xml, { 
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true 
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  static extractResponseData(parsedXml: any): any {
    const response = parsedXml.epp.response;
    
    if (!response) {
      throw new Error('Invalid EPP response structure');
    }

    const result = {
      code: parseInt(response.result.$.code),
      message: response.result.msg,
      clTRID: response.trID.clTRID,
      svTRID: response.trID.svTRID,
      data: {}
    };

    // Extract data based on response type
    if (response.resData) {
      if (response.resData['contact:infData']) {
        result.data = this.parseContactInfo(response.resData['contact:infData']);
      } else if (response.resData['domain:infData']) {
        result.data = this.parseDomainInfo(response.resData['domain:infData']);
      } else if (response.resData['host:infData']) {
        result.data = this.parseHostInfo(response.resData['host:infData']);
      } else if (response.resData['contact:chkData']) {
        result.data = this.parseContactCheck(response.resData['contact:chkData']);
      } else if (response.resData['domain:chkData']) {
        result.data = this.parseDomainCheck(response.resData['domain:chkData']);
      } else if (response.resData['host:chkData']) {
        result.data = this.parseHostCheck(response.resData['host:chkData']);
      }
    }

    return result;
  }

  private static parseContactInfo(data: any): any {
    // Implementation for parsing contact info
    return data;
  }

  private static parseDomainInfo(data: any): any {
    // Implementation for parsing domain info
    return data;
  }

  private static parseHostInfo(data: any): any {
    // Implementation for parsing host info
    return data;
  }

  private static parseContactCheck(data: any): any {
    return data['contact:cd'].map((cd: any) => ({
      id: cd['contact:id'],
      available: cd['contact:id'].$.avail === '1'
    }));
  }

  private static parseDomainCheck(data: any): any {
    return data['domain:cd'].map((cd: any) => ({
      name: cd['domain:name'],
      available: cd['domain:name'].$.avail === '1'
    }));
  }

  private static parseHostCheck(data: any): any {
    return data['host:cd'].map((cd: any) => ({
      name: cd['host:name'],
      available: cd['host:name'].$.avail === '1'
    }));
  }
}