import { EppProtocolError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { EppResponse, EppResult, MessageQueue, PollMessageData, ResponseExtensions } from '../types/Common';
import { parseInteger, parseXml, XmlNode } from '../xml/XmlReader';
import { parseChangePoll } from '../extensions/ChangePoll';
import { parseFeeCheck, parseFeeTransform } from '../extensions/Fee';
import { parseLaunchCheck, parseLaunchCreate, parseLaunchInfo } from '../extensions/Launch';
import { parseLoginSecData } from '../extensions/LoginSec';
import { parseRgpInfo } from '../extensions/Rgp';
import { parseSecDnsInfo } from '../extensions/SecDns';
import { parseContactInfo, parseContactTransfer } from './Contact';
import { parseDomainCreate, parseDomainInfo, parseDomainRenew, parseDomainTransfer } from './Domain';
import { parseHostInfo } from './Host';
import { parsePendingAction } from './Shared';

/** The parts of a `<response>` the client works with. */
export interface ParsedResponse {
  results: EppResult[];
  msgQ?: MessageQueue;
  /** First element inside `<resData>`. */
  resData?: XmlNode;
  extensions: ResponseExtensions;
  clTRID?: string;
  svTRID?: string;
}

const FEE_TRANSFORM_DATA = ['creData', 'renData', 'trnData', 'updData', 'delData'];

/** Parse an EPP document and return its `<epp>` root element. */
export function parseEppDocument(xml: string): XmlNode {
  let root: XmlNode;
  try {
    root = parseXml(xml);
  } catch (error) {
    throw new EppProtocolError(`Malformed XML from server: ${(error as Error).message}`, xml);
  }
  if (!root.is(NS.epp, 'epp')) {
    throw new EppProtocolError(`Expected <epp> in namespace ${NS.epp}, got <${root.name}> in ${root.namespace || 'no namespace'}`, xml);
  }
  return root;
}

/** Parse the `<response>` of an EPP document (RFC 5730 Section 2.6). */
export function parseResponse(root: XmlNode, xml: string): ParsedResponse {
  const response = root.child(NS.epp, 'response');
  if (!response) throw new EppProtocolError('Expected an EPP <response>', xml);
  const results = response.all(NS.epp, 'result').map((result) => parseResult(result, xml));
  if (results.length === 0) throw new EppProtocolError('EPP response has no <result>', xml);

  const parsed: ParsedResponse = { results, extensions: {} };
  const msgQ = response.child(NS.epp, 'msgQ');
  if (msgQ) parsed.msgQ = parseMessageQueue(msgQ);
  const resData = response.child(NS.epp, 'resData');
  if (resData && resData.children.length > 0) parsed.resData = resData.children[0];
  const extension = response.child(NS.epp, 'extension');
  if (extension) parsed.extensions = parseExtensions(extension.children);
  const trID = response.child(NS.epp, 'trID');
  const clTRID = trID?.childText(NS.epp, 'clTRID');
  const svTRID = trID?.childText(NS.epp, 'svTRID');
  if (clTRID !== undefined) parsed.clTRID = clTRID;
  if (svTRID !== undefined) parsed.svTRID = svTRID;
  return parsed;
}

/** Interpret the extension elements of a response. */
export function parseExtensions(nodes: XmlNode[]): ResponseExtensions {
  const extensions: ResponseExtensions = {};
  for (const node of nodes) {
    switch (node.namespace) {
      case NS.secDNS:
        if (node.name === 'infData') {
          extensions.secDNS = parseSecDnsInfo(node);
          continue;
        }
        break;
      case NS.rgp:
        if (node.name === 'infData' || node.name === 'upData') {
          extensions.rgp = parseRgpInfo(node);
          continue;
        }
        break;
      case NS.launch:
        if (node.name === 'chkData') {
          extensions.launchCheck = parseLaunchCheck(node);
          continue;
        }
        if (node.name === 'infData') {
          extensions.launchInfo = parseLaunchInfo(node);
          continue;
        }
        if (node.name === 'creData') {
          extensions.launchCreate = parseLaunchCreate(node);
          continue;
        }
        break;
      case NS.fee:
        if (node.name === 'chkData') {
          extensions.feeCheck = parseFeeCheck(node);
          continue;
        }
        if (FEE_TRANSFORM_DATA.includes(node.name)) {
          extensions.fee = parseFeeTransform(node);
          continue;
        }
        break;
      case NS.loginSec:
        if (node.name === 'loginSecData') {
          extensions.loginSec = parseLoginSecData(node);
          continue;
        }
        break;
      case NS.changePoll:
        if (node.name === 'changeData') {
          extensions.changePoll = parseChangePoll(node);
          continue;
        }
        break;
      case NS.allocationToken:
        if (node.name === 'allocationToken') {
          extensions.allocationToken = node.text;
          continue;
        }
        break;
    }
    (extensions.unknown ??= []).push(node.outerXml());
  }
  return extensions;
}

/** Interpret the `<resData>` of a poll message. */
export function parsePollData(node: XmlNode): PollMessageData {
  if (node.namespace === NS.domain) {
    switch (node.name) {
      case 'trnData': return { type: 'domain:trnData', value: parseDomainTransfer(node) };
      case 'panData': return { type: 'domain:panData', value: parsePendingAction(node, NS.domain, 'name') };
      case 'infData': return { type: 'domain:infData', value: parseDomainInfo(node) };
      case 'creData': return { type: 'domain:creData', value: parseDomainCreate(node) };
      case 'renData': return { type: 'domain:renData', value: parseDomainRenew(node) };
    }
  } else if (node.namespace === NS.contact) {
    switch (node.name) {
      case 'trnData': return { type: 'contact:trnData', value: parseContactTransfer(node) };
      case 'panData': return { type: 'contact:panData', value: parsePendingAction(node, NS.contact, 'id') };
      case 'infData': return { type: 'contact:infData', value: parseContactInfo(node) };
    }
  } else if (node.namespace === NS.host) {
    switch (node.name) {
      case 'panData': return { type: 'host:panData', value: parsePendingAction(node, NS.host, 'name') };
      case 'infData': return { type: 'host:infData', value: parseHostInfo(node) };
    }
  }
  return { type: 'unknown', namespace: node.namespace, element: node.name, xml: node.outerXml() };
}

/** Assemble the public response object. */
export function toEppResponse<T>(parsed: ParsedResponse, xml: string, data: T | undefined): EppResponse<T> {
  const first = parsed.results[0];
  const response: EppResponse<T> = {
    success: first.code >= 1000 && first.code < 2000,
    code: first.code,
    message: first.message,
    results: parsed.results,
    extensions: parsed.extensions,
    xml,
  };
  if (data !== undefined) response.data = data;
  if (parsed.msgQ) response.msgQ = parsed.msgQ;
  if (parsed.clTRID !== undefined) response.clTRID = parsed.clTRID;
  if (parsed.svTRID !== undefined) response.svTRID = parsed.svTRID;
  return response;
}

function parseResult(node: XmlNode, xml: string): EppResult {
  const code = parseInteger(node.attr('code'));
  if (code === undefined) throw new EppProtocolError('EPP <result> has no valid code attribute', xml);
  const msg = node.child(NS.epp, 'msg');
  const result: EppResult = {
    code,
    message: msg?.text ?? '',
    values: node.all(NS.epp, 'value').map((value) => value.innerXml().trim()),
    extValues: node.all(NS.epp, 'extValue').map((extValue) => {
      const reason = extValue.child(NS.epp, 'reason');
      const entry: EppResult['extValues'][number] = {
        value: extValue.child(NS.epp, 'value')?.innerXml().trim() ?? '',
        reason: reason?.text ?? '',
      };
      if (reason?.attr('lang')) entry.lang = reason.attr('lang');
      return entry;
    }),
  };
  if (msg?.attr('lang')) result.lang = msg.attr('lang');
  return result;
}

function parseMessageQueue(node: XmlNode): MessageQueue {
  const queue: MessageQueue = { id: node.attr('id') ?? '', count: parseInteger(node.attr('count')) ?? 0 };
  const qDate = node.childText(NS.epp, 'qDate');
  if (qDate) queue.qDate = qDate;
  const msg = node.child(NS.epp, 'msg');
  if (msg) {
    queue.message = msg.text;
    if (msg.attr('lang')) queue.lang = msg.attr('lang');
    if (msg.children.length > 0) queue.messageXml = msg.innerXml().trim();
  }
  return queue;
}
