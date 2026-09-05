import { formatMoney } from '../../utils/commercialTotals.js'
import { hasPresentedOffers } from '../../living/offers.js'
import { OFFER_KIND_LABELS } from '../../models/offer.js'
import styles from './OfferDocument.module.css'

function OfferCard({ offer, currency }) {
  const label = offer.label?.trim()
  const title = offer.title?.trim() || 'Untitled option'
  const description = offer.description?.trim()
  const kindLabel = OFFER_KIND_LABELS[offer.kind] ?? 'Offer option'

  return (
    <article
      className={styles.card}
      data-offer-id={offer.id}
      data-offer-kind={offer.kind}
      data-offer-enabled={offer.enabled ? 'true' : 'false'}
      data-offer-selectable="false"
    >
      <div className={styles.cardHead}>
        <div className={styles.cardCopy}>
          {label ? <p className={styles.label}>{label}</p> : (
            <p className={styles.label}>{kindLabel}</p>
          )}
          <h5 className={styles.title}>{title}</h5>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <p className={styles.amount}>{formatMoney(offer.amount, currency)}</p>
      </div>
    </article>
  )
}

function OfferGroup({ title, hint, offers, currency, kind }) {
  if (!offers?.length) return null

  return (
    <section className={styles.group} data-offer-group={kind} aria-label={title}>
      <div className={styles.groupHead}>
        <h4 className={styles.groupTitle}>{title}</h4>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
      <div className={styles.grid}>
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} currency={currency} />
        ))}
      </div>
    </section>
  )
}

/**
 * Read-only presentation of authored offer groups.
 * No client selection controls. Disabled offers are omitted by the caller.
 */
function OfferDocument({
  offers,
  currency = 'USD',
  studioPreview = false,
}) {
  if (!hasPresentedOffers(offers)) return null

  return (
    <div
      className={styles.stack}
      data-living-offers="true"
      data-offer-interactive="false"
      data-studio-preview={studioPreview ? 'true' : 'false'}
    >
      {studioPreview ? (
        <p className={styles.banner}>
          Studio preview of authored offer choices. Clients cannot select these
          yet.
        </p>
      ) : (
        <p className={styles.banner}>
          Authored offer choices. Selection is not available on this proposal.
        </p>
      )}
      <OfferGroup
        kind="package"
        title="Offer options"
        hint="Named packages the studio authored for this proposal."
        offers={offers.packages}
        currency={currency}
      />
      <OfferGroup
        kind="addon"
        title="Optional add-ons"
        hint="Optional services that can be considered with the offer."
        offers={offers.addons}
        currency={currency}
      />
      <OfferGroup
        kind="alternative"
        title="Alternatives"
        hint="Alternative scopes the studio authored as choices."
        offers={offers.alternatives}
        currency={currency}
      />
    </div>
  )
}

export default OfferDocument
