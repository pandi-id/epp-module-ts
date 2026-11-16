import * as sax from 'sax';

/**
 * Namespace-aware XML element produced by {@link parseXml}.
 *
 * Elements are matched by namespace URI and local name, never by prefix:
 * RFC 5730 lets servers pick any prefix (or a default namespace).
 */
export class XmlNode {
  readonly children: XmlNode[] = [];
  /** Text and element children in document order. */
  readonly content: Array<XmlNode | string> = [];

  constructor(
    readonly namespace: string,
    readonly name: string,
    readonly prefix: string,
    readonly attributes: Readonly<Record<string, string>>,
  ) {}

  /** Whether this element has the given namespace and local name. */
  is(namespace: string, name: string): boolean {
    return this.namespace === namespace && this.name === name;
  }

  /** First child element with the given namespace and local name. */
  child(namespace: string, name: string): XmlNode | undefined {
    return this.children.find((c) => c.namespace === namespace && c.name === name);
  }

  /** All child elements with the given namespace and local name. */
  all(namespace: string, name: string): XmlNode[] {
    return this.children.filter((c) => c.namespace === namespace && c.name === name);
  }

  /** Trimmed text of the first matching child element. */
  childText(namespace: string, name: string): string | undefined {
    return this.child(namespace, name)?.text;
  }

  /** Attribute value; unprefixed attributes are keyed by local name. */
  attr(name: string): string | undefined {
    return this.attributes[name];
  }

  /** Trimmed text content of this element and all descendants. */
  get text(): string {
    return this.rawText().trim();
  }

  /**
   * Serialized content of this element (without the element itself). Child
   * elements carry the namespace declarations they need, so the result can be
   * parsed on its own.
   */
  innerXml(scope: Readonly<Record<string, string>> = {}): string {
    return this.content.map((c) => (typeof c === 'string' ? escapeText(c) : c.outerXml(scope))).join('');
  }

  /** Serialized element, using the prefixes from the source document. */
  outerXml(scope: Readonly<Record<string, string>> = {}): string {
    const qname = this.prefix ? `${this.prefix}:${this.name}` : this.name;
    let declaration = '';
    let childScope = scope;
    if (scope[this.prefix] !== this.namespace) {
      declaration = ` ${this.prefix ? `xmlns:${this.prefix}` : 'xmlns'}="${escapeAttribute(this.namespace)}"`;
      childScope = { ...scope, [this.prefix]: this.namespace };
    }
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${escapeAttribute(v)}"`)
      .join('');
    const inner = this.innerXml(childScope);
    return inner ? `<${qname}${declaration}${attrs}>${inner}</${qname}>` : `<${qname}${declaration}${attrs}/>`;
  }

  private rawText(): string {
    return this.content.map((c) => (typeof c === 'string' ? c : c.rawText())).join('');
  }
}

/**
 * Parse an XML document into a tree of {@link XmlNode}s.
 *
 * DOCTYPE declarations are rejected: EPP messages never carry one, and
 * refusing them rules out entity-expansion attacks.
 *
 * @throws {Error} when the document is not well-formed.
 */
export function parseXml(xml: string): XmlNode {
  const parser = sax.parser(true, { xmlns: true, trim: false, normalize: false });
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;

  parser.onerror = (error: Error) => {
    throw error;
  };
  parser.ondoctype = () => {
    throw new Error('DOCTYPE declarations are not allowed in EPP messages');
  };
  parser.onopentag = (tag) => {
    const qtag = tag as sax.QualifiedTag;
    const attributes: Record<string, string> = {};
    for (const attr of Object.values(qtag.attributes)) {
      if (attr.prefix === 'xmlns' || attr.name === 'xmlns') continue;
      attributes[attr.prefix ? `${attr.prefix}:${attr.local}` : attr.local] = attr.value;
    }
    const node = new XmlNode(qtag.uri, qtag.local, qtag.prefix, attributes);
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
      parent.content.push(node);
    } else {
      root = node;
    }
    stack.push(node);
  };
  parser.onclosetag = () => {
    stack.pop();
  };
  parser.ontext = (text: string) => {
    stack[stack.length - 1]?.content.push(text);
  };
  parser.oncdata = (text: string) => {
    stack[stack.length - 1]?.content.push(text);
  };

  parser.write(xml).close();
  if (!root) throw new Error('XML document has no root element');
  return root;
}

/** Parse an xs:boolean ("true", "false", "1", "0"). */
export function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

/** Parse an integer, returning undefined for missing or malformed values. */
export function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^-?\d+$/.test(value.trim())) return undefined;
  return Number(value.trim());
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}
