import assert from "node:assert/strict";
import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from "./utils.mjs";

assert.deepEqual(calculateProgress([{ status: "done" }, { status: "open" }, { status: "done" }]), { done: 2, total: 3 });

assert.deepEqual(
  calculateBudgetTotal({
    rent: 800,
    internet: 30,
    power: 50,
    insurance: 20,
    transport: 70,
    groceries: 220,
    customItems: [{ amount: 40 }, { amount: 10 }],
    oneTimeItems: [{ amount: 500 }]
  }),
  { monthlyTotal: 1240, oneTimeTotal: 500 }
);

assert.equal(canCompleteDeposit({ amount: 2400, amountConfirmed: true, roommates: [{ status: "open" }] }), true);
assert.equal(canCompleteDeposit({ amount: 0, amountConfirmed: true, roommates: [{ status: "signed" }] }), false);
assert.equal(canCompleteDeposit({ amount: 2400, amountConfirmed: false, roommates: [{ status: "signed" }] }), false);

console.log("prototype tests passed");
