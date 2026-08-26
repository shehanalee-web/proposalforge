/**
 * Build line items from the proposal.
 *
 * Structured `items` are used when present so a future line-item editor can
 * feed this table without changing the PDF. Until then a single row is derived
 * from the proposal title, type and amount.
 */
export function getPricingRows(proposal) {
  const items = Array.isArray(proposal.items)
    ? proposal.items.filter(Boolean)
    : []

  if (items.length > 0) {
    return items.map((item, index) => ({
      id: item.id ?? `item-${index}`,
      description:
        item.description ??
        item.heading ??
        item.title ??
        `Item ${index + 1}`,
      amount: Number(item.amount) || 0,
    }))
  }

  return [
    {
      id: 'scope',
      description: proposal.projectType
        ? `${proposal.title} — ${proposal.projectType}`
        : proposal.title || 'Professional services',
      amount: Number(proposal.amount) || 0,
    },
  ]
}

export function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}
