import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import { DnssecCreate, DnssecInfo, DnssecUpdate, DsData, KeyData, validateDsData, validateKeyData } from '../types/Dnssec';
import { parseInteger, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';

/** `<secDNS:create>` (RFC 5910 Section 5.2.1). */
export function buildSecDnsCreate(data: DnssecCreate): XmlElement {
  return el('secDNS:create', { 'xmlns:secDNS': NS.secDNS }, [
    data.maxSigLife !== undefined ? el('secDNS:maxSigLife', null, maxSigLife(data.maxSigLife)) : undefined,
    dsOrKeyData(data, 'DNSSEC create'),
  ]);
}

/**
 * `<secDNS:update>` (RFC 5910 Section 5.2.5). The schema orders `rem`
 * before `add` before `chg`, and the server processes them in that order.
 */
export function buildSecDnsUpdate(update: DnssecUpdate): XmlElement {
  const rem = update.rem;
  let remElement: XmlElement | undefined;
  if (rem) {
    if (rem.all) {
      if (rem.dsData?.length || rem.keyData?.length) {
        throw new EppValidationError('DNSSEC rem: "all" cannot be combined with dsData or keyData');
      }
      remElement = el('secDNS:rem', null, el('secDNS:all', null, 'true'));
    } else {
      remElement = el('secDNS:rem', null, dsOrKeyData(rem, 'DNSSEC rem'));
    }
  }
  const addElement = update.add ? el('secDNS:add', null, dsOrKeyData(update.add, 'DNSSEC add')) : undefined;
  const chgElement =
    update.chg?.maxSigLife !== undefined
      ? el('secDNS:chg', null, el('secDNS:maxSigLife', null, maxSigLife(update.chg.maxSigLife)))
      : undefined;
  if (!remElement && !addElement && !chgElement) {
    throw new EppValidationError('A DNSSEC update needs rem, add or chg');
  }
  return el(
    'secDNS:update',
    { 'xmlns:secDNS': NS.secDNS, urgent: update.urgent === undefined ? undefined : String(update.urgent) },
    [remElement, addElement, chgElement],
  );
}

/** `<secDNS:infData>` (RFC 5910 Section 5.1.2). */
export function parseSecDnsInfo(node: XmlNode): DnssecInfo {
  const info: DnssecInfo = {};
  const maxSigLifeValue = parseInteger(node.childText(NS.secDNS, 'maxSigLife'));
  if (maxSigLifeValue !== undefined) info.maxSigLife = maxSigLifeValue;
  const dsData = node.all(NS.secDNS, 'dsData').map(parseDsData);
  const keyData = node.all(NS.secDNS, 'keyData').map(parseKeyData);
  if (dsData.length) info.dsData = dsData;
  if (keyData.length) info.keyData = keyData;
  return info;
}

function dsOrKeyData(data: { dsData?: DsData[]; keyData?: KeyData[] }, context: string): XmlElement[] {
  const dsData = data.dsData ?? [];
  const keyData = data.keyData ?? [];
  if (dsData.length && keyData.length) {
    throw new EppValidationError(`${context}: use either dsData or keyData, not both (RFC 5910 Section 4)`);
  }
  if (!dsData.length && !keyData.length) throw new EppValidationError(`${context}: dsData or keyData is required`);
  return dsData.length ? dsData.map(dsDataElement) : keyData.map(keyDataElement);
}

function dsDataElement(ds: DsData): XmlElement {
  if (!validateDsData(ds)) {
    throw new EppValidationError(
      `Invalid DS data for key tag ${ds.keyTag}: check keyTag (0-65535), alg and digestType (0-255), and the hex digest length`,
    );
  }
  return el('secDNS:dsData', null, [
    el('secDNS:keyTag', null, ds.keyTag),
    el('secDNS:alg', null, ds.alg),
    el('secDNS:digestType', null, ds.digestType),
    el('secDNS:digest', null, ds.digest),
    ds.keyData ? keyDataElement(ds.keyData) : undefined,
  ]);
}

function keyDataElement(key: KeyData): XmlElement {
  if (!validateKeyData(key)) {
    throw new EppValidationError(
      'Invalid DNSKEY data: flags must be 16-bit with the Zone Key bit set (256 or 257), protocol 3, and pubKey base64',
    );
  }
  return el('secDNS:keyData', null, [
    el('secDNS:flags', null, key.flags),
    el('secDNS:protocol', null, key.protocol),
    el('secDNS:alg', null, key.alg),
    el('secDNS:pubKey', null, key.pubKey),
  ]);
}

function maxSigLife(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new EppValidationError(`maxSigLife must be a positive integer number of seconds, got ${value}`);
  }
  return value;
}

function parseDsData(node: XmlNode): DsData {
  const ds: DsData = {
    keyTag: parseInteger(node.childText(NS.secDNS, 'keyTag')) ?? 0,
    alg: parseInteger(node.childText(NS.secDNS, 'alg')) ?? 0,
    digestType: parseInteger(node.childText(NS.secDNS, 'digestType')) ?? 0,
    digest: node.childText(NS.secDNS, 'digest') ?? '',
  };
  const keyData = node.child(NS.secDNS, 'keyData');
  if (keyData) ds.keyData = parseKeyData(keyData);
  return ds;
}

function parseKeyData(node: XmlNode): KeyData {
  return {
    flags: parseInteger(node.childText(NS.secDNS, 'flags')) ?? 0,
    protocol: parseInteger(node.childText(NS.secDNS, 'protocol')) ?? 0,
    alg: parseInteger(node.childText(NS.secDNS, 'alg')) ?? 0,
    pubKey: (node.childText(NS.secDNS, 'pubKey') ?? '').replace(/\s+/g, ''),
  };
}
