import { TAX_MODE } from '../../models/brandKit.js'
import { RECURRING_INTERVAL_LABELS } from '../../models/commercial.js'
import { computeCommercials, formatMoney } from '../../utils/commercialTotals.js'
import { presentOfferGroups } from '../../models/offer.js'
import OfferDocument from './OfferDocument.jsx'
import styles from '../../layouts/blocks/blocks.module.css'
import extra from './CommercialDocument.module.css'

function qtyShown(lines) {
  return lines.some((line) => Number(line.quantity) !== 1 || line.unit?.trim())
}

function LineTable({ lines, currency, showOptional = false }) {
  const withQty = qtyShown(lines)

  return (
    <table className={styles.items}>
      <thead>
        <tr>
          <th scope="col">Description</th>
          {withQty ? <th scope="col">Qty</th> : null}
          <th scope="col" className={styles.itemAmount}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const qty = Number(line.quantity) || 0
          const unit = line.unit?.trim()

          return (
            <tr key={line.id}>
              <td>
                {line.description || '—'}
                {showOptional && !line.included ? (
                  <span className={extra.optional}>Optional</span>
                ) : null}
              </td>
              {withQty ? (
                <td>
                  {qty}
                  {unit ? ` ${unit}` : ''}
                </td>
              ) : null}
              <td className={styles.itemAmount}>
                {formatMoney(line.total, currency)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function CommercialDocument({
  modules = [],
  notes = '',
  currency = 'USD',
  offers,
}) {
  const totals = computeCommercials(modules)
  const presentedOffers = presentOfferGroups(offers, modules, { enabledOnly: true })
  const hasOffers =
    presentedOffers.packages.length > 0 ||
    presentedOffers.addons.length > 0 ||
    presentedOffers.alternatives.length > 0

  if (!totals.hasContent && !notes?.trim() && !hasOffers) return null

  return (
    <div className={extra.stack}>
      {totals.tableSections.map((section) => {
        const lines = section.lines.filter(
          (line) => line.description?.trim() || line.total > 0,
        )
        if (lines.length === 0) return null

        return (
          <section key={section.id} className={extra.group}>
            {section.title ? (
              <h4 className={extra.groupTitle}>{section.title}</h4>
            ) : null}
            <LineTable lines={lines} currency={currency} />
          </section>
        )
      })}

      {totals.addonSections.map((section) => {
        const lines = section.lines.filter(
          (line) => line.description?.trim() || line.total > 0,
        )
        if (lines.length === 0) return null

        return (
          <section key={section.id} className={extra.group}>
            <h4 className={extra.groupTitle}>{section.title || 'Optional add-ons'}</h4>
            <LineTable lines={lines} currency={currency} showOptional />
          </section>
        )
      })}

      {totals.recurring.length > 0 ? (
        <section className={extra.group}>
          <h4 className={extra.groupTitle}>Recurring services</h4>
          <table className={styles.items}>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col" className={styles.itemAmount}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.recurring.map((item) => (
                <tr key={item.id}>
                  <td>{item.description || '—'}</td>
                  <td className={styles.itemAmount}>
                    {formatMoney(item.total, currency)}
                    {' / '}
                    {item.intervalLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <dl className={styles.totals}>
        <div className={styles.totalRow}>
          <dt>Subtotal</dt>
          <dd>{formatMoney(totals.subtotal, currency)}</dd>
        </div>
        {totals.includedAddons > 0 ? (
          <div className={styles.totalRow}>
            <dt>Included add-ons</dt>
            <dd>{formatMoney(totals.includedAddons, currency)}</dd>
          </div>
        ) : null}
        {totals.discounts.map((discount) => (
          <div key={discount.id} className={styles.totalRow}>
            <dt>{discount.title}</dt>
            <dd>−{formatMoney(discount.amount, currency)}</dd>
          </div>
        ))}
        {totals.taxAmount > 0 ? (
          <div className={styles.totalRow}>
            <dt>
              {totals.taxLabel}
              {totals.taxRate ? ` (${totals.taxRate}%)` : ''}
              {totals.taxMode === TAX_MODE.INCLUSIVE ? ' included' : ''}
            </dt>
            <dd>{formatMoney(totals.taxAmount, currency)}</dd>
          </div>
        ) : null}
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <dt>Total</dt>
          <dd>{formatMoney(totals.grandTotal, currency)}</dd>
        </div>
        {totals.optionalAddons > 0 ? (
          <div className={styles.totalRow}>
            <dt>Optional add-ons</dt>
            <dd>{formatMoney(totals.optionalAddons, currency)}</dd>
          </div>
        ) : null}
        {Object.entries(totals.recurringByInterval).map(([interval, amount]) => (
          <div key={interval} className={styles.totalRow}>
            <dt>Then / {RECURRING_INTERVAL_LABELS[interval] ?? interval}</dt>
            <dd>{formatMoney(amount, currency)}</dd>
          </div>
        ))}
      </dl>

      {totals.milestones.length > 0 ? (
        <section className={extra.group}>
          <h4 className={extra.groupTitle}>Payment schedule</h4>
          <table className={styles.items}>
            <thead>
              <tr>
                <th scope="col">Milestone</th>
                <th scope="col">Share</th>
                <th scope="col" className={styles.itemAmount}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.milestones.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title || '—'}
                    {item.due ? (
                      <span className={extra.due}> · {item.due}</span>
                    ) : null}
                  </td>
                  <td>{item.percent}%</td>
                  <td className={styles.itemAmount}>
                    {formatMoney(item.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {notes?.trim() ? <p className={styles.body}>{notes}</p> : null}

      <OfferDocument offers={presentedOffers} currency={currency} />
    </div>
  )
}

export default CommercialDocument
