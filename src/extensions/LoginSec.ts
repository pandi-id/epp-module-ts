import { NS } from '../core/Namespaces';
import type { LoginSecEvent, UserAgent } from '../types/Common';
import { XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';

/** Value sent in `<pw>`/`<newPW>` when the real password is in the extension (RFC 8807 Section 3.2). */
export const LOGIN_SECURITY_PLACEHOLDER = '[LOGIN-SECURITY]';

/** `<loginSec:loginSec>` (RFC 8807 Section 4.1). */
export function buildLoginSec(options: { userAgent?: UserAgent; pw?: string; newPW?: string }): XmlElement {
  const { userAgent, pw, newPW } = options;
  return el('loginSec:loginSec', { 'xmlns:loginSec': NS.loginSec }, [
    userAgent
      ? el('loginSec:userAgent', null, [
          userAgent.app ? el('loginSec:app', null, userAgent.app) : undefined,
          userAgent.tech ? el('loginSec:tech', null, userAgent.tech) : undefined,
          userAgent.os ? el('loginSec:os', null, userAgent.os) : undefined,
        ])
      : undefined,
    pw !== undefined ? el('loginSec:pw', null, pw) : undefined,
    newPW !== undefined ? el('loginSec:newPW', null, newPW) : undefined,
  ]);
}

/** `<loginSec:loginSecData>` (RFC 8807 Section 4.1). */
export function parseLoginSecData(node: XmlNode): LoginSecEvent[] {
  return node.all(NS.loginSec, 'event').map((event) => {
    const result: LoginSecEvent = { type: event.attr('type') ?? '', level: event.attr('level') ?? '' };
    for (const key of ['name', 'exDate', 'value', 'duration', 'lang'] as const) {
      const value = event.attr(key);
      if (value !== undefined) result[key] = value;
    }
    if (event.text) result.message = event.text;
    return result;
  });
}
