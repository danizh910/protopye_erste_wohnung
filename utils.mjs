function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function calculateBudgetTotal(budget) {
  const monthlyBase = ["rent", "internet", "power", "insurance", "transport", "groceries"].reduce((sum, key) => sum + toNumber(budget[key]), 0);
  const monthlyCustom = (budget.customItems || []).reduce((sum, item) => sum + toNumber(item.amount), 0);
  const oneTimeTotal = (budget.oneTimeItems || []).reduce((sum, item) => sum + toNumber(item.amount), 0);

  return {
    monthlyTotal: monthlyBase + monthlyCustom,
    oneTimeTotal
  };
}

export function canCompleteDeposit(deposit) {
  const roommates = Array.isArray(deposit.roommates) ? deposit.roommates : [];
  if (!roommates.length) return false;
  const allReady = roommates.every((roommate) => roommate.status === "signed" && Boolean(roommate.email?.trim()) && Boolean(roommate.phone?.trim()));
  return toNumber(deposit.amount) > 0 && deposit.amountConfirmed && allReady;
}

export function calculateProgress(tasks) {
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length };
}
