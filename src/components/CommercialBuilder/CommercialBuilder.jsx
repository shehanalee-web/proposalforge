import Icon from '../Icon/Icon.jsx'
import { TAX_MODE } from '../../models/brandKit.js'
import {
  COMMERCIAL_MODULE,
  COMMERCIAL_MODULE_LABELS,
  DISCOUNT_KIND,
  RECURRING_INTERVAL,
  RECURRING_INTERVAL_LABELS,
  createCommercialModule,
  makeAddonLine,
  makeCommercialLine,
  makeMilestoneLine,
  makeRecurringLine,
  modulesFromLegacyItems,
  reorderList,
  reorderListById,
} from '../../models/commercial.js'
import { computeCommercials, formatMoney } from '../../utils/commercialTotals.js'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { DEFAULT_CURRENCY } from '../../models/proposal.js'
import styles from './CommercialBuilder.module.css'

const ADDABLE = [
  COMMERCIAL_MODULE.TABLE,
  COMMERCIAL_MODULE.ADDONS,
  COMMERCIAL_MODULE.MILESTONES,
  COMMERCIAL_MODULE.RECURRING,
  COMMERCIAL_MODULE.DISCOUNT,
  COMMERCIAL_MODULE.TAX,
]

const LINE_DRAG = 'application/x-pf-line'
const MODULE_DRAG = 'application/x-pf-module'

/** Native drag kind — React state in dragstart can cancel HTML5 drag. */
const dnd = { kind: null }

function Field({ label, children, className }) {
  return (
    <label className={className ?? styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function MoneyInput({ value, onChange, disabled }) {
  return (
    <input
      className={`${styles.input} ${styles.money}`}
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  )
}

function LineTable({ columns, rows, moduleId, onReorder, disabled, children }) {
  function payloadFor(itemId) {
    return `line:${moduleId}:${itemId}`
  }

  function parseLinePayload(event) {
    const raw =
      event.dataTransfer.getData(LINE_DRAG) ||
      event.dataTransfer.getData('text/plain')
    const match = String(raw).match(/^line:([^:]+):(.+)$/)
    if (!match || match[1] !== moduleId) return null
    return match[2]
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.handleCol} aria-hidden="true" />
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.label}
              </th>
            ))}
            <th className={styles.actionCol}>
              <span className={styles.srOnly}>Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.emptyCell} colSpan={columns.length + 2}>
                No lines in this block.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                onDragOver={(event) => {
                  if (dnd.kind !== 'line') return
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => {
                  const fromId = parseLinePayload(event)
                  if (!fromId) return
                  event.preventDefault()
                  event.stopPropagation()
                  onReorder(fromId, row.id)
                  dnd.kind = null
                }}
              >
                <td className={styles.handleCol}>
                  <button
                    type="button"
                    className={styles.grip}
                    draggable={!disabled}
                    disabled={disabled}
                    aria-label="Reorder row"
                    data-grip="true"
                    onDragStart={(event) => {
                      event.stopPropagation()
                      const payload = payloadFor(row.id)
                      event.dataTransfer.setData(LINE_DRAG, payload)
                      event.dataTransfer.setData('text/plain', payload)
                      event.dataTransfer.effectAllowed = 'move'
                      dnd.kind = 'line'
                      event.currentTarget.closest('tr')?.classList.add(styles.rowDragging)
                    }}
                    onDragEnd={(event) => {
                      dnd.kind = null
                      event.currentTarget.closest('tr')?.classList.remove(styles.rowDragging)
                    }}
                  >
                    <Icon name="grip" size={14} />
                  </button>
                </td>
                {children(row, index)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function ModuleEditor({ module, totals, currency, onPatch, onRemoveItem, onAddItem, onReorderItems, disabled }) {
  if (module.type === COMMERCIAL_MODULE.TABLE || module.type === COMMERCIAL_MODULE.ADDONS) {
    const addon = module.type === COMMERCIAL_MODULE.ADDONS

    return (
      <>
        <LineTable
          moduleId={module.id}
          disabled={disabled}
          onReorder={onReorderItems}
          rows={module.items}
          columns={[
            { key: 'description', label: 'Description' },
            { key: 'qty', label: 'Qty', className: styles.numCol },
            { key: 'unit', label: 'Unit', className: styles.unitCol },
            { key: 'rate', label: 'Rate', className: styles.numCol },
            { key: 'total', label: 'Total', className: styles.numCol },
            ...(addon ? [{ key: 'include', label: 'In total', className: styles.checkCol }] : []),
          ]}
        >
          {(item, index) => (
            <>
              <td>
                <input
                  className={styles.input}
                  value={item.description}
                  disabled={disabled}
                  placeholder="Line description"
                  onChange={(event) =>
                    onPatch(index, { ...item, description: event.target.value })
                  }
                />
              </td>
              <td className={styles.numCol}>
                <input
                  className={`${styles.input} ${styles.money}`}
                  type="number"
                  min="0"
                  step="0.25"
                  value={item.quantity}
                  disabled={disabled}
                  onChange={(event) =>
                    onPatch(index, {
                      ...item,
                      quantity: Number(event.target.value) || 0,
                    })
                  }
                />
              </td>
              <td className={styles.unitCol}>
                <input
                  className={styles.input}
                  value={item.unit}
                  disabled={disabled}
                  placeholder="hrs"
                  onChange={(event) =>
                    onPatch(index, { ...item, unit: event.target.value })
                  }
                />
              </td>
              <td className={styles.numCol}>
                <MoneyInput
                  value={item.unitPrice}
                  disabled={disabled}
                  onChange={(unitPrice) => onPatch(index, { ...item, unitPrice })}
                />
              </td>
              <td className={`${styles.numCol} ${styles.lineTotal}`}>
                {formatMoney(
                  (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                  currency,
                )}
              </td>
              {addon ? (
                <td className={styles.checkCol}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.included)}
                    disabled={disabled}
                    aria-label="Include in total"
                    onChange={(event) =>
                      onPatch(index, { ...item, included: event.target.checked })
                    }
                  />
                </td>
              ) : null}
              <td className={styles.actionCol}>
                <button
                  type="button"
                  className={styles.tiny}
                  disabled={disabled}
                  onClick={() => onRemoveItem(item.id)}
                >
                  Remove
                </button>
              </td>
            </>
          )}
        </LineTable>
        <button
          type="button"
          className={styles.addRow}
          disabled={disabled}
          onClick={() =>
            onAddItem(addon ? makeAddonLine() : makeCommercialLine())
          }
        >
          Add line
        </button>
      </>
    )
  }

  if (module.type === COMMERCIAL_MODULE.MILESTONES) {
    return (
      <>
        <LineTable
          moduleId={module.id}
          disabled={disabled}
          onReorder={onReorderItems}
          rows={module.items}
          columns={[
            { key: 'title', label: 'Milestone' },
            { key: 'percent', label: '%', className: styles.numCol },
            { key: 'amount', label: 'Amount', className: styles.numCol },
            { key: 'due', label: 'Due' },
          ]}
        >
          {(item, index) => {
            const computed = totals.milestones.find((entry) => entry.id === item.id)

            return (
              <>
                <td>
                  <input
                    className={styles.input}
                    value={item.title}
                    disabled={disabled}
                    placeholder="Deposit"
                    onChange={(event) =>
                      onPatch(index, { ...item, title: event.target.value })
                    }
                  />
                </td>
                <td className={styles.numCol}>
                  <input
                    className={`${styles.input} ${styles.money}`}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={item.percent}
                    disabled={disabled}
                    onChange={(event) =>
                      onPatch(index, {
                        ...item,
                        percent: Number(event.target.value) || 0,
                        amountExplicit: false,
                      })
                    }
                  />
                </td>
                <td className={styles.numCol}>
                  <MoneyInput
                    value={computed?.amount ?? item.amount}
                    disabled={disabled}
                    onChange={(amount) =>
                      onPatch(index, { ...item, amount, amountExplicit: true })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    value={item.due}
                    disabled={disabled}
                    placeholder="On acceptance"
                    onChange={(event) =>
                      onPatch(index, { ...item, due: event.target.value })
                    }
                  />
                </td>
                <td className={styles.actionCol}>
                  <button
                    type="button"
                    className={styles.tiny}
                    disabled={disabled}
                    onClick={() => onRemoveItem(item.id)}
                  >
                    Remove
                  </button>
                </td>
              </>
            )
          }}
        </LineTable>
        <button
          type="button"
          className={styles.addRow}
          disabled={disabled}
          onClick={() => onAddItem(makeMilestoneLine({ percent: 0 }))}
        >
          Add milestone
        </button>
        <p className={styles.hint}>
          Scheduled {totals.milestonePercent}% of the one-time total
          {totals.milestonePercent !== 100 ? ' · should add up to 100%' : ''}.
        </p>
      </>
    )
  }

  if (module.type === COMMERCIAL_MODULE.RECURRING) {
    return (
      <>
        <LineTable
          moduleId={module.id}
          disabled={disabled}
          onReorder={onReorderItems}
          rows={module.items}
          columns={[
            { key: 'description', label: 'Service' },
            { key: 'amount', label: 'Amount', className: styles.numCol },
            { key: 'interval', label: 'Every' },
          ]}
        >
          {(item, index) => (
            <>
              <td>
                <input
                  className={styles.input}
                  value={item.description}
                  disabled={disabled}
                  placeholder="Retainer"
                  onChange={(event) =>
                    onPatch(index, { ...item, description: event.target.value })
                  }
                />
              </td>
              <td className={styles.numCol}>
                <MoneyInput
                  value={item.amount}
                  disabled={disabled}
                  onChange={(amount) => onPatch(index, { ...item, amount })}
                />
              </td>
              <td>
                <select
                  className={styles.input}
                  value={item.interval}
                  disabled={disabled}
                  onChange={(event) =>
                    onPatch(index, { ...item, interval: event.target.value })
                  }
                >
                  {Object.values(RECURRING_INTERVAL).map((interval) => (
                    <option key={interval} value={interval}>
                      {RECURRING_INTERVAL_LABELS[interval]}
                    </option>
                  ))}
                </select>
              </td>
              <td className={styles.actionCol}>
                <button
                  type="button"
                  className={styles.tiny}
                  disabled={disabled}
                  onClick={() => onRemoveItem(item.id)}
                >
                  Remove
                </button>
              </td>
            </>
          )}
        </LineTable>
        <button
          type="button"
          className={styles.addRow}
          disabled={disabled}
          onClick={() => onAddItem(makeRecurringLine())}
        >
          Add service
        </button>
      </>
    )
  }

  if (module.type === COMMERCIAL_MODULE.DISCOUNT) {
    return (
      <div className={styles.inlineFields}>
        <Field label="Type">
          <select
            className={styles.input}
            value={module.kind}
            disabled={disabled}
            onChange={(event) => onPatch(null, { kind: event.target.value })}
          >
            <option value={DISCOUNT_KIND.PERCENT}>Percentage</option>
            <option value={DISCOUNT_KIND.FIXED}>Fixed amount</option>
          </select>
        </Field>
        <Field label={module.kind === DISCOUNT_KIND.PERCENT ? 'Percent' : 'Amount'}>
          <MoneyInput
            value={module.value}
            disabled={disabled}
            onChange={(value) => onPatch(null, { value })}
          />
        </Field>
      </div>
    )
  }

  if (module.type === COMMERCIAL_MODULE.TAX) {
    return (
      <div className={styles.inlineFields}>
        <Field label="Label">
          <input
            className={styles.input}
            value={module.label}
            disabled={disabled}
            onChange={(event) => onPatch(null, { label: event.target.value })}
          />
        </Field>
        <Field label="Rate %">
          <input
            className={`${styles.input} ${styles.money}`}
            type="number"
            min="0"
            step="0.1"
            value={module.rate}
            disabled={disabled}
            onChange={(event) =>
              onPatch(null, { rate: Number(event.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Mode">
          <select
            className={styles.input}
            value={module.mode}
            disabled={disabled}
            onChange={(event) => onPatch(null, { mode: event.target.value })}
          >
            <option value={TAX_MODE.EXCLUSIVE}>Exclusive — add on top</option>
            <option value={TAX_MODE.INCLUSIVE}>Inclusive — already in prices</option>
            <option value={TAX_MODE.NONE}>None</option>
          </select>
        </Field>
      </div>
    )
  }

  return null
}

function CommercialBuilder({ data, onChange, currency = DEFAULT_CURRENCY, disabled = false }) {
  const { kit } = useBrandKit()
  const modules = Array.isArray(data.modules)
    ? data.modules
    : modulesFromLegacyItems(data.items)
  const totals = computeCommercials(modules)
  const hasTax = modules.some((module) => module.type === COMMERCIAL_MODULE.TAX)

  function setModules(next) {
    const resolved = typeof next === 'function' ? next(modules) : next
    onChange({ modules: resolved })
  }

  function patchModule(id, patch) {
    setModules((current) =>
      current.map((module) => (module.id === id ? { ...module, ...patch } : module)),
    )
  }

  function addModule(type) {
    const extras = {}

    if (type === COMMERCIAL_MODULE.TAX && kit?.tax) {
      extras.rate = Number(kit.tax.rate) || 0
      extras.mode = kit.tax.mode || TAX_MODE.EXCLUSIVE
      extras.label = (kit.vatNumber || kit.tax.registered) ? 'VAT' : 'Tax'
    }

    setModules((current) => [...current, createCommercialModule(type, extras)])
  }

  return (
    <div className={styles.builder}>
      <div className={styles.totalsBar}>
        <div>
          <p className={styles.totalsKicker}>Live total</p>
          <p className={styles.totalsValue}>
            {formatMoney(totals.grandTotal, currency)}
          </p>
        </div>
        <dl className={styles.totalsMeta}>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotal, currency)}</dd>
          </div>
          {totals.includedAddons > 0 ? (
            <div>
              <dt>Add-ons</dt>
              <dd>{formatMoney(totals.includedAddons, currency)}</dd>
            </div>
          ) : null}
          {totals.discountTotal > 0 ? (
            <div>
              <dt>Discount</dt>
              <dd>−{formatMoney(totals.discountTotal, currency)}</dd>
            </div>
          ) : null}
          {totals.taxAmount > 0 ? (
            <div>
              <dt>
                {totals.taxLabel}
                {totals.taxRate ? ` ${totals.taxRate}%` : ''}
              </dt>
              <dd>{formatMoney(totals.taxAmount, currency)}</dd>
            </div>
          ) : null}
          {totals.optionalAddons > 0 ? (
            <div>
              <dt>Optional</dt>
              <dd>{formatMoney(totals.optionalAddons, currency)}</dd>
            </div>
          ) : null}
          {Object.entries(totals.recurringByInterval).map(([interval, amount]) => (
            <div key={interval}>
              <dt>Recurring / {RECURRING_INTERVAL_LABELS[interval] ?? interval}</dt>
              <dd>{formatMoney(amount, currency)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ol className={styles.modules}>
        {modules.map((module) => (
          <li
            key={module.id}
            className={styles.module}
            onDragOver={(event) => {
              if (dnd.kind !== 'module') return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
              const payload =
                event.dataTransfer.getData(MODULE_DRAG) ||
                event.dataTransfer.getData('text/plain')
              if (!payload.startsWith('module:')) return
              event.preventDefault()
              const fromId = payload.slice(7)
              setModules((current) => {
                const from = current.findIndex((entry) => entry.id === fromId)
                const to = current.findIndex((entry) => entry.id === module.id)
                return reorderList(current, from, to)
              })
              dnd.kind = null
            }}
          >
            <div className={styles.moduleHead}>
              <button
                type="button"
                className={styles.grip}
                draggable={!disabled}
                disabled={disabled}
                aria-label={`Reorder ${COMMERCIAL_MODULE_LABELS[module.type]}`}
                onDragStart={(event) => {
                  const payload = `module:${module.id}`
                  event.dataTransfer.setData(MODULE_DRAG, payload)
                  event.dataTransfer.setData('text/plain', payload)
                  event.dataTransfer.effectAllowed = 'move'
                  dnd.kind = 'module'
                  event.currentTarget.closest('li')?.classList.add(styles.moduleDragging)
                }}
                onDragEnd={(event) => {
                  dnd.kind = null
                  event.currentTarget.closest('li')?.classList.remove(styles.moduleDragging)
                }}
              >
                <Icon name="grip" size={14} />
              </button>
              <div className={styles.moduleTitleBlock}>
                <p className={styles.moduleKicker}>
                  {COMMERCIAL_MODULE_LABELS[module.type]}
                </p>
                <input
                  className={styles.titleInput}
                  value={module.title}
                  disabled={disabled}
                  aria-label="Module title"
                  onChange={(event) =>
                    patchModule(module.id, { title: event.target.value })
                  }
                />
              </div>
              <button
                type="button"
                className={styles.tiny}
                disabled={disabled}
                onClick={() =>
                  setModules((current) =>
                    current.filter((entry) => entry.id !== module.id),
                  )
                }
              >
                Remove
              </button>
            </div>
            <div className={styles.moduleBody}>
              <ModuleEditor
                module={module}
                totals={totals}
                currency={currency}
                disabled={disabled}
                onPatch={(itemIndex, patch) => {
                  if (itemIndex == null) {
                    patchModule(module.id, patch)
                    return
                  }
                  patchModule(module.id, {
                    items: module.items.map((item, i) =>
                      i === itemIndex ? patch : item,
                    ),
                  })
                }}
                onRemoveItem={(itemId) =>
                  patchModule(module.id, {
                    items: (module.items ?? []).filter((item) => item.id !== itemId),
                  })
                }
                onAddItem={(item) =>
                  patchModule(module.id, { items: [...(module.items ?? []), item] })
                }
                onReorderItems={(fromId, toId) =>
                  patchModule(module.id, {
                    items: reorderListById(module.items ?? [], fromId, toId),
                  })
                }
              />
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.addBar}>
        <p className={styles.addLabel}>Add pricing block</p>
        <div className={styles.addChips}>
          {ADDABLE.map((type) => {
            const hidden = type === COMMERCIAL_MODULE.TAX && hasTax
            if (hidden) return null

            return (
              <button
                key={type}
                type="button"
                className={styles.chip}
                disabled={disabled}
                onClick={() => addModule(type)}
              >
                {COMMERCIAL_MODULE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Notes">
        <textarea
          className={styles.input}
          rows={2}
          value={data.notes ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>
    </div>
  )
}

export default CommercialBuilder
