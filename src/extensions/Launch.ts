import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type {
  LaunchCheck,
  LaunchCheckData,
  LaunchCreate,
  LaunchCreateData,
  LaunchIdContainer,
  LaunchInfoData,
  LaunchInfoRequest,
  LaunchPhase,
  LaunchStatus,
} from '../types/Launch';
import { parseBoolean, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { asArray, toXsdDateTime } from '../mapping/Shared';

/** `<launch:check>` (RFC 8334 Section 3.1). */
export function buildLaunchCheck(check: LaunchCheck): XmlElement {
  const type = check.type ?? 'claims';
  if (type === 'avail' && !check.phase) {
    throw new EppValidationError('A launch availability check needs a phase (RFC 8334 Section 3.1.2)');
  }
  return el(
    'launch:check',
    { 'xmlns:launch': NS.launch, type },
    check.phase ? phaseElement(check.phase, check.subPhase) : undefined,
  );
}

/** `<launch:info>` (RFC 8334 Section 3.2). */
export function buildLaunchInfo(info: LaunchInfoRequest): XmlElement {
  return el('launch:info', { 'xmlns:launch': NS.launch, includeMark: info.includeMark ? 'true' : undefined }, [
    phaseElement(info.phase, info.subPhase),
    info.applicationID !== undefined ? el('launch:applicationID', null, info.applicationID) : undefined,
  ]);
}

/**
 * `<launch:create>` (RFC 8334 Section 3.3): sunrise with encoded signed
 * marks or mark codes, and/or acceptance of trademark claims notices.
 */
export function buildLaunchCreate(create: LaunchCreate): XmlElement {
  const signedMarks = asArray(create.encodedSignedMark).map((smd) => smd.trim());
  const codeMarks = asArray(create.codeMark);
  const notices = asArray(create.notice);
  if (signedMarks.length && codeMarks.length) {
    throw new EppValidationError('Launch create: use either encodedSignedMark or codeMark, not both (RFC 8334 Section 3.3)');
  }
  if (signedMarks.some((smd) => smd === '')) throw new EppValidationError('Launch create: encodedSignedMark is empty');
  return el('launch:create', { 'xmlns:launch': NS.launch, type: create.type }, [
    phaseElement(create.phase, create.subPhase),
    codeMarks.map((mark) => el('launch:codeMark', null, el('launch:code', { validatorID: mark.validatorID }, mark.code))),
    signedMarks.map((smd) => el('smd:encodedSignedMark', { 'xmlns:smd': NS.signedMark }, smd)),
    notices.map((notice) =>
      el('launch:notice', null, [
        el('launch:noticeID', { validatorID: notice.validatorID }, notice.noticeID),
        el('launch:notAfter', null, toXsdDateTime(notice.notAfter, 'notice.notAfter')),
        el('launch:acceptedDate', null, toXsdDateTime(notice.acceptedDate, 'notice.acceptedDate')),
      ]),
    ),
  ]);
}

/** `<launch:update>` or `<launch:delete>` (RFC 8334 Sections 3.4 and 3.5). */
export function buildLaunchIdContainer(kind: 'update' | 'delete', container: LaunchIdContainer): XmlElement {
  if (!container.applicationID) throw new EppValidationError(`Launch ${kind}: applicationID is required`);
  return el(`launch:${kind}`, { 'xmlns:launch': NS.launch }, [
    phaseElement(container.phase, container.subPhase),
    el('launch:applicationID', null, container.applicationID),
  ]);
}

/** `<launch:chkData>` (RFC 8334 Section 3.1.1). */
export function parseLaunchCheck(node: XmlNode): LaunchCheckData {
  const data: LaunchCheckData = {
    ...parsePhase(node.child(NS.launch, 'phase')),
    results: node.all(NS.launch, 'cd').map((cd) => {
      const name = cd.child(NS.launch, 'name');
      return {
        name: name?.text ?? '',
        exists: parseBoolean(name?.attr('exists')) ?? false,
        claimKeys: cd.all(NS.launch, 'claimKey').map((key) => {
          const claimKey: { key: string; validatorID?: string } = { key: key.text };
          if (key.attr('validatorID')) claimKey.validatorID = key.attr('validatorID');
          return claimKey;
        }),
      };
    }),
  };
  return data;
}

/** `<launch:infData>` (RFC 8334 Section 3.1.4). */
export function parseLaunchInfo(node: XmlNode): LaunchInfoData {
  const phase = parsePhase(node.child(NS.launch, 'phase'));
  const data: LaunchInfoData = { phase: phase.phase ?? 'custom', marks: [] };
  if (phase.subPhase) data.subPhase = phase.subPhase;
  const applicationID = node.childText(NS.launch, 'applicationID');
  if (applicationID) data.applicationID = applicationID;
  const status = node.child(NS.launch, 'status');
  if (status) {
    data.status = { s: (status.attr('s') ?? '') as LaunchStatus };
    if (status.attr('name')) data.status.name = status.attr('name');
    if (status.attr('lang')) data.status.lang = status.attr('lang');
    if (status.text) data.status.message = status.text;
  }
  data.marks = node.children.filter((child) => child.namespace === NS.mark).map((mark) => mark.outerXml());
  return data;
}

/** `<launch:creData>` (RFC 8334 Section 3.3). */
export function parseLaunchCreate(node: XmlNode): LaunchCreateData {
  const phase = parsePhase(node.child(NS.launch, 'phase'));
  const data: LaunchCreateData = { phase: phase.phase ?? 'custom' };
  if (phase.subPhase) data.subPhase = phase.subPhase;
  const applicationID = node.childText(NS.launch, 'applicationID');
  if (applicationID) data.applicationID = applicationID;
  return data;
}

function phaseElement(phase: LaunchPhase, subPhase: string | undefined): XmlElement {
  if (phase === 'custom' && !subPhase) {
    throw new EppValidationError('A custom launch phase needs a subPhase name (RFC 8334 Section 2.3)');
  }
  return el('launch:phase', { name: subPhase }, phase);
}

function parsePhase(node: XmlNode | undefined): { phase?: LaunchPhase; subPhase?: string } {
  if (!node) return {};
  const result: { phase?: LaunchPhase; subPhase?: string } = { phase: node.text as LaunchPhase };
  if (node.attr('name')) result.subPhase = node.attr('name');
  return result;
}
