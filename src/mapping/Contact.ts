import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { StatusInput, TransferStatus } from '../types/Common';
import type {
  ContactAddress,
  ContactCheckResult,
  ContactCreateRequest,
  ContactCreateResult,
  ContactDisclose,
  ContactDiscloseInfo,
  ContactInfo,
  ContactInfoOptions,
  ContactPhone,
  ContactPostalInfo,
  ContactPostalInfoChange,
  ContactTransferRequest,
  ContactTransferResult,
  ContactUpdateRequest,
  DiscloseTypes,
  PostalInfoType,
} from '../types/Contact';
import { parseBoolean, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { asArray, authInfoElement, CommandParts, parseStatuses, requireNonEmpty, setIfDefined, statusElement, toAuthInfo } from './Shared';

const C = NS.contact;
const TRANSFER_OPS = ['request', 'query', 'approve', 'reject', 'cancel'];

/** Contact check (RFC 5733 Section 3.1.1). */
export function buildContactCheck(ids: string[], extensions: XmlElement[] = []): CommandParts {
  requireNonEmpty(ids, 'contact ID');
  return {
    command: el('check', null, el('contact:check', { 'xmlns:contact': C }, ids.map((id) => el('contact:id', null, id)))),
    extensions,
  };
}

/** Contact info (RFC 5733 Section 3.1.2). */
export function buildContactInfo(id: string, options: ContactInfoOptions = {}): CommandParts {
  return {
    command: el(
      'info',
      null,
      el('contact:info', { 'xmlns:contact': C }, [el('contact:id', null, id), authInfoElement('contact', toAuthInfo(options.authInfo))]),
    ),
    extensions: options.extensions ?? [],
  };
}

/** Contact create (RFC 5733 Section 3.2.1). */
export function buildContactCreate(request: ContactCreateRequest): CommandParts {
  if (!request.authInfo) throw new EppValidationError('authInfo is required to create a contact (RFC 5733 Section 3.2.1)');
  const postalInfo = postalInfoList(asArray(request.postalInfo), 1);
  return {
    command: el(
      'create',
      null,
      el('contact:create', { 'xmlns:contact': C }, [
        el('contact:id', null, request.id),
        postalInfo.map((info) => postalInfoElement(info)),
        phoneElement('contact:voice', request.voice),
        phoneElement('contact:fax', request.fax),
        el('contact:email', null, request.email),
        authInfoElement('contact', request.authInfo),
        discloseElement(request.disclose),
      ]),
    ),
    extensions: request.extensions ?? [],
  };
}

/** Contact delete (RFC 5733 Section 3.2.2). */
export function buildContactDelete(id: string, extensions: XmlElement[] = []): CommandParts {
  return {
    command: el('delete', null, el('contact:delete', { 'xmlns:contact': C }, el('contact:id', null, id))),
    extensions,
  };
}

/** Contact transfer (RFC 5733 Section 3.2.4). */
export function buildContactTransfer(request: ContactTransferRequest): CommandParts {
  if (!TRANSFER_OPS.includes(request.op)) {
    throw new EppValidationError(`Transfer op must be one of ${TRANSFER_OPS.join(', ')}, got ${JSON.stringify(request.op)}`);
  }
  return {
    command: el(
      'transfer',
      { op: request.op },
      el('contact:transfer', { 'xmlns:contact': C }, [el('contact:id', null, request.id), authInfoElement('contact', request.authInfo)]),
    ),
    extensions: request.extensions ?? [],
  };
}

/** Contact update (RFC 5733 Section 3.2.5). */
export function buildContactUpdate(request: ContactUpdateRequest): CommandParts {
  const add = statusListElement('contact:add', request.add?.status);
  const rem = statusListElement('contact:rem', request.rem?.status);
  let chg: XmlElement | undefined;
  if (request.chg) {
    const change = request.chg;
    const children = [
      ...postalInfoList(asArray(change.postalInfo), 0).map((info) => postalInfoElement(info)),
      phoneElement('contact:voice', change.voice),
      phoneElement('contact:fax', change.fax),
      change.email !== undefined ? el('contact:email', null, change.email) : undefined,
      authInfoElement('contact', change.authInfo),
      discloseElement(change.disclose),
    ].filter((child): child is XmlElement => child !== undefined);
    if (children.length > 0) chg = el('contact:chg', null, children);
  }
  const extensions = request.extensions ?? [];
  if (!add && !rem && !chg && extensions.length === 0) {
    throw new EppValidationError('A contact update needs add, rem or chg (RFC 5733 Section 3.2.5)');
  }
  return {
    command: el('update', null, el('contact:update', { 'xmlns:contact': C }, [el('contact:id', null, request.id), add, rem, chg])),
    extensions,
  };
}

/** `<contact:chkData>`. */
export function parseContactCheck(node: XmlNode): ContactCheckResult[] {
  return node.all(C, 'cd').map((cd) => {
    const id = cd.child(C, 'id');
    const result: ContactCheckResult = { id: id?.text ?? '', available: parseBoolean(id?.attr('avail')) ?? false };
    setIfDefined(result, 'reason', cd.childText(C, 'reason'));
    return result;
  });
}

/** `<contact:infData>`. */
export function parseContactInfo(node: XmlNode): ContactInfo {
  const info: ContactInfo = {
    id: node.childText(C, 'id') ?? '',
    roid: node.childText(C, 'roid') ?? '',
    ...parseStatuses(node.all(C, 'status')),
    postalInfo: node.all(C, 'postalInfo').map(parsePostalInfo),
    email: node.childText(C, 'email') ?? '',
    clID: node.childText(C, 'clID') ?? '',
    crID: node.childText(C, 'crID') ?? '',
    crDate: node.childText(C, 'crDate') ?? '',
  };
  const voice = node.child(C, 'voice');
  if (voice) {
    info.voice = voice.text;
    setIfDefined(info, 'voiceExt', voice.attr('x'));
  }
  const fax = node.child(C, 'fax');
  if (fax) {
    info.fax = fax.text;
    setIfDefined(info, 'faxExt', fax.attr('x'));
  }
  for (const key of ['upID', 'upDate', 'trDate'] as const) setIfDefined(info, key, node.childText(C, key));
  const pw = node.child(C, 'authInfo')?.child(C, 'pw');
  if (pw) {
    info.authInfo = { pw: pw.text };
    setIfDefined(info.authInfo, 'roid', pw.attr('roid'));
  }
  const disclose = node.child(C, 'disclose');
  if (disclose) info.disclose = parseDisclose(disclose);
  return info;
}

/** `<contact:creData>`. */
export function parseContactCreate(node: XmlNode): ContactCreateResult {
  return { id: node.childText(C, 'id') ?? '', crDate: node.childText(C, 'crDate') ?? '' };
}

/** `<contact:trnData>`. */
export function parseContactTransfer(node: XmlNode): ContactTransferResult {
  return {
    id: node.childText(C, 'id') ?? '',
    trStatus: (node.childText(C, 'trStatus') ?? '') as TransferStatus,
    reID: node.childText(C, 'reID') ?? '',
    reDate: node.childText(C, 'reDate') ?? '',
    acID: node.childText(C, 'acID') ?? '',
    acDate: node.childText(C, 'acDate') ?? '',
  };
}

function postalInfoList<T extends { type: PostalInfoType }>(list: T[], min: number): T[] {
  if (list.length < min || list.length > 2) {
    throw new EppValidationError(`A contact has ${min === 1 ? 'one or two' : 'at most two'} postalInfo elements (RFC 5733 Section 2.4)`);
  }
  for (const info of list) {
    if (info.type !== 'int' && info.type !== 'loc') throw new EppValidationError('postalInfo type must be "int" or "loc"');
  }
  if (list.length === 2 && list[0].type === list[1].type) {
    throw new EppValidationError('Two postalInfo elements must have different types ("int" and "loc")');
  }
  return list;
}

function postalInfoElement(info: ContactPostalInfo | ContactPostalInfoChange): XmlElement {
  return el('contact:postalInfo', { type: info.type }, [
    info.name !== undefined ? el('contact:name', null, info.name) : undefined,
    info.org !== undefined ? el('contact:org', null, info.org) : undefined,
    info.addr ? addressElement(info.addr) : undefined,
  ]);
}

function addressElement(addr: ContactAddress): XmlElement {
  const street = addr.street ?? [];
  if (street.length > 3) throw new EppValidationError('A contact address has at most three street lines (RFC 5733 Section 2.4.1)');
  if (!/^[A-Za-z]{2}$/.test(addr.cc)) throw new EppValidationError(`Country code must be two letters, got ${JSON.stringify(addr.cc)}`);
  return el('contact:addr', null, [
    street.map((line) => el('contact:street', null, line)),
    el('contact:city', null, addr.city),
    addr.sp !== undefined ? el('contact:sp', null, addr.sp) : undefined,
    addr.pc !== undefined ? el('contact:pc', null, addr.pc) : undefined,
    el('contact:cc', null, addr.cc),
  ]);
}

function phoneElement(name: string, phone: ContactPhone | undefined): XmlElement | undefined {
  if (phone === undefined) return undefined;
  const value = typeof phone === 'string' ? { number: phone } : phone;
  if (value.number !== '' && !/^\+[0-9]{1,3}\.[0-9]{1,14}$/.test(value.number)) {
    throw new EppValidationError(`Phone numbers use the format +CC.NUMBER (RFC 5733 Section 2.5), got ${JSON.stringify(value.number)}`);
  }
  return el(name, { x: value.ext }, value.number);
}

function discloseElement(disclose: ContactDisclose | undefined): XmlElement | undefined {
  if (!disclose) return undefined;
  const flag = disclose.flag === true || disclose.flag === 1;
  return el('contact:disclose', { flag: flag ? '1' : '0' }, [
    discloseTypes(disclose.name).map((type) => el('contact:name', { type })),
    discloseTypes(disclose.org).map((type) => el('contact:org', { type })),
    discloseTypes(disclose.addr).map((type) => el('contact:addr', { type })),
    disclose.voice ? el('contact:voice') : undefined,
    disclose.fax ? el('contact:fax') : undefined,
    disclose.email ? el('contact:email') : undefined,
  ]);
}

function discloseTypes(value: DiscloseTypes | undefined): PostalInfoType[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value;
  return [value.type];
}

function statusListElement(name: string, statuses: StatusInput[] | undefined): XmlElement | undefined {
  if (!statuses || statuses.length === 0) return undefined;
  if (statuses.length > 7) throw new EppValidationError('A contact update can add or remove at most 7 statuses');
  return el(name, null, statuses.map((status) => statusElement('contact:status', status)));
}

function parsePostalInfo(node: XmlNode): ContactPostalInfo {
  const addr = node.child(C, 'addr');
  const info: ContactPostalInfo = {
    type: node.attr('type') === 'loc' ? 'loc' : 'int',
    name: node.childText(C, 'name') ?? '',
    addr: {
      street: addr ? addr.all(C, 'street').map((s) => s.text) : [],
      city: addr?.childText(C, 'city') ?? '',
      cc: addr?.childText(C, 'cc') ?? '',
    },
  };
  setIfDefined(info, 'org', node.childText(C, 'org'));
  setIfDefined(info.addr, 'sp', addr?.childText(C, 'sp'));
  setIfDefined(info.addr, 'pc', addr?.childText(C, 'pc'));
  return info;
}

function parseDisclose(node: XmlNode): ContactDiscloseInfo {
  const types = (name: string) => node.all(C, name).map((n) => (n.attr('type') === 'loc' ? 'loc' : 'int') as PostalInfoType);
  return {
    flag: parseBoolean(node.attr('flag')) ?? false,
    name: types('name'),
    org: types('org'),
    addr: types('addr'),
    voice: Boolean(node.child(C, 'voice')),
    fax: Boolean(node.child(C, 'fax')),
    email: Boolean(node.child(C, 'email')),
  };
}
