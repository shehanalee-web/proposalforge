import { PRICING_MODEL } from '../../models/service.js'
import { getIndustryLabel } from '../../models/industry.js'

const SHARED_TERMS =
  'This proposal is valid for 30 days from the issue date.\n\nA 40% deposit is due on acceptance, with the balance invoiced on delivery. Invoices are payable within 14 days.\n\nEach deliverable includes two rounds of consolidated feedback. Additional rounds are billed separately.'

const LEGACY_TEMPLATE_IDS = new Set([
  'tpl-architecture',
  'tpl-construction',
  'tpl-motion',
  'tpl-2001',
  'tpl-2002',
  'tpl-software',
  'tpl-catalogue',
])

/**
 * Flatten Industry → Category → Service seed into catalogue records.
 * New offerings only need an entry in the seed; Create Proposal reads these
 * arrays. Existing template ids are reused so the original seven packages
 * keep their richer documents.
 *
 * @param {object[]} industrySeeds
 */
export function buildCatalogue(industrySeeds) {
  const categories = []
  const services = []
  const templates = []
  let stamp = 0

  for (const industry of industrySeeds) {
    const industryId = industry.id
    const accent = industry.accent
    const icon = industry.icon

    for (const category of industry.categories ?? []) {
      const categoryId = category.id
      categories.push({
        id: categoryId,
        label: category.label,
        industryId,
        color: accent,
        icon,
      })

      for (const item of category.templates ?? []) {
        stamp += 1
        const createdAt = `2026-06-${String(10 + (stamp % 18)).padStart(2, '0')}T09:00:00.000Z`
        const updatedAt = `2026-08-${String(10 + (stamp % 18)).padStart(2, '0')}T09:00:00.000Z`
        const extraIndustries = Array.isArray(item.industries) ? item.industries : []
        const templateId = item.templateId || `tpl-${item.id}`
        const keywords = item.keywords ?? []
        const industryLabel = getIndustryLabel(industryId) || industryId
        const proposalSections = item.proposalSections ?? [
          'Scope of work',
          'Timeline',
          'Deliverables',
        ]
        const tags = [
          ...new Set(
            [
              ...(item.tags ?? []),
              category.label,
              industryLabel,
              item.pricingModel,
            ].filter(Boolean),
          ),
        ]

        services.push({
          id: item.id,
          name: item.name,
          subtitle: item.subtitle ?? '',
          description: item.description,
          defaultDescription: item.description,
          industry: industryId,
          industries: [...new Set([industryId, ...extraIndustries])],
          categoryId,
          keywords,
          tags,
          proposalSections,
          pricingModel: item.pricingModel ?? PRICING_MODEL.FIXED,
          deliverables: item.deliverables
            ? String(item.deliverables)
                .split(/[.;]\s+/)
                .map((part) => part.replace(/\.$/, '').trim())
                .filter(Boolean)
                .slice(0, 6)
            : [],
          typicalDuration: item.duration ?? '',
          assetIds: [],
          contentBlockIds: [],
          templateId,
          icon: item.icon ?? icon,
          accent: item.accent ?? accent,
          createdAt,
          updatedAt,
        })

        if (LEGACY_TEMPLATE_IDS.has(templateId)) continue

        templates.push({
          id: templateId,
          title: item.name,
          description: item.description,
          proposalType: item.id,
          isDefault: false,
          sections: [
            {
              id: `${templateId}-sec-1`,
              heading: 'Scope of work',
              body: item.scope,
            },
            {
              id: `${templateId}-sec-2`,
              heading: 'Timeline',
              body: item.timeline,
            },
            item.deliverables
              ? {
                  id: `${templateId}-sec-3`,
                  heading: 'Deliverables',
                  body: item.deliverables,
                }
              : null,
          ].filter(Boolean),
          items: (item.items ?? []).map((row, index) => ({
            id: `${templateId}-item-${index + 1}`,
            description: row[0],
            amount: row[1],
          })),
          terms: SHARED_TERMS,
          notes: `Prepared for a ${industryLabel.toLowerCase()} engagement. Confirm constraints, stakeholders and success criteria at kickoff.`,
          createdAt,
          updatedAt,
        })
      }
    }
  }

  return { categories, services, templates }
}
