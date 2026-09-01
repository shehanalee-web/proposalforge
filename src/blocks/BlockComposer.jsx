import { BLOCK_TYPE } from './ids.js'
import { getBlockType } from './registry.js'
import {
  addBlock,
  getBlockLabel,
  moveBlock,
  setBlockEnabled,
  updateBlockData,
} from './instance.js'
import {
  makeAttachmentItem,
  makeDeliverableItem,
  makeFaqItem,
  makeGalleryItem,
  makeSpecRow,
  makeTeamMemberData,
  makeTestimonialItem,
  makeTimelineItem,
} from './schemas.js'
import ImageUpload from '../components/ImageUpload/ImageUpload.jsx'
import CommercialBuilder from '../components/CommercialBuilder/CommercialBuilder.jsx'
import { DEFAULT_CURRENCY } from '../models/proposal.js'
import styles from './BlockComposer.module.css'

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function Repeat({ items, onChange, makeItem, renderItem, addLabel }) {
  const list = items ?? []
  function patch(index, next) {
    onChange(list.map((item, i) => (i === index ? next : item)))
  }

  function remove(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.repeat}>
      {list.map((item, index) => (
        <div key={item.id} className={styles.repeatRow}>
          <div className={styles.repeatFields}>{renderItem(item, index, patch)}</div>
          <button
            type="button"
            className={styles.tiny}
            onClick={() => remove(index)}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addRow}
        onClick={() => onChange([...list, makeItem()])}
      >
        {addLabel}
      </button>
    </div>
  )
}

function BlockFields({ block, onData, disabled = false, currency = DEFAULT_CURRENCY }) {
  const data = block.data
  const set = (patch) => onData(patch)

  switch (block.type) {
    case BLOCK_TYPE.COVER:
      return (
        <>
          <Field label="Kicker">
            <input
              className={styles.input}
              value={data.kicker}
              onChange={(event) => set({ kicker: event.target.value })}
            />
          </Field>
          <Field label="Heading">
            <input
              className={styles.input}
              value={data.heading}
              placeholder="Uses the proposal title if empty"
              onChange={(event) => set({ heading: event.target.value })}
            />
          </Field>
          <Field label="Subheading">
            <textarea
              className={styles.input}
              rows={2}
              value={data.subheading}
              onChange={(event) => set({ subheading: event.target.value })}
            />
          </Field>
          <ImageUpload
            label="Cover image"
            value={data.imageUrl}
            size="cover"
            onChange={(url) => set({ imageUrl: url })}
            disabled={disabled}
          />
        </>
      )
    case BLOCK_TYPE.EXECUTIVE_SUMMARY:
    case BLOCK_TYPE.TERMS:
      return (
        <Field label="Body">
          <textarea
            className={styles.input}
            rows={5}
            value={data.body}
            onChange={(event) => set({ body: event.target.value })}
          />
        </Field>
      )
    case BLOCK_TYPE.RICH_TEXT:
    case BLOCK_TYPE.CUSTOM:
      return (
        <>
          <Field label="Heading">
            <input
              className={styles.input}
              value={data.heading}
              onChange={(event) => set({ heading: event.target.value })}
            />
          </Field>
          <Field label="Body">
            <textarea
              className={styles.input}
              rows={5}
              value={data.body}
              onChange={(event) => set({ body: event.target.value })}
            />
          </Field>
        </>
      )
    case BLOCK_TYPE.GALLERY:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeGalleryItem()}
          addLabel="Add image"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <ImageUpload
                label="Image"
                value={item.url}
                size="cover"
                onChange={(url) => patch(index, { ...item, url })}
                disabled={disabled}
              />
              <Field label="Caption">
                <input
                  className={styles.input}
                  value={item.caption}
                  onChange={(event) =>
                    patch(index, { ...item, caption: event.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.PRICING:
      return (
        <CommercialBuilder
          data={data}
          disabled={disabled}
          currency={currency}
          onChange={(patch) => set(patch)}
        />
      )
    case BLOCK_TYPE.TIMELINE:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeTimelineItem()}
          addLabel="Add milestone"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Date">
                <input
                  className={styles.input}
                  value={item.date}
                  onChange={(event) =>
                    patch(index, { ...item, date: event.target.value })
                  }
                />
              </Field>
              <Field label="Title">
                <input
                  className={styles.input}
                  value={item.title}
                  onChange={(event) =>
                    patch(index, { ...item, title: event.target.value })
                  }
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.body}
                  onChange={(event) =>
                    patch(index, { ...item, body: event.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.DELIVERABLES:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeDeliverableItem()}
          addLabel="Add deliverable"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Title">
                <input
                  className={styles.input}
                  value={item.title}
                  onChange={(event) =>
                    patch(index, { ...item, title: event.target.value })
                  }
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.body}
                  onChange={(event) =>
                    patch(index, { ...item, body: event.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.SPECIFICATIONS:
      return (
        <Repeat
          items={data.rows}
          makeItem={() => makeSpecRow()}
          addLabel="Add row"
          onChange={(rows) => set({ rows })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Label">
                <input
                  className={styles.input}
                  value={item.label}
                  onChange={(event) =>
                    patch(index, { ...item, label: event.target.value })
                  }
                />
              </Field>
              <Field label="Value">
                <input
                  className={styles.input}
                  value={item.value}
                  onChange={(event) =>
                    patch(index, { ...item, value: event.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.TEAM:
      return (
        <Repeat
          items={data.members}
          makeItem={() => makeTeamMemberData()}
          addLabel="Add person"
          onChange={(members) => set({ members })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Name">
                <input
                  className={styles.input}
                  value={item.name}
                  onChange={(event) =>
                    patch(index, { ...item, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={styles.input}
                  value={item.role}
                  onChange={(event) =>
                    patch(index, { ...item, role: event.target.value })
                  }
                />
              </Field>
              <Field label="Bio">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.bio}
                  onChange={(event) =>
                    patch(index, { ...item, bio: event.target.value })
                  }
                />
              </Field>
              <ImageUpload
                label="Photo"
                value={item.photoUrl}
                size="portrait"
                onChange={(url) => patch(index, { ...item, photoUrl: url })}
                disabled={disabled}
              />
            </>
          )}
        />
      )
    case BLOCK_TYPE.TESTIMONIALS:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeTestimonialItem()}
          addLabel="Add quote"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Quote">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.quote}
                  onChange={(event) =>
                    patch(index, { ...item, quote: event.target.value })
                  }
                />
              </Field>
              <Field label="Author">
                <input
                  className={styles.input}
                  value={item.authorName}
                  onChange={(event) =>
                    patch(index, { ...item, authorName: event.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={styles.input}
                  value={item.authorRole}
                  onChange={(event) =>
                    patch(index, { ...item, authorRole: event.target.value })
                  }
                />
              </Field>
              <Field label="Company">
                <input
                  className={styles.input}
                  value={item.company}
                  onChange={(event) =>
                    patch(index, { ...item, company: event.target.value })
                  }
                />
              </Field>
              <ImageUpload
                label="Avatar"
                value={item.portraitUrl}
                size="portrait"
                onChange={(url) => patch(index, { ...item, portraitUrl: url })}
                disabled={disabled}
              />
            </>
          )}
        />
      )
    case BLOCK_TYPE.FAQ:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeFaqItem()}
          addLabel="Add question"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Question">
                <input
                  className={styles.input}
                  value={item.question}
                  onChange={(event) =>
                    patch(index, { ...item, question: event.target.value })
                  }
                />
              </Field>
              <Field label="Answer">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.answer}
                  onChange={(event) =>
                    patch(index, { ...item, answer: event.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.SIGNATURE:
      return (
        <>
          <Field label="Client label">
            <input
              className={styles.input}
              value={data.clientLabel}
              onChange={(event) => set({ clientLabel: event.target.value })}
            />
          </Field>
          <Field label="Studio label">
            <input
              className={styles.input}
              value={data.studioLabel}
              onChange={(event) => set({ studioLabel: event.target.value })}
            />
          </Field>
        </>
      )
    case BLOCK_TYPE.ATTACHMENTS:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeAttachmentItem()}
          addLabel="Add file"
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Name">
                <input
                  className={styles.input}
                  value={item.name}
                  onChange={(event) =>
                    patch(index, { ...item, name: event.target.value })
                  }
                />
              </Field>
              <ImageUpload
                label="File"
                variant="file"
                accept="application/pdf,image/*,.pdf"
                fileName={item.name}
                value={item.url}
                disabled={disabled}
                onChange={(url, asset) =>
                  patch(index, {
                    ...item,
                    url,
                    name: item.name || asset?.name || '',
                  })
                }
              />
            </>
          )}
        />
      )
    default:
      return null
  }
}

function BlockComposer({
  blocks,
  onChange,
  disabled = false,
  currency = DEFAULT_CURRENCY,
}) {
  const list = blocks ?? []

  function update(next) {
    onChange(next)
  }

  return (
    <div className={styles.composer}>
      <div className={styles.toolbar}>
        <div>
          <h3 className={styles.heading}>Content blocks</h3>
          <p className={styles.hint}>
            Enable, disable and reorder. Turning a block off hides it everywhere
            but keeps its content.
          </p>
        </div>
        <button
          type="button"
          className={styles.add}
          disabled={disabled}
          onClick={() => update(addBlock(list, BLOCK_TYPE.CUSTOM))}
        >
          Add custom block
        </button>
      </div>

      <ol className={styles.list}>
        {list.map((block, index) => {
          const def = getBlockType(block.type)
          const label = def.label || getBlockLabel(block.type)

          return (
            <li
              key={block.id}
              className={
                block.enabled ? styles.card : `${styles.card} ${styles.cardOff}`
              }
            >
              <div className={styles.cardHead}>
                <label className={styles.enable}>
                  <input
                    type="checkbox"
                    checked={block.enabled}
                    disabled={disabled}
                    onChange={(event) =>
                      update(setBlockEnabled(list, block.id, event.target.checked))
                    }
                  />
                  <span>{label}</span>
                </label>
                <div className={styles.order}>
                  <button
                    type="button"
                    className={styles.tiny}
                    disabled={disabled || index === 0}
                    onClick={() => update(moveBlock(list, block.id, -1))}
                    aria-label={`Move ${label} up`}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className={styles.tiny}
                    disabled={disabled || index === list.length - 1}
                    onClick={() => update(moveBlock(list, block.id, 1))}
                    aria-label={`Move ${label} down`}
                  >
                    Down
                  </button>
                </div>
              </div>
              <div className={styles.cardBody}>
                <fieldset className={styles.fields} disabled={disabled}>
                  <BlockFields
                    block={block}
                    disabled={disabled}
                    currency={currency}
                    onData={(data) =>
                      update(updateBlockData(list, block.id, data))
                    }
                  />
                </fieldset>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default BlockComposer
