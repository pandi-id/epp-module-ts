import { NS } from '../core/Namespaces';
import { el, serializeXml } from '../xml/XmlWriter';
import type { CommandParts } from './Shared';

/**
 * Wrap a command in `<epp><command>`. RFC 5730 Section 2.5 orders the
 * command element, then `<extension>`, then `<clTRID>`.
 */
export function buildCommandXml(parts: CommandParts, clTRID: string): string {
  return serializeXml(
    el('epp', { xmlns: NS.epp }, [
      el('command', null, [
        parts.command,
        parts.extensions.length > 0 ? el('extension', null, parts.extensions) : undefined,
        el('clTRID', null, clTRID),
      ]),
    ]),
  );
}

/** `<hello>` (RFC 5730 Section 2.3). The server answers with a greeting. */
export function buildHelloXml(): string {
  return serializeXml(el('epp', { xmlns: NS.epp }, el('hello')));
}
