/**
 * ICANN gTLD workflows built on EPP extensions:
 *
 *   fee           Registry Fee (RFC 8748): price check, premium registration
 *   claims        Launch Phase (RFC 8334) claims check, registration with a TMCH notice
 *   sunrise       Launch Phase sunrise registration with a signed mark (RFC 7848, RFC 9361)
 *   restore       Registry Grace Period (RFC 3915) restore request and report
 *   registry-ext  A registry-specific extension built with el()
 *
 * fee, claims and registry-ext only read unless you pass the arguments for a
 * create. Use your registry's OT&E environment.
 */

import { readFileSync } from 'fs';
import {
  calculateTotalFees,
  canRestore,
  el,
  EppClient,
  EppValidationError,
  extractEncodedSmd,
  formatFeeAmount,
  generateAuthInfo,
  NS,
  parseSmdFile,
  serializeXml,
  toUnicodeDomain,
  validateRestoreReport,
  verifyTcnId,
} from '../src';
import type { DomainCreateRequest, DomainInfo, EppConfig, LaunchNotice, RgpRestoreReport, SmdFile } from '../src';
import { exitWithUsage, requireExtension, run, Scenario } from './config';

const USAGE = `Usage: npm run example:extensions -- <scenario> [arguments]

  fee [domain] [contactId]                 Price check (default); registers at the quoted price when a contact is given
  claims [domain] [contactId noticeID notAfter [acceptedDate]]
                                           Claims check; registers with the accepted notice when its details are given
  sunrise <smd-file> <domain> <contactId>  Sunrise registration with a TMCH signed mark
  restore <domain> [delTime]               Restore a deleted domain from its redemption period
  registry-ext [domain]                    Domain check with a registry-specific extension`;

/** Namespace of a registry-specific extension. Replace it and the elements below with your registry's. */
const REGISTRY_EXT_URI = 'urn:example:params:xml:ns:regext-1.0';

/** The registrant and contacts of the creates below: one contact in every role. */
function holder(contactId: string): Pick<DomainCreateRequest, 'registrant' | 'contacts'> {
  return {
    registrant: contactId,
    contacts: [
      { type: 'admin', id: contactId },
      { type: 'tech', id: contactId },
    ],
  };
}

// ============================================================================
// Registry Fee extension (RFC 8748)
// ============================================================================

/**
 * Price several commands in one check (RFC 8748 Section 5.1.1), then
 * register at the quoted price. A premium name has a non-standard price,
 * and servers refuse to create it unless the create carries the fee the
 * client agrees to pay (RFC 8748 Section 5.2.1).
 */
async function fee(client: EppClient, domain: string, contactId?: string): Promise<void> {
  requireExtension(client, NS.fee, 'Registry Fee (RFC 8748)');
  const { data: quote } = await client.feeCheck({ domain, command: ['create', 'renew', 'transfer', 'restore'], period: 1 });
  const item = quote?.items[0];
  if (!quote || !item) throw new Error('The server returned no fee data');
  console.log(`${item.objID}${item.class ? ` (class "${item.class}")` : ''}, prices in ${quote.currency}:`);
  if (!item.available) {
    console.log(`  cannot be priced: ${item.reason ?? 'no reason given'}`);
    return;
  }
  for (const command of item.commands) {
    const period = command.period ? ` ${command.period.value}${command.period.unit}` : '';
    const premium = command.standard ? '' : ' (premium)';
    console.log(`  ${command.name}${period}: ${formatFeeAmount(calculateTotalFees(command.fees))}${premium}`);
    for (const part of command.fees) console.log(`    ${part.fee}${part.description ? ` ${part.description}` : ''}`);
  }

  if (!contactId) {
    console.log('\nPass a contact ID to register the domain at this price.');
    return;
  }
  const create = item.commands.find((command) => command.name === 'create');
  if (!create) throw new Error('The server did not price the create command');
  const created = await client.domainCreate({
    name: domain,
    period: 1,
    ...holder(contactId),
    authInfo: { pw: generateAuthInfo() },
    fee: { currency: quote.currency, amount: formatFeeAmount(calculateTotalFees(create.fees)) },
  });
  console.log(`\nCreated ${created.data?.name ?? domain}: ${created.code} ${created.message}`);
  // What the server charged, and the account balance, when it reports them (fee:creData).
  const charged = created.extensions.fee;
  if (charged) {
    const balance = charged.balance ? `; balance ${charged.balance}` : '';
    console.log(`  charged ${formatFeeAmount(calculateTotalFees(charged.fees))} ${charged.currency ?? quote.currency}${balance}`);
  }
}

// ============================================================================
// Trademark claims (RFC 8334, RFC 9361)
// ============================================================================

/**
 * During a claims period, registering a name that matches a mark in the
 * Trademark Clearinghouse (TMCH) requires the registrant to accept a claims
 * notice first. The claims check (RFC 8334 Section 3.1.1) returns the claim
 * key; fetch the notice from the TMCH with it, show it to the registrant,
 * and record when they accepted it.
 */
async function claims(client: EppClient, domain: string, contactId?: string, notice?: LaunchNotice): Promise<void> {
  requireExtension(client, NS.launch, 'Launch Phase (RFC 8334)');
  const { extensions } = await client.domainCheck(domain, { launch: { type: 'claims', phase: 'claims' } });
  const result = extensions.launchCheck?.results.find((r) => r.name.toLowerCase() === domain.toLowerCase());
  if (!result?.exists) {
    console.log(`${domain}: no trademark claim; register it without a notice`);
    return;
  }
  console.log(`${domain}: a trademark claim exists`);
  for (const claimKey of result.claimKeys) {
    console.log(`  claim key ${claimKey.key} (validator ${claimKey.validatorID ?? 'tmch'})`);
  }
  if (!contactId || !notice) {
    console.log('\nPass contactId, noticeID, notAfter (and acceptedDate) of the accepted notice to register the name.');
    return;
  }

  // Registries check that the notice ID (TCNID) matches the label and the
  // notice expiry, and reject expired notices; check both before sending.
  if (!verifyTcnId(notice.noticeID, domain, notice.notAfter)) {
    throw new EppValidationError(`Notice ${notice.noticeID} does not belong to ${domain} with expiry ${String(notice.notAfter)}`);
  }
  if (new Date(notice.notAfter).getTime() < Date.now()) {
    throw new EppValidationError('The claims notice has expired; fetch a new one from the TMCH');
  }
  const created = await client.domainCreate({
    name: domain,
    period: 1,
    ...holder(contactId),
    authInfo: { pw: generateAuthInfo() },
    launch: { phase: 'claims', notice },
  });
  console.log(`Created ${created.data?.name ?? domain}: ${created.code} ${created.message}`);
}

// ============================================================================
// Sunrise (RFC 8334, RFC 7848, RFC 9361)
// ============================================================================

/**
 * Read a TMCH Signed Mark Data file. Complete files start with header lines
 * (Marks, smdID, U-labels, notBefore, notAfter) before the encoded block;
 * files holding only the encoded block have nothing else to check.
 */
function readSmd(path: string): { encodedSignedMark: string; header?: SmdFile } {
  const content = readFileSync(path, 'utf8');
  if (!/^\s*smdID:/m.test(content)) return { encodedSignedMark: extractEncodedSmd(content) };
  const header = parseSmdFile(content);
  return { encodedSignedMark: header.encodedSignedMark, header };
}

/**
 * Trademark holders register before general availability by presenting the
 * signed mark from their SMD file (RFC 8334 Section 3.3).
 */
async function sunrise(client: EppClient, smdPath: string, domain: string, contactId: string): Promise<void> {
  requireExtension(client, NS.launch, 'Launch Phase (RFC 8334)');
  const { encodedSignedMark, header } = readSmd(smdPath);
  if (header) {
    console.log(`SMD ${header.smdID}: ${header.marks}`);
    console.log(`  labels ${header.uLabels.join(', ')}; valid from ${header.notBefore} to ${header.notAfter}`);
    const label = toUnicodeDomain(domain).split('.')[0];
    if (!header.uLabels.includes(label)) throw new EppValidationError(`The SMD does not cover the label "${label}"`);
    const now = Date.now();
    if (now < Date.parse(header.notBefore) || now > Date.parse(header.notAfter)) {
      throw new EppValidationError('The SMD is not valid at this time');
    }
  }
  const res = await client.domainCreate({
    name: domain,
    period: 1,
    ...holder(contactId),
    authInfo: { pw: generateAuthInfo() },
    // Add type: 'application' or 'registration' if the registry asks for one.
    launch: { phase: 'sunrise', encodedSignedMark },
  });
  // 1001 usually means an application that awaits validation or allocation.
  console.log(`Sunrise create: ${res.code} ${res.message}`);
  const application = res.extensions.launchCreate;
  if (application?.applicationID) console.log(`  application ${application.applicationID} (phase ${application.phase})`);
}

// ============================================================================
// Registry Grace Period restore (RFC 3915)
// ============================================================================

/** A plain-text copy of the registration data, for the restore report. */
function registrationData(domain: string, info: DomainInfo | undefined): string {
  if (!info) return `Domain: ${domain}`;
  return [
    `Domain: ${info.name}`,
    `Registrant: ${info.registrant ?? '-'}`,
    ...info.contacts.map((contact) => `Contact (${contact.type}): ${contact.id}`),
    `Name servers: ${info.ns?.hostObj?.join(', ') ?? '-'}`,
    `Expires: ${info.exDate ?? '-'}`,
  ].join('\n');
}

/**
 * A deleted domain spends a redemption period before it is purged. The
 * sponsoring registrar restores it with a restore request, then a restore
 * report while the domain is pendingRestore (RFC 3915 Section 4.2.5).
 * Registries that charge for restores may also want `fee` in both calls.
 */
async function restore(client: EppClient, domain: string, delTime?: string): Promise<void> {
  requireExtension(client, NS.rgp, 'Registry Grace Period (RFC 3915)');
  const { data: info, extensions } = await client.domainInfo(domain);
  const statuses = extensions.rgp?.rgpStatus.map((status) => status.s) ?? [];
  console.log(`${domain}: RGP status ${statuses.join(', ') || 'none'}`);
  if (!statuses.some(canRestore)) {
    console.log('Only a domain in redemptionPeriod can be restored');
    return;
  }
  // The registrar's own record of the delete is best; upDate is usually the delete.
  const deleted = delTime ?? info?.upDate;
  if (!deleted) throw new EppValidationError('Pass the deletion time (delTime): the server did not return upDate');

  // 1. Restore request.
  const requested = await client.domainRestore(domain);
  const rgpNow = requested.extensions.rgp?.rgpStatus.map((status) => status.s).join(', ');
  console.log(`Restore requested: ${requested.code} ${requested.message}${rgpNow ? `; RGP status ${rgpNow}` : ''}`);

  // 2. Restore report, with the two statements RFC 3915 requires.
  const data = registrationData(domain, info);
  const report: RgpRestoreReport = {
    preData: data,
    postData: data,
    delTime: deleted,
    resTime: new Date(),
    resReason: 'Registrant error: the domain was deleted by mistake.',
    statement: [
      'This registrar has not restored the Registered Name in order to assume the rights to use or sell the Registered Name for itself or for any third party.',
      "The information in this report is true to best of this registrar's knowledge, and this registrar acknowledges that intentionally supplying false information in this report shall constitute an incurable material breach of the Registry-Registrar Agreement.",
    ],
    other: 'Supporting information, such as the registrant request, goes here.',
  };
  // The client validates the report too; checking first gives every problem at once.
  const validation = validateRestoreReport(report);
  if (!validation.valid) throw new EppValidationError(`Invalid restore report: ${validation.errors.join('; ')}`);
  const reported = await client.domainRestore(domain, { report });
  console.log(`Restore report: ${reported.code} ${reported.message}`);
}

// ============================================================================
// Registry-specific extension (RFC 5730 Section 2.7.3)
// ============================================================================

/**
 * Commands take extra extension elements in `extensions`, built with el().
 * Each element must declare its namespace (xmlns:prefix): the client reads
 * it to check that the URI was announced at login. Response extensions the
 * client does not interpret arrive as raw XML in `extensions.unknown`.
 */
async function registryExtension(client: EppClient, domain: string): Promise<void> {
  const extension = el('regext:check', { 'xmlns:regext': REGISTRY_EXT_URI }, [el('regext:category', null, 'premium')]);
  console.log(`Extension element: ${serializeXml(extension, { declaration: false })}`);
  if (!client.getGreeting()?.extURIs.includes(REGISTRY_EXT_URI)) {
    console.log(`The server does not offer ${REGISTRY_EXT_URI}; use an extension your registry lists in its greeting.`);
    return;
  }
  const { data, extensions } = await client.domainCheck(domain, { extensions: [extension] });
  for (const result of data ?? []) console.log(`  ${result.name}: ${result.available ? 'available' : 'not available'}`);
  for (const xml of extensions.unknown ?? []) console.log(`  extension data: ${xml}`);
}

// ============================================================================
// Command line
// ============================================================================

function need(value: string | undefined, what: string): string {
  return value ?? exitWithUsage(USAGE, `Missing ${what}.`);
}

/** Parse the command line before connecting, so usage errors cost no session. */
function selectScenario(): { main: Scenario; config?: Partial<EppConfig> } {
  const [name = 'fee', ...args] = process.argv.slice(2);
  switch (name) {
    case 'fee': {
      const [domain = 'example.tld', contactId] = args;
      return { main: (client) => fee(client, domain, contactId) };
    }
    case 'claims': {
      const [domain = 'example.tld', contactId, noticeID, notAfter, acceptedDate] = args;
      if (contactId && (!noticeID || !notAfter)) exitWithUsage(USAGE, 'Registering needs contactId, noticeID and notAfter.');
      // acceptedDate defaults to now; record the real acceptance time in production.
      const notice: LaunchNotice | undefined =
        noticeID && notAfter ? { noticeID, validatorID: 'tmch', notAfter, acceptedDate: acceptedDate ?? new Date() } : undefined;
      return { main: (client) => claims(client, domain, contactId, notice) };
    }
    case 'sunrise': {
      const [smdPath, domain, contactId] = args;
      const file = need(smdPath, 'smd-file');
      const target = need(domain, 'domain');
      const contact = need(contactId, 'contactId');
      return { main: (client) => sunrise(client, file, target, contact) };
    }
    case 'restore': {
      const [domain, delTime] = args;
      const target = need(domain, 'domain');
      return { main: (client) => restore(client, target, delTime) };
    }
    case 'registry-ext': {
      const [domain = 'example.tld'] = args;
      return {
        main: (client) => registryExtension(client, domain),
        // The URI must be announced at login. additionalExtURIs adds it to the
        // extensions negotiated from the greeting when the server offers it.
        config: { additionalExtURIs: [REGISTRY_EXT_URI] },
      };
    }
    default:
      return exitWithUsage(USAGE, `Unknown scenario "${name}".`);
  }
}

const { main, config } = selectScenario();
void run(main, config);
