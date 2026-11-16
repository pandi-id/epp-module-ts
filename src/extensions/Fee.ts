import { EppValidationError } from '../core/Errors';
import { NS } from '../core/Namespaces';
import type { Period } from '../types/Common';
import type {
  Fee,
  FeeCheckCommand,
  FeeCheckData,
  FeeCheckExtension,
  FeeCommandName,
  FeeCommandResult,
  FeeCredit,
  FeeSubmission,
  FeeTransformData,
} from '../types/Fee';
import { parseBoolean, parseInteger, XmlNode } from '../xml/XmlReader';
import { el, XmlElement } from '../xml/XmlWriter';
import { periodElement, requireNonEmpty } from '../mapping/Shared';

const DECIMAL = /^\+?(\d+(\.\d*)?|\.\d+)$/;

/** `<fee:check>` (RFC 8748 Section 5.1.1). */
export function buildFeeCheck(check: FeeCheckExtension): XmlElement {
  const commands = requireNonEmpty(check.commands, 'fee check command').map((command) =>
    typeof command === 'string' ? { name: command } : command,
  );
  return el('fee:check', { 'xmlns:fee': NS.fee }, [
    check.currency !== undefined ? el('fee:currency', null, currency(check.currency)) : undefined,
    commands.map((command: FeeCheckCommand) => {
      if (command.name === 'custom' && !command.customName) {
        throw new EppValidationError('A custom fee command needs customName (RFC 8748 Section 3.1)');
      }
      return el(
        'fee:command',
        { name: command.name, customName: command.customName, phase: command.phase, subphase: command.subphase },
        periodElement('fee:period', command.period),
      );
    }),
  ]);
}

/**
 * Fee submission for a transform command (RFC 8748 Section 5.2). A restore
 * is an update with the RGP extension, so it uses `<fee:update>`.
 */
export function buildFeeTransform(kind: 'create' | 'renew' | 'transfer' | 'update', submission: FeeSubmission): XmlElement {
  let fees: Fee[];
  if (submission.fees && submission.fees.length > 0) {
    fees = submission.fees;
  } else if (submission.amount !== undefined) {
    fees = [{ fee: String(submission.amount) }];
  } else {
    throw new EppValidationError('A fee submission needs amount or fees');
  }
  return el(`fee:${kind}`, { 'xmlns:fee': NS.fee }, [
    submission.currency !== undefined ? el('fee:currency', null, currency(submission.currency)) : undefined,
    fees.map(feeElement),
  ]);
}

/** `<fee:chkData>` (RFC 8748 Section 5.1.1). */
export function parseFeeCheck(node: XmlNode): FeeCheckData {
  return {
    currency: node.childText(NS.fee, 'currency') ?? '',
    items: node.all(NS.fee, 'cd').map((cd) => {
      const item: FeeCheckData['items'][number] = {
        objID: cd.childText(NS.fee, 'objID') ?? '',
        available: parseBoolean(cd.attr('avail')) ?? true,
        commands: cd.all(NS.fee, 'command').map(parseCommand),
      };
      const feeClass = cd.childText(NS.fee, 'class');
      if (feeClass) item.class = feeClass;
      const reason = cd.childText(NS.fee, 'reason');
      if (reason) item.reason = reason;
      return item;
    }),
  };
}

/** `<fee:creData>`, `<fee:renData>`, `<fee:trnData>`, `<fee:updData>`, `<fee:delData>` (RFC 8748 Section 5.2). */
export function parseFeeTransform(node: XmlNode): FeeTransformData {
  const data: FeeTransformData = {
    fees: node.all(NS.fee, 'fee').map(parseFee),
    credits: node.all(NS.fee, 'credit').map(parseCredit),
  };
  const currencyCode = node.childText(NS.fee, 'currency');
  if (currencyCode) data.currency = currencyCode;
  const period = parsePeriod(node.child(NS.fee, 'period'));
  if (period) data.period = period;
  const balance = node.childText(NS.fee, 'balance');
  if (balance) data.balance = balance;
  const creditLimit = node.childText(NS.fee, 'creditLimit');
  if (creditLimit) data.creditLimit = creditLimit;
  return data;
}

function feeElement(fee: Fee): XmlElement {
  if (!DECIMAL.test(fee.fee)) throw new EppValidationError(`Fee amount must be a non-negative decimal, got ${JSON.stringify(fee.fee)}`);
  return el(
    'fee:fee',
    {
      description: fee.description,
      lang: fee.lang,
      refundable: fee.refundable === undefined ? undefined : fee.refundable ? '1' : '0',
      'grace-period': fee.gracePeriod,
      applied: fee.applied,
    },
    fee.fee,
  );
}

function currency(code: string): string {
  if (!/^[A-Z]{3}$/.test(code)) throw new EppValidationError(`Currency must be a three-letter ISO 4217 code, got ${JSON.stringify(code)}`);
  return code;
}

function parseCommand(node: XmlNode): FeeCommandResult {
  const result: FeeCommandResult = {
    name: (node.attr('name') ?? '') as FeeCommandName,
    standard: parseBoolean(node.attr('standard')) ?? false,
    fees: node.all(NS.fee, 'fee').map(parseFee),
    credits: node.all(NS.fee, 'credit').map(parseCredit),
  };
  for (const key of ['customName', 'phase', 'subphase'] as const) {
    const value = node.attr(key);
    if (value !== undefined) result[key] = value;
  }
  const period = parsePeriod(node.child(NS.fee, 'period'));
  if (period) result.period = period;
  const reason = node.childText(NS.fee, 'reason');
  if (reason) result.reason = reason;
  return result;
}

function parseFee(node: XmlNode): Fee {
  const fee: Fee = { fee: node.text };
  if (node.attr('description') !== undefined) fee.description = node.attr('description');
  if (node.attr('lang') !== undefined) fee.lang = node.attr('lang');
  const refundable = parseBoolean(node.attr('refundable'));
  if (refundable !== undefined) fee.refundable = refundable;
  if (node.attr('grace-period') !== undefined) fee.gracePeriod = node.attr('grace-period');
  const applied = node.attr('applied');
  if (applied === 'immediate' || applied === 'delayed') fee.applied = applied;
  return fee;
}

function parseCredit(node: XmlNode): FeeCredit {
  const credit: FeeCredit = { amount: node.text };
  if (node.attr('description') !== undefined) credit.description = node.attr('description');
  if (node.attr('lang') !== undefined) credit.lang = node.attr('lang');
  return credit;
}

function parsePeriod(node: XmlNode | undefined): Period | undefined {
  if (!node) return undefined;
  const value = parseInteger(node.text);
  if (value === undefined) return undefined;
  return { value, unit: node.attr('unit') === 'm' ? 'm' : 'y' };
}
