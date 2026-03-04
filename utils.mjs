export function calculateBudgetTotal(budget) {
  return Number(budget.rent) + Number(budget.internet) + Number(budget.power) + Number(budget.insurance);
}

export function canCompleteDeposit(deposit) {
  return deposit.amountConfirmed && deposit.roommates.length >= 2 && deposit.roommates.every((r) => r.status === "signed");
}

export function calculateProgress(tasks) {
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length };
}
