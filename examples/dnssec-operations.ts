/**
 * DNSSEC with the secDNS-1.1 extension (RFC 5910), DS data interface.
 *
 * A registry supports either the DS data interface (shown here) or the key
 * data interface (keyData: flags, protocol, alg, pubKey), not both
 * (RFC 5910 Section 4). The values below are placeholders: use the DS
 * records your DNS signer reports for the zone.
 *
 * Every scenario except "info" changes the domain. Use your registry's OT&E
 * environment.
 */

import { DNSSEC_ALGORITHMS, DNSSEC_DIGEST_TYPES, EppClient, generateAuthInfo, NS, validateDsData } from '../src';
import type { DsData } from '../src';
import { exitWithUsage, requireExtension, run, Scenario } from './config';

const USAGE = `Usage: npm run example:dnssec -- <scenario> [arguments]

  info [domain]                Show the domain's DNSSEC data (default)
  create <domain> <contactId>  Register a domain with a DS record
  add <domain>                 Add a DS record next to the current one
  rollover <domain>            Replace the current DS record with the next one in one update
  maxsiglife <domain> [secs]   Change the maximum signature lifetime (default 604800)
  remove <domain>              Remove all DNSSEC data`;

/** DS of the current key-signing key: ECDSA P-256 (13) with a SHA-256 digest (2). */
const DS_CURRENT: DsData = {
  keyTag: 55396,
  alg: 13,
  digestType: 2,
  digest: '508F5DD6FD96CF99FF890E10F86C757AAA49AD895A512A09BF4DEFE5888C78A2',
};

/** DS of the next key-signing key, for the rollover. */
const DS_NEXT: DsData = {
  keyTag: 39794,
  alg: 13,
  digestType: 2,
  digest: '0C43BCEF7B66F38C3524A7D03940AB5AFB547DFAE442B4EA41471C69CC1C777C',
};

const ALGORITHMS: Record<number, string> = DNSSEC_ALGORITHMS;
const DIGEST_TYPES: Record<number, string> = DNSSEC_DIGEST_TYPES;

/** DNSSEC data arrives in `extensions.secDNS` of a domain info response (RFC 5910 Section 5.1.2). */
async function info(client: EppClient, domain: string): Promise<void> {
  const { extensions } = await client.domainInfo(domain);
  const secDNS = extensions.secDNS;
  if (!secDNS || (!secDNS.dsData?.length && !secDNS.keyData?.length)) {
    console.log(`${domain}: no DNSSEC data`);
    return;
  }
  console.log(`${domain}:`);
  if (secDNS.maxSigLife !== undefined) console.log(`  maxSigLife ${secDNS.maxSigLife} s`);
  for (const ds of secDNS.dsData ?? []) {
    const names = `${ALGORITHMS[ds.alg] ?? 'unknown algorithm'}, ${DIGEST_TYPES[ds.digestType] ?? 'unknown digest'}`;
    console.log(`  DS ${ds.keyTag} ${ds.alg} ${ds.digestType} ${ds.digest} (${names})`);
  }
  for (const key of secDNS.keyData ?? []) {
    console.log(`  DNSKEY ${key.flags} ${key.protocol} ${key.alg} ${key.pubKey.slice(0, 32)}...`);
  }
}

/**
 * Create a domain with DNSSEC data (RFC 5910 Section 5.2.1). Some
 * registries accept DS records only for delegated domains; add `ns` with
 * existing hosts there.
 */
async function create(client: EppClient, domain: string, contactId: string): Promise<void> {
  // The client validates DS data before sending; validateDsData() lets you
  // check user input earlier, e.g. in a form.
  if (!validateDsData(DS_CURRENT)) throw new Error('DS_CURRENT is not valid DS data');
  const res = await client.domainCreate({
    name: domain,
    period: 1,
    registrant: contactId,
    contacts: [
      { type: 'admin', id: contactId },
      { type: 'tech', id: contactId },
    ],
    authInfo: { pw: generateAuthInfo() },
    dnssec: { dsData: [DS_CURRENT] },
  });
  console.log(`Created ${res.data?.name ?? domain}: ${res.code} ${res.message}`);
}

/** Add a DS record, e.g. to pre-publish the next key (RFC 5910 Section 5.2.5). */
async function add(client: EppClient, domain: string): Promise<void> {
  await client.domainUpdate({ name: domain, dnssec: { add: { dsData: [DS_NEXT] } } });
  console.log(`Added DS ${DS_NEXT.keyTag}`);
}

/**
 * Key rollover in one update: the server applies `rem` before `add`
 * (RFC 5910 Section 5.2.5). Swap the DS only after the new key has been in
 * the zone's DNSKEY set long enough for resolvers to see it (RFC 6781
 * Section 4.1.2). `rem` must match the existing record exactly. Add
 * `urgent: true` to ask for priority handling, where the registry supports it.
 */
async function rollover(client: EppClient, domain: string): Promise<void> {
  await client.domainUpdate({
    name: domain,
    dnssec: {
      rem: { dsData: [DS_CURRENT] },
      add: { dsData: [DS_NEXT] },
    },
  });
  console.log(`Replaced DS ${DS_CURRENT.keyTag} with DS ${DS_NEXT.keyTag}`);
}

/** Change the maximum signature lifetime. Registries that ignore it answer 2102. */
async function changeMaxSigLife(client: EppClient, domain: string, seconds: number): Promise<void> {
  await client.domainUpdate({ name: domain, dnssec: { chg: { maxSigLife: seconds } } });
  console.log(`maxSigLife set to ${seconds} s`);
}

/** Remove all DNSSEC data: the parent stops publishing DS records, so validators treat the zone as unsigned. */
async function removeAll(client: EppClient, domain: string): Promise<void> {
  await client.domainUpdate({ name: domain, dnssec: { rem: { all: true } } });
  console.log('Removed all DNSSEC data');
}

/** Run a change, then show the domain's DNSSEC data. */
function change(domain: string, action: (client: EppClient) => Promise<void>): Scenario {
  return async (client) => {
    requireExtension(client, NS.secDNS, 'DNSSEC (RFC 5910)');
    await action(client);
    await info(client, domain);
  };
}

function need(value: string | undefined, what: string): string {
  return value ?? exitWithUsage(USAGE, `Missing ${what}.`);
}

/** Parse the command line before connecting, so usage errors cost no session. */
function selectScenario(): Scenario {
  const [name = 'info', domain, extra] = process.argv.slice(2);
  switch (name) {
    case 'info': {
      const target = domain ?? 'example.tld';
      return async (client) => {
        requireExtension(client, NS.secDNS, 'DNSSEC (RFC 5910)');
        await info(client, target);
      };
    }
    case 'create': {
      const target = need(domain, 'domain');
      const contactId = need(extra, 'contactId');
      return change(target, (client) => create(client, target, contactId));
    }
    case 'add': {
      const target = need(domain, 'domain');
      return change(target, (client) => add(client, target));
    }
    case 'rollover': {
      const target = need(domain, 'domain');
      return change(target, (client) => rollover(client, target));
    }
    case 'maxsiglife': {
      const target = need(domain, 'domain');
      const seconds = Number(extra ?? 604800);
      if (!Number.isInteger(seconds) || seconds < 1) exitWithUsage(USAGE, 'secs must be a positive whole number.');
      return change(target, (client) => changeMaxSigLife(client, target, seconds));
    }
    case 'remove': {
      const target = need(domain, 'domain');
      return change(target, (client) => removeAll(client, target));
    }
    default:
      return exitWithUsage(USAGE, `Unknown scenario "${name}".`);
  }
}

void run(selectScenario());
