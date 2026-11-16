import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { validateXML } from 'xmllint-wasm';

const SCHEMA_DIR = path.join(__dirname, '..', 'schemas');
const WRAPPER = 'epp-all.xsd';

const schema = { fileName: WRAPPER, contents: readFileSync(path.join(SCHEMA_DIR, WRAPPER), 'utf8') };
const preload = readdirSync(SCHEMA_DIR)
  .filter((file) => file.endsWith('.xsd') && file !== WRAPPER)
  .map((file) => ({ fileName: file, contents: readFileSync(path.join(SCHEMA_DIR, file), 'utf8') }));

/** Validate a document against the official EPP schemas; returns the errors (empty when valid). */
export async function validateEpp(xml: string): Promise<string[]> {
  const result = await validateXML({ xml: { fileName: 'document.xml', contents: xml }, schema, preload });
  return result.valid ? [] : result.errors.map((error) => error.message).filter((message) => !/Skipping import/.test(message));
}

/** Fail the test unless the document is valid against the official EPP schemas. */
export async function expectSchemaValid(xml: string): Promise<void> {
  const errors = await validateEpp(xml);
  if (errors.length > 0) {
    throw new Error(`Document is not schema-valid:\n  ${errors.join('\n  ')}\n\n${xml}`);
  }
}
