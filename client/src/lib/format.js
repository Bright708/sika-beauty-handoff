// Prices always as "GH₵ 1,050": cedi sign, space, comma thousands, no decimals.
export const formatGHS = (amount) =>
  `GH₵ ${Math.round(Number(amount) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
