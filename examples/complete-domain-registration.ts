/**
 * Complete domain registration: availability, price, contacts, the domain,
 * its glue hosts, delegation, and a final look at the result.
 *
 * This creates objects. Run it against your registry's OT&E environment.
 *
 * Run: npm run example:domain -- <domain>
 */

import { randomBytes } from 'crypto';
import { calculateTotalFees, EppClient, formatFeeAmount, generateAuthInfo, NS } from '../src';
import type { ContactCreateRequest, FeeSubmission, HostCreateRequest } from '../src';
import { exitWithUsage, run } from './config';

const USAGE = 'Usage: npm run example:domain -- <domain>\n  e.g. npm run example:domain -- example.tld';
const domain = process.argv[2] ?? exitWithUsage(USAGE, 'Missing the domain name to register.');
const PERIOD_YEARS = 1;

/**
 * A contact with internationalized ("int", 7-bit ASCII) postal info
 * (RFC 5733 Section 3.2.1). Contact IDs are unique registry-wide, so a
 * random suffix avoids 2302 "Object exists".
 */
function contact(role: string, name: string, suffix: string): ContactCreateRequest {
  return {
    id: `${role}-${suffix}`,
    postalInfo: {
      type: 'int',
      name,
      org: 'Example Corporation',
      addr: { street: ['Jl. Contoh No. 1'], city: 'Jakarta', sp: 'DKI Jakarta', pc: '10110', cc: 'ID' },
    },
    // E.164: "+", country code, ".", subscriber number (RFC 5733 Section 2.5).
    voice: '+62.215551234',
    email: `${role}@example.com`,
    authInfo: { pw: generateAuthInfo() },
    // Ask the server not to publish the phone number and email (RFC 5733
    // Section 2.9). Registries with a fixed privacy policy may answer 2102
    // or 2306; drop `disclose` there.
    disclose: { flag: 0, voice: true, email: true },
  };
}

async function main(client: EppClient): Promise<void> {
  // 1. Availability (RFC 5731 Section 3.1.1).
  const { data: check } = await client.domainCheck(domain);
  const availability = check?.[0];
  if (!availability?.available) {
    console.log(`${domain} is not available${availability?.reason ? `: ${availability.reason}` : ''}`);
    return;
  }
  console.log(`1. ${domain} is available`);

  // 2. Price, only when the fee extension was negotiated (RFC 8748 Section 5.1.1).
  let fee: FeeSubmission | undefined;
  if (client.getServices()?.extURIs.includes(NS.fee)) {
    const { data: quote } = await client.feeCheck({ domain, command: 'create', period: PERIOD_YEARS });
    const price = quote?.items[0]?.commands.find((command) => command.name === 'create');
    if (quote && price) {
      const total = formatFeeAmount(calculateTotalFees(price.fees));
      console.log(`2. Create price for ${PERIOD_YEARS} year(s): ${total} ${quote.currency}${price.standard ? '' : ' (premium)'}`);
      // A premium price must be accepted in the create command itself (RFC 8748 Section 5.2.1).
      if (!price.standard) fee = { currency: quote.currency, fees: price.fees };
    }
  } else {
    console.log('2. The server does not offer the fee extension; skipping the price check');
  }

  // 3. Registrant, admin and tech contacts (RFC 5733 Section 3.2.1).
  const suffix = randomBytes(3).toString('hex');
  const registrant = contact('reg', 'Example Registrant', suffix);
  const admin = contact('admin', 'Example Admin', suffix);
  const tech = contact('tech', 'Example Tech', suffix);
  for (const request of [registrant, admin, tech]) {
    const { data } = await client.contactCreate(request);
    console.log(`3. Contact ${data?.id ?? request.id} created`);
  }

  // 4. The domain (RFC 5731 Section 3.2.1). Glue hosts can only be created
  // once their superordinate domain exists (RFC 5732 Section 3.2.1), so the
  // name servers are added in step 6. Registries using host attributes
  // instead of host objects take them here: ns: { hostAttr: [...] }.
  const created = await client.domainCreate({
    name: domain,
    period: PERIOD_YEARS, // or { value: 12, unit: 'm' }
    registrant: registrant.id,
    contacts: [
      { type: 'admin', id: admin.id },
      { type: 'tech', id: tech.id },
    ],
    // The transfer code. RFC 9154 recommends strong random values.
    authInfo: { pw: generateAuthInfo() },
    fee,
  });
  console.log(`4. ${created.data?.name ?? domain} created ${created.data?.crDate ?? ''}, expires ${created.data?.exDate ?? '-'}`);
  const charged = created.extensions.fee;
  if (charged) {
    const balance = charged.balance ? `; balance ${charged.balance}` : '';
    console.log(`   charged ${formatFeeAmount(calculateTotalFees(charged.fees))} ${charged.currency ?? ''}${balance}`);
  }

  // 5. Glue hosts under the new domain, with IPv4 and IPv6 addresses
  // (RFC 5732 Section 3.2.1). Documentation addresses: RFC 5737, RFC 3849.
  const hosts: HostCreateRequest[] = [
    {
      name: `ns1.${domain}`,
      addr: [
        { ip: '192.0.2.1', type: 'v4' },
        { ip: '2001:db8::1', type: 'v6' },
      ],
    },
    // Plain strings work too; the IP version is detected.
    { name: `ns2.${domain}`, addr: ['198.51.100.1', '2001:db8::2'] },
  ];
  for (const host of hosts) {
    await client.hostCreate(host);
    console.log(`5. Host ${host.name} created`);
  }

  // 6. Delegate the domain to its hosts (RFC 5731 Section 3.2.5).
  await client.domainUpdate({ name: domain, add: { ns: hosts.map((host) => host.name) } });
  console.log('6. Name servers added');

  // 7. Check the result (RFC 5731 Section 3.1.2).
  const { data: info } = await client.domainInfo(domain);
  if (info) {
    console.log(`7. ${info.name}: status ${info.status.join(', ')}, expires ${info.exDate ?? '-'}`);
    console.log(`   registrant ${info.registrant ?? '-'}; ${info.contacts.map((c) => `${c.type} ${c.id}`).join(', ')}`);
    console.log(`   name servers ${info.ns?.hostObj?.join(', ') ?? '-'}; subordinate hosts ${info.hosts.join(', ') || '-'}`);
  }
}

void run(main);
