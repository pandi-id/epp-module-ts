/**
 * Replace secrets in an EPP document with `***` before logging: login
 * passwords (`<pw>`, `<newPW>`, loginSec), authorization info
 * (`<domain:pw>`, `<contact:pw>`) and allocation tokens.
 */
export function redactXml(xml: string): string {
  return xml.replace(
    /(<((?:[\w.-]+:)?)(pw|newPW|allocationToken)(?:\s[^>]*)?>)[\s\S]*?(<\/\2\3>)/g,
    '$1***$4',
  );
}
