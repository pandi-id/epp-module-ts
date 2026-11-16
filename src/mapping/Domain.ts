import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { TransferStatus } from '../types/Common';
import type {
  DomainAddRemove,
  DomainCheckOptions,
  DomainCheckResult,
  DomainContact,
  DomainCreateRequest,
  DomainCreateResult,
  DomainDeleteOptions,
  DomainInfo,
  DomainInfoOptions,
  DomainRenewRequest,
  DomainRenewResult,
  DomainRestoreOptions,
  DomainTransferRequest,
  DomainTransferResult,
  DomainUpdateRequest,
  NameServer,
  NameServerInput,
} from '../types/Domain';
import { parseBoolean, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { buildAllocationToken, buildAllocationTokenInfo } from '../extensions/AllocationToken';
import { buildFeeCheck, buildFeeTransform } from '../extensions/Fee';
import { buildLaunchCheck, buildLaunchCreate, buildLaunchIdContainer, buildLaunchInfo } from '../extensions/Launch';
import { buildRgpRestore } from '../extensions/Rgp';
import { buildSecDnsCreate, buildSecDnsUpdate } from '../extensions/SecDns';
import {
  addressElement,
  authInfoElement,
  CommandParts,
  parseStatuses,
  periodElement,
  requireNonEmpty,
  setIfDefined,
  statusElement,
  toAuthInfo,
  toXsdDate,
} from './Shared';

const D = NS.domain;
const TRANSFER_OPS = ['request', 'query', 'approve', 'reject', 'cancel'];

/** Domain check (RFC 5731 Section 3.1.1). */
export function buildDomainCheck(names: string[], options: DomainCheckOptions = {}): CommandParts {
  requireNonEmpty(names, 'domain name');
  return {
    command: el('check', null, el('domain:check', { 'xmlns:domain': D }, names.map((name) => el('domain:name', null, name)))),
    extensions: compact([
      options.launch && buildLaunchCheck(options.launch),
      options.fee && buildFeeCheck(options.fee),
      options.allocationToken !== undefined ? buildAllocationToken(options.allocationToken) : undefined,
      ...(options.extensions ?? []),
    ]),
  };
}

/** Domain info (RFC 5731 Section 3.1.2). */
export function buildDomainInfo(name: string, options: DomainInfoOptions = {}): CommandParts {
  return {
    command: el(
      'info',
      null,
      el('domain:info', { 'xmlns:domain': D }, [
        el('domain:name', { hosts: options.hosts }, name),
        authInfoElement('domain', toAuthInfo(options.authInfo)),
      ]),
    ),
    extensions: compact([
      options.launch && buildLaunchInfo(options.launch),
      options.allocationToken ? buildAllocationTokenInfo() : undefined,
      ...(options.extensions ?? []),
    ]),
  };
}

/** Domain create (RFC 5731 Section 3.2.1). */
export function buildDomainCreate(request: DomainCreateRequest): CommandParts {
  if (!request.authInfo) throw new EppValidationError('authInfo is required to create a domain (RFC 5731 Section 3.2.1)');
  return {
    command: el(
      'create',
      null,
      el('domain:create', { 'xmlns:domain': D }, [
        el('domain:name', null, request.name),
        periodElement('domain:period', request.period),
        nameServersElement(request.ns),
        request.registrant !== undefined ? el('domain:registrant', null, request.registrant) : undefined,
        (request.contacts ?? []).map(contactElement),
        authInfoElement('domain', request.authInfo),
      ]),
    ),
    extensions: compact([
      request.dnssec && buildSecDnsCreate(request.dnssec),
      request.launch && buildLaunchCreate(request.launch),
      request.fee && buildFeeTransform('create', request.fee),
      request.allocationToken !== undefined ? buildAllocationToken(request.allocationToken) : undefined,
      ...(request.extensions ?? []),
    ]),
  };
}

/** Domain delete (RFC 5731 Section 3.2.2). */
export function buildDomainDelete(name: string, options: DomainDeleteOptions = {}): CommandParts {
  return {
    command: el('delete', null, el('domain:delete', { 'xmlns:domain': D }, el('domain:name', null, name))),
    extensions: compact([options.launch && buildLaunchIdContainer('delete', options.launch), ...(options.extensions ?? [])]),
  };
}

/** Domain renew (RFC 5731 Section 3.2.3). */
export function buildDomainRenew(request: DomainRenewRequest): CommandParts {
  return {
    command: el(
      'renew',
      null,
      el('domain:renew', { 'xmlns:domain': D }, [
        el('domain:name', null, request.name),
        el('domain:curExpDate', null, toXsdDate(request.curExpDate, 'curExpDate')),
        periodElement('domain:period', request.period),
      ]),
    ),
    extensions: compact([request.fee && buildFeeTransform('renew', request.fee), ...(request.extensions ?? [])]),
  };
}

/** Domain transfer (RFC 5731 Section 3.2.4). */
export function buildDomainTransfer(request: DomainTransferRequest): CommandParts {
  if (!TRANSFER_OPS.includes(request.op)) {
    throw new EppValidationError(`Transfer op must be one of ${TRANSFER_OPS.join(', ')}, got ${JSON.stringify(request.op)}`);
  }
  if (request.op !== 'request' && (request.fee || request.allocationToken !== undefined)) {
    throw new EppValidationError('fee and allocationToken only apply to a transfer request');
  }
  return {
    command: el(
      'transfer',
      { op: request.op },
      el('domain:transfer', { 'xmlns:domain': D }, [
        el('domain:name', null, request.name),
        periodElement('domain:period', request.period),
        authInfoElement('domain', request.authInfo),
      ]),
    ),
    extensions: compact([
      request.fee && buildFeeTransform('transfer', request.fee),
      request.allocationToken !== undefined ? buildAllocationToken(request.allocationToken) : undefined,
      ...(request.extensions ?? []),
    ]),
  };
}

/** Domain update (RFC 5731 Section 3.2.5). */
export function buildDomainUpdate(request: DomainUpdateRequest): CommandParts {
  const add = addRemoveElement('add', request.add);
  const rem = addRemoveElement('rem', request.rem);
  const chgChildren = request.chg
    ? compact([
        request.chg.registrant !== undefined ? el('domain:registrant', null, request.chg.registrant) : undefined,
        authInfoElement('domain', request.chg.authInfo),
      ])
    : [];
  const chg = chgChildren.length > 0 ? el('domain:chg', null, chgChildren) : undefined;
  const extensions = compact([
    request.dnssec && buildSecDnsUpdate(request.dnssec),
    request.launch && buildLaunchIdContainer('update', request.launch),
    request.fee && buildFeeTransform('update', request.fee),
    request.allocationToken !== undefined ? buildAllocationToken(request.allocationToken) : undefined,
    ...(request.extensions ?? []),
  ]);
  if (!add && !rem && !chg && extensions.length === 0) {
    throw new EppValidationError('A domain update needs add, rem or chg (RFC 5731 Section 3.2.5)');
  }
  return {
    command: el('update', null, el('domain:update', { 'xmlns:domain': D }, [el('domain:name', null, request.name), add, rem, chg])),
    extensions,
  };
}

/**
 * Domain restore through the RGP extension (RFC 3915 Section 4.2.5): an
 * update with an empty `<domain:chg/>`, as in the RFC examples.
 */
export function buildDomainRestore(name: string, options: DomainRestoreOptions = {}): CommandParts {
  return {
    command: el('update', null, el('domain:update', { 'xmlns:domain': D }, [el('domain:name', null, name), el('domain:chg')])),
    extensions: compact([
      buildRgpRestore(options.report),
      options.fee && buildFeeTransform('update', options.fee),
      ...(options.extensions ?? []),
    ]),
  };
}

/** `<domain:chkData>`. */
export function parseDomainCheck(node: XmlNode): DomainCheckResult[] {
  return node.all(D, 'cd').map((cd) => {
    const name = cd.child(D, 'name');
    const result: DomainCheckResult = { name: name?.text ?? '', available: parseBoolean(name?.attr('avail')) ?? false };
    setIfDefined(result, 'reason', cd.childText(D, 'reason'));
    return result;
  });
}

/** `<domain:infData>`. */
export function parseDomainInfo(node: XmlNode): DomainInfo {
  const info: DomainInfo = {
    name: node.childText(D, 'name') ?? '',
    roid: node.childText(D, 'roid') ?? '',
    ...parseStatuses(node.all(D, 'status')),
    contacts: node.all(D, 'contact').map((c) => ({ type: c.attr('type') as DomainContact['type'], id: c.text })),
    hosts: node.all(D, 'host').map((h) => h.text),
    clID: node.childText(D, 'clID') ?? '',
  };
  setIfDefined(info, 'registrant', node.childText(D, 'registrant'));
  const ns = node.child(D, 'ns');
  if (ns) info.ns = parseNameServers(ns);
  for (const key of ['crID', 'crDate', 'upID', 'upDate', 'exDate', 'trDate'] as const) {
    setIfDefined(info, key, node.childText(D, key));
  }
  const pw = node.child(D, 'authInfo')?.child(D, 'pw');
  if (pw) {
    info.authInfo = { pw: pw.text };
    setIfDefined(info.authInfo, 'roid', pw.attr('roid'));
  }
  return info;
}

/** `<domain:creData>`. */
export function parseDomainCreate(node: XmlNode): DomainCreateResult {
  const result: DomainCreateResult = { name: node.childText(D, 'name') ?? '', crDate: node.childText(D, 'crDate') ?? '' };
  setIfDefined(result, 'exDate', node.childText(D, 'exDate'));
  return result;
}

/** `<domain:renData>`. */
export function parseDomainRenew(node: XmlNode): DomainRenewResult {
  const result: DomainRenewResult = { name: node.childText(D, 'name') ?? '' };
  setIfDefined(result, 'exDate', node.childText(D, 'exDate'));
  return result;
}

/** `<domain:trnData>`. */
export function parseDomainTransfer(node: XmlNode): DomainTransferResult {
  const result: DomainTransferResult = {
    name: node.childText(D, 'name') ?? '',
    trStatus: (node.childText(D, 'trStatus') ?? '') as TransferStatus,
    reID: node.childText(D, 'reID') ?? '',
    reDate: node.childText(D, 'reDate') ?? '',
    acID: node.childText(D, 'acID') ?? '',
    acDate: node.childText(D, 'acDate') ?? '',
  };
  setIfDefined(result, 'exDate', node.childText(D, 'exDate'));
  return result;
}

function nameServersElement(ns: NameServerInput | undefined): XmlElement | undefined {
  if (!ns) return undefined;
  const value: NameServer = Array.isArray(ns) ? { hostObj: ns } : ns;
  const hostObj = value.hostObj ?? [];
  const hostAttr = value.hostAttr ?? [];
  if (hostObj.length && hostAttr.length) {
    throw new EppValidationError('Name servers: use hostObj or hostAttr, not both (RFC 5731 Section 1.1)');
  }
  if (!hostObj.length && !hostAttr.length) return undefined;
  return el(
    'domain:ns',
    null,
    hostObj.length
      ? hostObj.map((host) => el('domain:hostObj', null, host))
      : hostAttr.map((host) =>
          el('domain:hostAttr', null, [
            el('domain:hostName', null, host.hostName),
            (host.hostAddr ?? []).map((address) => addressElement('domain:hostAddr', address)),
          ]),
        ),
  );
}

function contactElement(contact: DomainContact): XmlElement {
  if (!['admin', 'billing', 'tech'].includes(contact.type)) {
    throw new EppValidationError(`Domain contact type must be admin, billing or tech, got ${JSON.stringify(contact.type)}`);
  }
  return el('domain:contact', { type: contact.type }, contact.id);
}

function addRemoveElement(kind: 'add' | 'rem', value: DomainAddRemove | undefined): XmlElement | undefined {
  if (!value) return undefined;
  const statuses = value.status ?? [];
  if (statuses.length > 11) throw new EppValidationError('A domain update can add or remove at most 11 statuses');
  const children = compact([
    nameServersElement(value.ns),
    ...(value.contacts ?? []).map(contactElement),
    ...statuses.map((status) => statusElement('domain:status', status)),
  ]);
  return children.length > 0 ? el(`domain:${kind}`, null, children) : undefined;
}

function parseNameServers(node: XmlNode): NameServer {
  const hostObj = node.all(D, 'hostObj').map((h) => h.text);
  const hostAttr = node.all(D, 'hostAttr').map((attr) => ({
    hostName: attr.childText(D, 'hostName') ?? '',
    hostAddr: attr.all(D, 'hostAddr').map((addr) => ({ ip: addr.text, type: addr.attr('ip') === 'v6' ? ('v6' as const) : ('v4' as const) })),
  }));
  const ns: NameServer = {};
  if (hostObj.length) ns.hostObj = hostObj;
  if (hostAttr.length) ns.hostAttr = hostAttr;
  return ns;
}

function compact<T>(values: Array<T | undefined | false | null | ''>): T[] {
  return values.filter((value): value is T => Boolean(value));
}
