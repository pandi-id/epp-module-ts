/**
 * Run the read-only examples one after another, with the same environment.
 * The examples that create, transfer or delete objects are left out.
 *
 * Run: npm run example:all
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const EXAMPLES = ['basic-usage.ts', 'tls-tcp-connection.ts'];

let failed = 0;
for (const file of EXAMPLES) {
  console.log(`\n=== ${file} ===\n`);
  // Run each example under ts-node in a child process with the current environment.
  const result = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), path.join(__dirname, file)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failed++;
    console.error(`\n${file} failed (${result.error?.message ?? `exit code ${result.status ?? result.signal}`})`);
  }
}

console.log(`\n${EXAMPLES.length - failed} of ${EXAMPLES.length} examples succeeded`);
process.exitCode = failed > 0 ? 1 : 0;
