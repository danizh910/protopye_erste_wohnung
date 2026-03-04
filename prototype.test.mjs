import assert from 'node:assert/strict';
import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from './utils.mjs';

assert.deepEqual(calculateProgress([{status:'done'},{status:'open'},{status:'done'}]), {done:2,total:3});
assert.equal(calculateBudgetTotal({rent:800,internet:30,power:50,insurance:20}), 900);
assert.equal(canCompleteDeposit({amountConfirmed:true,roommates:[{status:'signed'},{status:'signed'}]}), true);
assert.equal(canCompleteDeposit({amountConfirmed:true,roommates:[{status:'signed'},{status:'open'}]}), false);

console.log('prototype tests passed');
