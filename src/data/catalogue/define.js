/**
 * Seed helpers for Industry → Category → Service Template entries.
 * Future catalogue growth only needs new seed objects, not new helpers.
 */

export function industry(id, accent, icon, categories) {
  return { id, accent, icon, categories }
}

export function cat(id, label, templates) {
  return { id, label, templates }
}

export function tpl(
  id,
  name,
  subtitle,
  description,
  duration,
  pricingModel,
  keywords,
  scope,
  timeline,
  deliverables,
  items,
  extra = {},
) {
  return {
    id,
    name,
    subtitle,
    description,
    duration,
    pricingModel,
    keywords,
    scope,
    timeline,
    deliverables,
    items,
    ...extra,
  }
}
