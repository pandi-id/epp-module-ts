import { isIPv6 } from 'net';
import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { AuthInfo, ObjectStatus, PendingActionResult, Period, PeriodInput, StatusInput, TransactionIds } from '../types/Common';
import { parseBoolean, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';

/** A command element plus the extension elements that go with it. */
export interface CommandParts {
  command: XmlElement;
  extensions: XmlElement[];
}

export function toPeriod(input: PeriodInput): Period {
  const period: Period = typeof input === 'number' ? { value: input, unit: 'y' } : input;
  if (!Number.isInteger(period.value) || period.value < 1 || period.value > 99) {
    throw new EppValidationError(`Period must be an integer from 1 to 99, got ${period.value}`);
  }
  if (period.unit !== 'y' && period.unit !== 'm') {
    throw new EppValidationError(`Period unit must be "y" or "m", got ${JSON.stringify(period.unit)}`);
  }
  return period;
}

/** `<prefix:period unit="y">1</prefix:period>`, or undefined when no period is given. */
export function periodElement(name: string, input: PeriodInput | undefined): XmlElement | undefined {
  if (input === undefined) return undefined;
  const period = toPeriod(input);
  return el(name, { unit: period.unit }, period.value);
}

export function authInfoElement(prefix: string, authInfo: AuthInfo | { null: true } | undefined): XmlElement | undefined {
  if (!authInfo) return undefined;
  if ('null' in authInfo) return el(`${prefix}:authInfo`, null, el(`${prefix}:null`));
  if (typeof authInfo.pw !== 'string') throw new EppValidationError('authInfo.pw must be a string');
  return el(`${prefix}:authInfo`, null, el(`${prefix}:pw`, { roid: authInfo.roid }, authInfo.pw));
}

export function toAuthInfo(value: string | AuthInfo | undefined): AuthInfo | undefined {
  return typeof value === 'string' ? { pw: value } : value;
}

export function statusElement(name: string, status: StatusInput): XmlElement {
  const value: ObjectStatus = typeof status === 'string' ? { s: status } : status;
  return el(name, { s: value.s, lang: value.lang }, value.reason);
}

export function addressElement(name: string, address: { ip: string; type?: 'v4' | 'v6' } | string): XmlElement {
  const value = typeof address === 'string' ? { ip: address } : address;
  const type = value.type ?? (isIPv6(value.ip) ? 'v6' : 'v4');
  return el(name, { ip: type }, value.ip);
}

/** Format a value as xs:date. A dateTime string or Date gives its UTC date. */
export function toXsdDate(value: string | Date, field: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new EppValidationError(`${field} is not a valid date: ${String(value)}`);
  return date.toISOString().slice(0, 10);
}

/** Format a value as xs:dateTime. Strings are passed through after a validity check. */
export function toXsdDateTime(value: string | Date, field: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new EppValidationError(`${field} is not a valid date`);
    return value.toISOString();
  }
  if (Number.isNaN(Date.parse(value))) throw new EppValidationError(`${field} is not a valid date-time: ${value}`);
  return value.trim();
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function requireNonEmpty<T>(values: T[], what: string): T[] {
  if (values.length === 0) throw new EppValidationError(`At least one ${what} is required`);
  return values;
}

/** Status values and details from `<prefix:status>` elements. */
export function parseStatuses(nodes: XmlNode[]): { status: string[]; statusDetails: ObjectStatus[] } {
  const statusDetails = nodes.map((node) => {
    const detail: ObjectStatus = { s: node.attr('s') ?? '' };
    if (node.attr('lang')) detail.lang = node.attr('lang');
    if (node.text) detail.reason = node.text;
    return detail;
  });
  return { status: statusDetails.map((d) => d.s), statusDetails };
}

/** `<clTRID>`/`<svTRID>` children of a trID-typed element (EPP namespace). */
export function parseTransactionIds(node: XmlNode | undefined): TransactionIds {
  const ids: TransactionIds = {};
  const clTRID = node?.childText(NS.epp, 'clTRID');
  const svTRID = node?.childText(NS.epp, 'svTRID');
  if (clTRID !== undefined) ids.clTRID = clTRID;
  if (svTRID !== undefined) ids.svTRID = svTRID;
  return ids;
}

/** `<prefix:panData>` (RFC 5731/5732/5733 Section 3.3). */
export function parsePendingAction(node: XmlNode, ns: string, idElement: 'name' | 'id'): PendingActionResult {
  const id = node.child(ns, idElement);
  return {
    name: id?.text ?? '',
    paResult: parseBoolean(id?.attr('paResult')) ?? false,
    paTRID: parseTransactionIds(node.child(ns, 'paTRID')),
    paDate: node.childText(ns, 'paDate') ?? '',
  };
}

/** Copy a value onto `target` only when it is defined. */
export function setIfDefined<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}
