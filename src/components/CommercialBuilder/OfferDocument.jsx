import { formatMoney } from '../../utils/commercialTotals.js'
import { hasPresentedOffers } from '../../living/offers.js'
import { OFFER_KIND, OFFER_KIND_LABELS } from '../../models/offer.js'
import { useLivingSessionOptional } from '../../living/LivingSessionContext.js'
import styles from './OfferDocument.module.css'

function OfferCard({
  offer,
  currency,
  selectable,
  selected,
  exclusive,
  onSelect,
  disabled,
}) {
  const label = offer.label?.trim()
  const title = offer.title?.trim() || 'Untitled option'
  const description = offer.description?.trim()
  const kindLabel = OFFER_KIND_LABELS[offer.kind] ?? 'Offer option'
  const inputId = `offer-${offer.kind}-${offer.id}`

  const body = (
    <>
      <div className={styles.cardCopy}>
        {label ? <p className={styles.label}>{label}</p> : (
          <p className={styles.label}>{kindLabel}</p>
        )}
        <h5 className={styles.title}>{title}</h5>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      <p className={styles.amount}>{formatMoney(offer.amount, currency)}</p>
    </>
  )

  if (!selectable) {
    return (
      <article
        className={styles.card}
        data-offer-id={offer.id}
        data-offer-kind={offer.kind}
        data-offer-enabled={offer.enabled ? 'true' : 'false'}
        data-offer-selectable="false"
        data-offer-selected="false"
      >
        <div className={styles.cardHead}>{body}</div>
      </article>
    )
  }

  return (
    <label
      className={`${styles.card} ${styles.selectable} ${selected ? styles.selected : ''}`}
      htmlFor={inputId}
      data-offer-id={offer.id}
      data-offer-kind={offer.kind}
      data-offer-enabled={offer.enabled ? 'true' : 'false'}
      data-offer-selectable="true"
      data-offer-selected={selected ? 'true' : 'false'}
    >
      <span className={styles.control}>
        <input
          id={inputId}
          className={styles.input}
          type={exclusive ? 'radio' : 'checkbox'}
          name={exclusive ? `living-offer-${offer.kind}` : undefined}
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect?.(offer.id)}
        />
      </span>
      <span className={styles.cardHead}>{body}</span>
    </label>
  )
}

function OfferGroup({
  title,
  hint,
  offers,
  currency,
  kind,
  selectable,
  selectedId,
  selectedIds,
  exclusive,
  onSelect,
  disabled,
}) {
  if (!offers?.length) return null

  return (
    <section className={styles.group} data-offer-group={kind} aria-label={title}>
      <div className={styles.groupHead}>
        <h4 className={styles.groupTitle}>{title}</h4>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
      <div className={styles.grid} role={exclusive && selectable ? 'radiogroup' : undefined}>
        {offers.map((offer) => {
          const selected = exclusive
            ? selectedId === offer.id
            : Boolean(selectedIds?.includes(offer.id))
          return (
            <OfferCard
              key={offer.id}
              offer={offer}
              currency={currency}
              selectable={selectable}
              selected={selected}
              exclusive={exclusive}
              onSelect={onSelect}
              disabled={disabled}
            />
          )
        })}
      </div>
    </section>
  )
}

function SelectedSummary({ commercialState, currency }) {
  if (!commercialState) return null

  const lines = []
  if (commercialState.selectedPackage) {
    lines.push({
      id: commercialState.selectedPackage.id,
      label: commercialState.selectedPackage.title || 'Selected package',
      amount: commercialState.packageAmount,
    })
  }
  if (commercialState.selectedAlternative) {
    lines.push({
      id: commercialState.selectedAlternative.id,
      label: commercialState.selectedAlternative.title || 'Selected alternative',
      amount: commercialState.alternativeAmount,
    })
  }
  for (const addon of commercialState.selectedAddons ?? []) {
    lines.push({
      id: addon.id,
      label: addon.title || 'Add-on',
      amount: addon.amount,
    })
  }

  return (
    <section
      className={styles.summary}
      data-living-selection-summary="true"
      aria-label="Selected configuration"
    >
      <div className={styles.groupHead}>
        <h4 className={styles.groupTitle}>Selected configuration</h4>
        <p className={styles.hint}>
          Totals use authored offer prices. This does not change the proposal.
        </p>
      </div>
      {lines.length > 0 ? (
        <ul className={styles.summaryList}>
          {lines.map((line) => (
            <li key={line.id} className={styles.summaryRow}>
              <span>{line.label}</span>
              <span>{formatMoney(line.amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Choose an option to update your configuration total.</p>
      )}
      <p className={styles.summaryTotal} data-selected-total="true">
        <span>Selected total</span>
        <strong>{formatMoney(commercialState.selectedTotal, currency)}</strong>
      </p>
    </section>
  )
}

/**
 * Living presentation of authored offer groups.
 *
 * When a living session is active, packages/alternatives are exclusive radios
 * and add-ons are independent checkboxes. Studio preview stays read-only.
 */
function OfferDocument({
  offers,
  currency = 'USD',
  studioPreview = false,
}) {
  const living = useLivingSessionOptional()
  const interactive =
    !studioPreview && Boolean(living?.interactive && living?.capabilities?.selections)

  if (!hasPresentedOffers(offers)) return null

  const selectedPackageId = living?.session?.selectedPackageId ?? null
  const selectedAlternativeId = living?.session?.selectedAlternativeId ?? null
  const selectedAddonIds = living?.session?.selectedAddonIds ?? []
  const busy = Boolean(living?.busy)

  return (
    <div
      className={styles.stack}
      data-living-offers="true"
      data-offer-interactive={interactive ? 'true' : 'false'}
      data-studio-preview={studioPreview ? 'true' : 'false'}
    >
      {studioPreview ? (
        <p className={styles.banner}>
          Studio preview of authored offer choices. Clients select these on the
          living proposal.
        </p>
      ) : interactive ? (
        <p className={styles.banner}>
          Choose one package or alternative, and any optional add-ons.
        </p>
      ) : (
        <p className={styles.banner}>
          Authored offer choices for this proposal.
        </p>
      )}
      <OfferGroup
        kind={OFFER_KIND.PACKAGE}
        title="Offer options"
        hint={
          interactive
            ? 'Select one package. Choosing another replaces the previous selection.'
            : 'Named packages the studio authored for this proposal.'
        }
        offers={offers.packages}
        currency={currency}
        selectable={interactive}
        selectedId={selectedPackageId}
        exclusive
        onSelect={(id) => living?.selectPackage?.(id)}
        disabled={busy}
      />
      <OfferGroup
        kind={OFFER_KIND.ADDON}
        title="Optional add-ons"
        hint={
          interactive
            ? 'Toggle any combination of optional services.'
            : 'Optional services that can be considered with the offer.'
        }
        offers={offers.addons}
        currency={currency}
        selectable={interactive}
        selectedIds={selectedAddonIds}
        exclusive={false}
        onSelect={(id) => living?.toggleAddon?.(id)}
        disabled={busy}
      />
      <OfferGroup
        kind={OFFER_KIND.ALTERNATIVE}
        title="Alternatives"
        hint={
          interactive
            ? 'Select one alternative. Choosing another replaces the previous selection.'
            : 'Alternative scopes the studio authored as choices.'
        }
        offers={offers.alternatives}
        currency={currency}
        selectable={interactive}
        selectedId={selectedAlternativeId}
        exclusive
        onSelect={(id) => living?.selectAlternative?.(id)}
        disabled={busy}
      />
      {interactive ? (
        <SelectedSummary
          commercialState={living?.commercialState}
          currency={currency}
        />
      ) : null}
    </div>
  )
}

export default OfferDocument
