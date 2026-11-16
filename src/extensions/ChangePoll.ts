import { NS } from '../core/Namespaces';
import type { ChangePollData } from '../types/Common';
import { XmlNode } from '../xml/XmlReader';

/** `<changePoll:changeData>` (RFC 8590 Section 3). */
export function parseChangePoll(node: XmlNode): ChangePollData {
  const operation = node.child(NS.changePoll, 'operation');
  const data: ChangePollData = {
    state: node.attr('state') === 'before' ? 'before' : 'after',
    operation: operation?.text ?? '',
    date: node.childText(NS.changePoll, 'date') ?? '',
    svTRID: node.childText(NS.changePoll, 'svTRID') ?? '',
    who: node.childText(NS.changePoll, 'who') ?? '',
  };
  if (operation?.attr('op')) data.op = operation.attr('op');
  const caseId = node.child(NS.changePoll, 'caseId');
  if (caseId) {
    data.caseId = { id: caseId.text, type: caseId.attr('type') ?? '' };
    if (caseId.attr('name')) data.caseId.name = caseId.attr('name');
  }
  const reason = node.childText(NS.changePoll, 'reason');
  if (reason) data.reason = reason;
  return data;
}
