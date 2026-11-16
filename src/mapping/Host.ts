import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { HostAddRemove, HostCheckResult, HostCreateRequest, HostCreateResult, HostInfo, HostUpdateRequest } from '../types/Host';
import { parseBoolean, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { addressElement, CommandParts, parseStatuses, requireNonEmpty, setIfDefined, statusElement } from './Shared';

const H = NS.host;

/** Host check (RFC 5732 Section 3.1.1). */
export function buildHostCheck(names: string[], extensions: XmlElement[] = []): CommandParts {
  requireNonEmpty(names, 'host name');
  return {
    command: el('check', null, el('host:check', { 'xmlns:host': H }, names.map((name) => el('host:name', null, name)))),
    extensions,
  };
}

/** Host info (RFC 5732 Section 3.1.2). */
export function buildHostInfo(name: string, extensions: XmlElement[] = []): CommandParts {
  return {
    command: el('info', null, el('host:info', { 'xmlns:host': H }, el('host:name', null, name))),
    extensions,
  };
}

/** Host create (RFC 5732 Section 3.2.1). */
export function buildHostCreate(request: HostCreateRequest): CommandParts {
  return {
    command: el(
      'create',
      null,
      el('host:create', { 'xmlns:host': H }, [
        el('host:name', null, request.name),
        (request.addr ?? []).map((address) => addressElement('host:addr', address)),
      ]),
    ),
    extensions: request.extensions ?? [],
  };
}

/** Host delete (RFC 5732 Section 3.2.2). */
export function buildHostDelete(name: string, extensions: XmlElement[] = []): CommandParts {
  return {
    command: el('delete', null, el('host:delete', { 'xmlns:host': H }, el('host:name', null, name))),
    extensions,
  };
}

/** Host update (RFC 5732 Section 3.2.5). */
export function buildHostUpdate(request: HostUpdateRequest): CommandParts {
  const add = addRemoveElement('add', request.add);
  const rem = addRemoveElement('rem', request.rem);
  const chg = request.chg ? el('host:chg', null, el('host:name', null, request.chg.name)) : undefined;
  const extensions = request.extensions ?? [];
  if (!add && !rem && !chg && extensions.length === 0) {
    throw new EppValidationError('A host update needs add, rem or chg (RFC 5732 Section 3.2.5)');
  }
  return {
    command: el('update', null, el('host:update', { 'xmlns:host': H }, [el('host:name', null, request.name), add, rem, chg])),
    extensions,
  };
}

/** `<host:chkData>`. */
export function parseHostCheck(node: XmlNode): HostCheckResult[] {
  return node.all(H, 'cd').map((cd) => {
    const name = cd.child(H, 'name');
    const result: HostCheckResult = { name: name?.text ?? '', available: parseBoolean(name?.attr('avail')) ?? false };
    setIfDefined(result, 'reason', cd.childText(H, 'reason'));
    return result;
  });
}

/** `<host:infData>`. */
export function parseHostInfo(node: XmlNode): HostInfo {
  const info: HostInfo = {
    name: node.childText(H, 'name') ?? '',
    roid: node.childText(H, 'roid') ?? '',
    ...parseStatuses(node.all(H, 'status')),
    addr: node.all(H, 'addr').map((addr) => ({ ip: addr.text, type: addr.attr('ip') === 'v6' ? ('v6' as const) : ('v4' as const) })),
    clID: node.childText(H, 'clID') ?? '',
    crID: node.childText(H, 'crID') ?? '',
    crDate: node.childText(H, 'crDate') ?? '',
  };
  for (const key of ['upID', 'upDate', 'trDate'] as const) setIfDefined(info, key, node.childText(H, key));
  return info;
}

/** `<host:creData>`. */
export function parseHostCreate(node: XmlNode): HostCreateResult {
  return { name: node.childText(H, 'name') ?? '', crDate: node.childText(H, 'crDate') ?? '' };
}

function addRemoveElement(kind: 'add' | 'rem', value: HostAddRemove | undefined): XmlElement | undefined {
  if (!value) return undefined;
  const statuses = value.status ?? [];
  if (statuses.length > 7) throw new EppValidationError('A host update can add or remove at most 7 statuses');
  const children = [
    ...(value.addr ?? []).map((address) => addressElement('host:addr', address)),
    ...statuses.map((status) => statusElement('host:status', status)),
  ];
  return children.length > 0 ? el(`host:${kind}`, null, children) : undefined;
}
