import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { DataCollectionPolicy, Greeting, UserAgent } from '../types/Common';
import { XmlNode } from '../xml/XmlReader';
import { el } from '../xml/XmlWriter';
import { buildLoginSec, LOGIN_SECURITY_PLACEHOLDER } from '../extensions/LoginSec';
import type { CommandParts } from './Shared';

export interface LoginParams {
  clID: string;
  pw: string;
  newPW?: string;
  version: string;
  lang: string;
  objURIs: string[];
  extURIs: string[];
  /** User agent for loginSec; only sent when loginSec is among `extURIs`. */
  userAgent?: UserAgent;
}

/**
 * `<login>` (RFC 5730 Section 2.9.1.1). Passwords longer than the 16
 * characters `<pw>` allows go through loginSec (RFC 8807) when it is
 * announced in `extURIs`.
 */
export function buildLogin(params: LoginParams): CommandParts {
  if (params.clID.length < 3 || params.clID.length > 16) {
    throw new EppValidationError('Client ID must be 3-16 characters (RFC 5730 clIDType)');
  }
  const loginSec = params.extURIs.includes(NS.loginSec);
  const pwInExtension = passwordNeedsExtension(params.pw, 'Password', loginSec);
  const newPWInExtension = params.newPW !== undefined && passwordNeedsExtension(params.newPW, 'New password', loginSec);
  if (params.objURIs.length === 0) {
    throw new EppValidationError('At least one object URI must be announced at login');
  }

  const userAgent = loginSec && params.userAgent && hasUserAgent(params.userAgent) ? params.userAgent : undefined;
  const extensions =
    loginSec && (pwInExtension || newPWInExtension || userAgent)
      ? [
          buildLoginSec({
            userAgent,
            pw: pwInExtension ? params.pw : undefined,
            newPW: newPWInExtension ? params.newPW : undefined,
          }),
        ]
      : [];

  const command = el('login', null, [
    el('clID', null, params.clID),
    el('pw', null, pwInExtension ? LOGIN_SECURITY_PLACEHOLDER : params.pw),
    params.newPW !== undefined ? el('newPW', null, newPWInExtension ? LOGIN_SECURITY_PLACEHOLDER : params.newPW) : undefined,
    el('options', null, [el('version', null, params.version), el('lang', null, params.lang)]),
    el('svcs', null, [
      params.objURIs.map((uri) => el('objURI', null, uri)),
      params.extURIs.length > 0 ? el('svcExtension', null, params.extURIs.map((uri) => el('extURI', null, uri))) : undefined,
    ]),
  ]);
  return { command, extensions };
}

/** `<logout>` (RFC 5730 Section 2.9.1.2). */
export function buildLogout(): CommandParts {
  return { command: el('logout'), extensions: [] };
}

/** `<poll>` (RFC 5730 Section 2.9.2.3). */
export function buildPoll(op: 'req' | 'ack', msgID?: string): CommandParts {
  if (op === 'ack' && !msgID) throw new EppValidationError('A message ID is required to acknowledge a poll message');
  return { command: el('poll', { op, msgID: op === 'ack' ? msgID : undefined }), extensions: [] };
}

/** Parse `<greeting>` (RFC 5730 Section 2.4). */
export function parseGreeting(greeting: XmlNode): Greeting {
  const menu = greeting.child(NS.epp, 'svcMenu');
  const texts = (parent: XmlNode | undefined, name: string) => (parent ? parent.all(NS.epp, name).map((n) => n.text) : []);
  const result: Greeting = {
    svID: greeting.childText(NS.epp, 'svID') ?? '',
    svDate: greeting.childText(NS.epp, 'svDate') ?? '',
    versions: texts(menu, 'version'),
    languages: texts(menu, 'lang'),
    objURIs: texts(menu, 'objURI'),
    extURIs: texts(menu?.child(NS.epp, 'svcExtension'), 'extURI'),
  };
  const dcp = greeting.child(NS.epp, 'dcp');
  if (dcp) result.dcp = parseDcp(dcp);
  return result;
}

function parseDcp(dcp: XmlNode): DataCollectionPolicy {
  const names = (node: XmlNode | undefined) => (node ? node.children.map((c) => c.name) : []);
  const policy: DataCollectionPolicy = {
    access: names(dcp.child(NS.epp, 'access'))[0] ?? '',
    statements: dcp.all(NS.epp, 'statement').map((statement) => ({
      purpose: names(statement.child(NS.epp, 'purpose')),
      recipient: names(statement.child(NS.epp, 'recipient')),
      retention: names(statement.child(NS.epp, 'retention'))[0] ?? '',
    })),
  };
  const expiry = dcp.child(NS.epp, 'expiry');
  if (expiry) {
    policy.expiry = {};
    const absolute = expiry.childText(NS.epp, 'absolute');
    const relative = expiry.childText(NS.epp, 'relative');
    if (absolute) policy.expiry.absolute = absolute;
    if (relative) policy.expiry.relative = relative;
  }
  return policy;
}

function passwordNeedsExtension(password: string, label: string, loginSec: boolean): boolean {
  if (password.length < 6) throw new EppValidationError(`${label} must be at least 6 characters (RFC 5730 pwType)`);
  if (password.length <= 16) return false;
  if (!loginSec) {
    throw new EppValidationError(
      `${label} is longer than 16 characters, which requires the loginSec extension (RFC 8807); the server does not offer it`,
    );
  }
  return true;
}

function hasUserAgent(userAgent: UserAgent): boolean {
  return Boolean(userAgent.app || userAgent.tech || userAgent.os);
}
