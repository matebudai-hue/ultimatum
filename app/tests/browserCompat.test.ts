import assert from 'node:assert/strict';
import { formatCreditInput, makeUuid, parseCreditInput } from '../src/browserCompat.ts';

assert.equal(parseCreditInput(''), '');
assert.equal(parseCreditInput('12 300'), 12_300);
assert.equal(parseCreditInput('12.300'), 12_300);
assert.equal(parseCreditInput('12,300'), 12_300);
assert.equal(parseCreditInput('abc5000xyz'), 5_000);

assert.equal(formatCreditInput(''), '');
assert.equal(formatCreditInput(0), '0');
assert.equal(formatCreditInput(999), '999');
assert.equal(formatCreditInput(1000), '1 000');
assert.equal(formatCreditInput(100000), '100 000');
assert.equal(formatCreditInput(1000000), '1 000 000');
assert.equal(parseCreditInput(formatCreditInput(100000)), 100_000);

const id = makeUuid();
assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

console.log('MOBILE BROWSER COMPATIBILITY TEST OK');
