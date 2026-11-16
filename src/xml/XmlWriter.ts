import { EppValidationError } from '../core/Errors';

/**
 * Minimal XML writer used to build EPP commands.
 *
 * Element names are written exactly as given (namespace prefix included) and
 * children are written in the order supplied, which is what the `<sequence>`
 * definitions of the EPP schemas require.
 */

export type XmlAttributeValue = string | number | boolean | null | undefined;

/** An XML element. Build one with {@link el}. */
export interface XmlElement {
  readonly name: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: ReadonlyArray<XmlElement | string>;
}

/**
 * Anything accepted as element content: elements, text, numbers, or nested
 * arrays of those. `null`, `undefined` and booleans are skipped so optional
 * children can be written inline.
 */
export type XmlChild = XmlElement | string | number | boolean | null | undefined | XmlChild[];

const NAME_PATTERN = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;

// Characters that cannot appear in an XML 1.0 document, plus unpaired surrogates.
const INVALID_CHARS =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Create an XML element.
 *
 * @example
 * ```typescript
 * el('domain:name', null, 'example.com');
 * el('domain:period', { unit: 'y' }, 1);
 * ```
 */
export function el(name: string, attrs?: Record<string, XmlAttributeValue> | null, children?: XmlChild): XmlElement {
  assertName(name);
  const normalized: Record<string, string> = {};
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      assertName(key);
      normalized[key] = String(value);
    }
  }
  const content: Array<XmlElement | string> = [];
  flatten(children, content);
  return { name, attrs: normalized, children: content };
}

/** Serialize an element tree, by default with an XML declaration. */
export function serializeXml(root: XmlElement, options: { declaration?: boolean } = {}): string {
  const out: string[] = [];
  if (options.declaration !== false) {
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  }
  write(root, out);
  return out.join('');
}

function flatten(child: XmlChild, into: Array<XmlElement | string>): void {
  if (child === null || child === undefined || typeof child === 'boolean') return;
  if (Array.isArray(child)) {
    for (const c of child) flatten(c, into);
  } else if (typeof child === 'number') {
    into.push(String(child));
  } else {
    into.push(child);
  }
}

function write(node: XmlElement | string, out: string[]): void {
  if (typeof node === 'string') {
    out.push(escapeText(node));
    return;
  }
  out.push('<', node.name);
  for (const [key, value] of Object.entries(node.attrs)) {
    out.push(' ', key, '="', escapeAttribute(value), '"');
  }
  if (node.children.length === 0) {
    out.push('/>');
    return;
  }
  out.push('>');
  for (const child of node.children) write(child, out);
  out.push('</', node.name, '>');
}

function assertName(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new EppValidationError(`Invalid XML name: ${JSON.stringify(name)}`);
  }
}

function assertChars(value: string): void {
  if (INVALID_CHARS.test(value)) {
    throw new EppValidationError('Value contains characters that are not allowed in XML');
  }
}

function escapeText(value: string): string {
  assertChars(value);
  return value.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

function escapeAttribute(value: string): string {
  assertChars(value);
  return value.replace(/[&<>"\t\n\r]/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\t': return '&#9;';
      case '\n': return '&#10;';
      default: return '&#13;';
    }
  });
}
