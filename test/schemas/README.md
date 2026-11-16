# Test schemas

The test suite validates every command the client generates, and every
response fixture, against these schemas.

| File | Source | Specification |
|------|--------|---------------|
| `epp-1.0.xsd`, `eppcom-1.0.xsd` | IANA XML registry | RFC 5730 |
| `domain-1.0.xsd` | IANA XML registry | RFC 5731 |
| `host-1.0.xsd` | IANA XML registry | RFC 5732 |
| `contact-1.0.xsd` | IANA XML registry | RFC 5733 |
| `secDNS-1.1.xsd` | IANA XML registry | RFC 5910 |
| `rgp-1.0.xsd` | IANA XML registry | RFC 3915 |
| `launch-1.0.xsd` | IANA XML registry | RFC 8334 |
| `mark-1.0.xsd`, `signedMark-1.0.xsd` | IANA XML registry | RFC 7848 |
| `fee-1.0.xsd` | IANA XML registry (`epp/fee-1.0.xsd`) | RFC 8748 |
| `loginSec-1.0.xsd` | IANA XML registry (`epp/loginSec-1.0.xsd`) | RFC 8807 |
| `changePoll-1.0.xsd` | IANA XML registry | RFC 8590 |
| `allocationToken-1.0.xsd` | IANA XML registry | RFC 8495 |
| `xmldsig-core-schema.xsd` | W3C | XML Signature (imported by `signedMark-1.0.xsd`) |
| `epp-all.xsd` | this project | test-only wrapper that imports all of the above |

The IANA schemas are code components of IETF RFCs, available under the
Simplified BSD License described in the IETF Trust Legal Provisions. The XML
Signature schema is Copyright The Internet Society and W3C, under the W3C
Software and Document License.

All files are unmodified copies, except `xmldsig-core-schema.xsd`: its
DOCTYPE declaration was removed so that the validator does not try to fetch
the external DTD it references.

These files are used only by the tests and are not part of the npm package.
