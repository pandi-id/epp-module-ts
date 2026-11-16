import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import { RgpInfo, RgpRestoreReport, RgpStatement, RgpStatus, validateRestoreReport } from '../types/Rgp';
import { XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { toXsdDateTime } from '../mapping/Shared';

/**
 * `<rgp:update>` (RFC 3915 Section 4.2.5): a restore request, or the restore
 * report when `report` is given.
 */
export function buildRgpRestore(report?: RgpRestoreReport): XmlElement {
  return el(
    'rgp:update',
    { 'xmlns:rgp': NS.rgp },
    el('rgp:restore', { op: report ? 'report' : 'request' }, report ? reportElement(report) : undefined),
  );
}

/** `<rgp:infData>` or `<rgp:upData>` (RFC 3915 Sections 4.1.2 and 4.2.5). */
export function parseRgpInfo(node: XmlNode): RgpInfo {
  return {
    rgpStatus: node.all(NS.rgp, 'rgpStatus').map((status) => {
      const info: RgpInfo['rgpStatus'][number] = { s: (status.attr('s') ?? '') as RgpStatus };
      if (status.attr('lang')) info.lang = status.attr('lang');
      if (status.text) info.message = status.text;
      return info;
    }),
  };
}

function reportElement(report: RgpRestoreReport): XmlElement {
  const validation = validateRestoreReport(report);
  if (!validation.valid) throw new EppValidationError(`Invalid restore report: ${validation.errors.join('; ')}`);
  return el('rgp:report', null, [
    el('rgp:preData', null, report.preData),
    el('rgp:postData', null, report.postData),
    el('rgp:delTime', null, toXsdDateTime(report.delTime, 'delTime')),
    el('rgp:resTime', null, toXsdDateTime(report.resTime, 'resTime')),
    textElement('rgp:resReason', report.resReason),
    report.statement.map((statement) => textElement('rgp:statement', statement)),
    report.other !== undefined ? el('rgp:other', null, report.other) : undefined,
  ]);
}

function textElement(name: string, value: string | RgpStatement): XmlElement {
  return typeof value === 'string' ? el(name, null, value) : el(name, { lang: value.lang }, value.text);
}
