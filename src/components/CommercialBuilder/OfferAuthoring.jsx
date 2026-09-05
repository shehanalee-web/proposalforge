import Icon from '../Icon/Icon.jsx'
import { COMMERCIAL_MODULE } from '../../models/commercial.js'
import {
  OFFER_GROUP_KEYS,
  OFFER_KIND,
  OFFER_KIND_LABELS,
  addOffer,
  listOfferLineOptions,
  makeOfferGroups,
  presentOfferGroups,
  removeOffer,
  reorderOffers,
  setOfferEnabled,
  updateOffer,
} from '../../models/offer.js'
import { formatMoney } from '../../utils/commercialTotals.js'
import OfferDocument from './OfferDocument.jsx'
import styles from './CommercialBuilder.module.css'

const OFFER_DRAG = 'application/x-pf-offer'
const offerDnd = { group: null }

const GROUPS = [
  {
    kind: OFFER_KIND.PACKAGE,
    title: 'Named offer options',
    hint: 'Authored packages the client will later choose between. Not a client selection.',
  },
  {
    kind: OFFER_KIND.ADDON,
    title: 'Selectable add-ons',
    hint: 'Optional services authored for this offer. Client toggles come in a later phase.',
  },
  {
    kind: OFFER_KIND.ALTERNATIVE,
    title: 'Alternatives',
    hint: 'Alternative scopes using the existing alternatives concept. Authored only.',
  },
]

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function LinePicker({ offer, options, onToggle, disabled, multiple }) {
  if (options.length === 0) {
    return (
      <p className={styles.hint}>
        Add standard pricing or optional add-on lines above to reference them here.
      </p>
    )
  }

  const selected = multiple
    ? new Set(offer.itemIds ?? [])
    : new Set(offer.itemId ? [offer.itemId] : [])

  return (
    <div className={styles.offerLines}>
      {options.map((line) => {
        const checked = selected.has(line.id)
        return (
          <label key={line.id} className={styles.offerLine}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={multiple ? undefined : `offer-line-${offer.id}`}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(line.id, !checked)}
            />
            <span>
              {line.description}
              <span className={styles.offerLineAmount}>
                {formatMoney(line.amount)}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

function OfferCard({
  offer,
  kind,
  options,
  disabled,
  onPatch,
  onRemove,
  onReorder,
  onToggleEnabled,
}) {
  const multiple = kind !== OFFER_KIND.ADDON

  function toggleLine(lineId, on) {
    if (multiple) {
      const current = offer.itemIds ?? []
      onPatch({
        itemIds: on
          ? [...current, lineId]
          : current.filter((id) => id !== lineId),
      })
      return
    }
    onPatch({ itemId: on ? lineId : null })
  }

  return (
    <li
      className={`${styles.offerCard} ${offer.enabled ? '' : styles.offerCardOff}`}
      data-offer-id={offer.id}
      data-offer-kind={kind}
      onDragOver={(event) => {
        if (offerDnd.group !== kind) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        const raw =
          event.dataTransfer.getData(OFFER_DRAG) ||
          event.dataTransfer.getData('text/plain')
        const match = String(raw).match(/^offer:([^:]+):(.+)$/)
        if (!match || match[1] !== kind) return
        event.preventDefault()
        onReorder(match[2], offer.id)
        offerDnd.group = null
      }}
    >
      <div className={styles.offerHead}>
        <button
          type="button"
          className={styles.grip}
          draggable={!disabled}
          disabled={disabled}
          aria-label={`Reorder ${OFFER_KIND_LABELS[kind]}`}
          onDragStart={(event) => {
            const payload = `offer:${kind}:${offer.id}`
            event.dataTransfer.setData(OFFER_DRAG, payload)
            event.dataTransfer.setData('text/plain', payload)
            event.dataTransfer.effectAllowed = 'move'
            offerDnd.group = kind
          }}
          onDragEnd={() => {
            offerDnd.group = null
          }}
        >
          <Icon name="grip" size={14} />
        </button>
        <div className={styles.moduleTitleBlock}>
          <p className={styles.moduleKicker}>{OFFER_KIND_LABELS[kind]}</p>
          <input
            className={styles.titleInput}
            value={offer.title}
            disabled={disabled}
            placeholder="Title"
            aria-label={`${OFFER_KIND_LABELS[kind]} title`}
            onChange={(event) => onPatch({ title: event.target.value })}
          />
        </div>
        <label className={styles.offerEnable}>
          <input
            type="checkbox"
            checked={offer.enabled}
            disabled={disabled}
            onChange={(event) => onToggleEnabled(event.target.checked)}
          />
          Available
        </label>
        <button
          type="button"
          className={styles.tiny}
          disabled={disabled}
          onClick={onRemove}
        >
          Delete
        </button>
      </div>
      <div className={styles.offerBody}>
        <div className={styles.offerFields}>
          {kind !== OFFER_KIND.ADDON ? (
            <Field label="Short label">
              <input
                className={styles.input}
                value={offer.label}
                disabled={disabled}
                placeholder="Optional"
                onChange={(event) => onPatch({ label: event.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Price">
            <input
              className={`${styles.input} ${styles.money}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={Number.isFinite(offer.amount) ? offer.amount : 0}
              disabled={disabled}
              onChange={(event) =>
                onPatch({ amount: Number(event.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className={styles.input}
            rows={2}
            value={offer.description}
            disabled={disabled}
            placeholder="Optional"
            onChange={(event) => onPatch({ description: event.target.value })}
          />
        </Field>
        <Field
          label={
            multiple ? 'Included commercial lines' : 'Pricing reference'
          }
        >
          <LinePicker
            offer={offer}
            options={options}
            disabled={disabled}
            multiple={multiple}
            onToggle={toggleLine}
          />
        </Field>
      </div>
    </li>
  )
}

function OfferAuthoring({
  offers,
  modules = [],
  currency = 'USD',
  disabled = false,
  onChange,
}) {
  const groups = makeOfferGroups(offers)
  const options = listOfferLineOptions(modules)
  const preview = presentOfferGroups(groups, modules, { enabledOnly: true })

  function commit(next) {
    onChange(makeOfferGroups(next))
  }

  return (
    <div className={styles.offerAuthoring} data-offer-authoring="true">
      <div className={styles.offerIntro}>
        <h3 className={styles.offerHeading}>Authored offer</h3>
        <p className={styles.hint}>
          Studio-authored packages, add-ons, and alternatives. These are offer
          choices, not client selections. Existing pricing totals stay unchanged.
        </p>
      </div>

      {GROUPS.map((group) => {
        const key = OFFER_GROUP_KEYS[group.kind]
        const list = groups[key]

        return (
          <section
            key={group.kind}
            className={styles.offerGroup}
            data-offer-editor={group.kind}
          >
            <div className={styles.offerGroupHead}>
              <div>
                <h4 className={styles.offerGroupTitle}>{group.title}</h4>
                <p className={styles.hint}>{group.hint}</p>
              </div>
              <button
                type="button"
                className={styles.chip}
                disabled={disabled}
                onClick={() => commit(addOffer(groups, group.kind, { title: '' }))}
              >
                Add {OFFER_KIND_LABELS[group.kind].toLowerCase()}
              </button>
            </div>
            {list.length === 0 ? (
              <p className={styles.hint}>None authored yet.</p>
            ) : (
              <ol className={styles.offerList}>
                {list.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    kind={group.kind}
                    options={
                      group.kind === OFFER_KIND.ADDON
                        ? options.some(
                            (line) => line.moduleType === COMMERCIAL_MODULE.ADDONS,
                          )
                          ? options.filter(
                              (line) => line.moduleType === COMMERCIAL_MODULE.ADDONS,
                            )
                          : options
                        : options
                    }
                    disabled={disabled}
                    onPatch={(patch) =>
                      commit(updateOffer(groups, group.kind, offer.id, patch))
                    }
                    onRemove={() =>
                      commit(removeOffer(groups, group.kind, offer.id))
                    }
                    onReorder={(fromId, toId) =>
                      commit(reorderOffers(groups, group.kind, fromId, toId))
                    }
                    onToggleEnabled={(enabled) =>
                      commit(setOfferEnabled(groups, group.kind, offer.id, enabled))
                    }
                  />
                ))}
              </ol>
            )}
          </section>
        )
      })}

      <div className={styles.offerPreview} data-offer-preview="true">
        <h4 className={styles.offerGroupTitle}>Authored result</h4>
        <OfferDocument offers={preview} currency={currency} studioPreview />
      </div>
    </div>
  )
}

export default OfferAuthoring
