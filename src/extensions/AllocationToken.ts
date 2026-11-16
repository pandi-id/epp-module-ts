import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import { el, XmlElement } from '../xml/XmlWriter';

/**
 * `<allocationToken:allocationToken>` (RFC 8495 Section 2.1), for check,
 * create, transfer and update commands.
 */
export function buildAllocationToken(token: string): XmlElement {
  if (!token || token.trim() === '') throw new EppValidationError('Allocation token must not be empty');
  return el('allocationToken:allocationToken', { 'xmlns:allocationToken': NS.allocationToken }, token);
}

/** `<allocationToken:info>`: ask an info command to return the token (RFC 8495 Section 3.1.2). */
export function buildAllocationTokenInfo(): XmlElement {
  return el('allocationToken:info', { 'xmlns:allocationToken': NS.allocationToken });
}
