import { BLOCK_TYPE } from '../ids.js'
import {
  makeAttachmentItem,
  makeDeliverableItem,
  makeFaqItem,
  makeGalleryItem,
  makeSpecRow,
  makeTeamMemberData,
  makeTestimonialItem,
  makeTimelineItem,
} from '../schemas.js'
import ImageUpload from '../../components/ImageUpload/ImageUpload.jsx'
import CommercialBuilder from '../../components/CommercialBuilder/CommercialBuilder.jsx'
import { DEFAULT_CURRENCY } from '../../models/proposal.js'
import { getBlockMeta } from './blockMeta.js'
import BlockEmptyState from './BlockEmptyState.jsx'
import styles from './BlockFields.module.css'

function applyAsset(fields, url, asset) {
  if (!url || !asset) {
    return { ...fields, assetId: '', url: '', mimeType: '', sizeBytes: 0 }
  }
  return {
    ...fields,
    assetId: asset.id,
    url: asset.url,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    name: fields.name || asset.name || '',
  }
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function Repeat({ items, onChange, makeItem, renderItem, addLabel, emptyTitle, emptyHint }) {
  const list = items ?? []

  function patch(index, next) {
    onChange(list.map((item, i) => (i === index ? next : item)))
  }

  function remove(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.repeat}>
      {list.length === 0 ? (
        <BlockEmptyState
          title={emptyTitle}
          hint={emptyHint}
          action={
            <button
              type="button"
              className={styles.addRow}
              onClick={() => onChange([...list, makeItem()])}
            >
              {addLabel}
            </button>
          }
        />
      ) : (
        list.map((item, index) => (
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
        ))
      )}
      {list.length > 0 ? (
        <button
          type="button"
          className={styles.addRow}
          onClick={() => onChange([...list, makeItem()])}
        >
          {addLabel}
        </button>
      ) : null}
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
              onChange={(e) => set({ kicker: e.target.value })}
            />
          </Field>
          <Field label="Heading">
            <input
              className={styles.input}
              value={data.heading}
              placeholder="Uses the proposal title if empty"
              onChange={(e) => set({ heading: e.target.value })}
            />
          </Field>
          <Field label="Subheading">
            <textarea
              className={styles.input}
              rows={2}
              value={data.subheading}
              onChange={(e) => set({ subheading: e.target.value })}
            />
          </Field>
          <ImageUpload
            label="Cover image"
            value={data.imageUrl}
            size="cover"
            onChange={(url, asset) =>
              set({
                imageUrl: asset?.url ?? url ?? '',
                imageAssetId: asset?.id ?? '',
              })
            }
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
            placeholder="Start writing…"
            onChange={(e) => set({ body: e.target.value })}
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
              placeholder="Start writing…"
              onChange={(e) => set({ heading: e.target.value })}
            />
          </Field>
          <Field label="Body">
            <textarea
              className={styles.input}
              rows={5}
              value={data.body}
              onChange={(e) => set({ body: e.target.value })}
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.GALLERY).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.GALLERY).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <ImageUpload
                label="Image"
                value={item.url}
                size="cover"
                onChange={(url, asset) =>
                  patch(index, {
                    ...item,
                    url: asset?.url ?? url ?? '',
                    assetId: asset?.id ?? '',
                  })
                }
                disabled={disabled}
              />
              <Field label="Caption">
                <input
                  className={styles.input}
                  value={item.caption}
                  onChange={(e) =>
                    patch(index, { ...item, caption: e.target.value })
                  }
                />
              </Field>
            </>
          )}
        />
      )
    case BLOCK_TYPE.PRICING: {
      const meta = getBlockMeta(BLOCK_TYPE.PRICING)
      const empty = !(data.modules && data.modules.length)
      return (
        <>
          {empty ? (
            <BlockEmptyState title={meta.emptyTitle} hint={meta.emptyHint} />
          ) : null}
          <CommercialBuilder
            data={data}
            disabled={disabled}
            currency={currency}
            onChange={(patch) => set(patch)}
          />
        </>
      )
    }
    case BLOCK_TYPE.TIMELINE:
      return (
        <Repeat
          items={data.items}
          makeItem={() => makeTimelineItem()}
          addLabel="Add milestone"
          emptyTitle={getBlockMeta(BLOCK_TYPE.TIMELINE).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.TIMELINE).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Date">
                <input
                  className={styles.input}
                  value={item.date}
                  onChange={(e) =>
                    patch(index, { ...item, date: e.target.value })
                  }
                />
              </Field>
              <Field label="Title">
                <input
                  className={styles.input}
                  value={item.title}
                  onChange={(e) =>
                    patch(index, { ...item, title: e.target.value })
                  }
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.body}
                  onChange={(e) =>
                    patch(index, { ...item, body: e.target.value })
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.DELIVERABLES).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.DELIVERABLES).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Title">
                <input
                  className={styles.input}
                  value={item.title}
                  onChange={(e) =>
                    patch(index, { ...item, title: e.target.value })
                  }
                />
              </Field>
              <Field label="Body">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.body}
                  onChange={(e) =>
                    patch(index, { ...item, body: e.target.value })
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.SPECIFICATIONS).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.SPECIFICATIONS).emptyHint}
          onChange={(rows) => set({ rows })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Label">
                <input
                  className={styles.input}
                  value={item.label}
                  onChange={(e) =>
                    patch(index, { ...item, label: e.target.value })
                  }
                />
              </Field>
              <Field label="Value">
                <input
                  className={styles.input}
                  value={item.value}
                  onChange={(e) =>
                    patch(index, { ...item, value: e.target.value })
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.TEAM).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.TEAM).emptyHint}
          onChange={(members) => set({ members })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Name">
                <input
                  className={styles.input}
                  value={item.name}
                  onChange={(e) =>
                    patch(index, { ...item, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={styles.input}
                  value={item.role}
                  onChange={(e) =>
                    patch(index, { ...item, role: e.target.value })
                  }
                />
              </Field>
              <Field label="Bio">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.bio}
                  onChange={(e) =>
                    patch(index, { ...item, bio: e.target.value })
                  }
                />
              </Field>
              <ImageUpload
                label="Photo"
                value={item.photoUrl}
                size="portrait"
                onChange={(url, asset) =>
                  patch(index, {
                    ...item,
                    photoUrl: asset?.url ?? url ?? '',
                    photoAssetId: asset?.id ?? '',
                  })
                }
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.TESTIMONIALS).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.TESTIMONIALS).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Quote">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.quote}
                  onChange={(e) =>
                    patch(index, { ...item, quote: e.target.value })
                  }
                />
              </Field>
              <Field label="Author">
                <input
                  className={styles.input}
                  value={item.authorName}
                  onChange={(e) =>
                    patch(index, { ...item, authorName: e.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={styles.input}
                  value={item.authorRole}
                  onChange={(e) =>
                    patch(index, { ...item, authorRole: e.target.value })
                  }
                />
              </Field>
              <Field label="Company">
                <input
                  className={styles.input}
                  value={item.company}
                  onChange={(e) =>
                    patch(index, { ...item, company: e.target.value })
                  }
                />
              </Field>
              <ImageUpload
                label="Avatar"
                value={item.portraitUrl}
                size="portrait"
                onChange={(url, asset) =>
                  patch(index, {
                    ...item,
                    portraitUrl: asset?.url ?? url ?? '',
                    portraitAssetId: asset?.id ?? '',
                  })
                }
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.FAQ).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.FAQ).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Question">
                <input
                  className={styles.input}
                  value={item.question}
                  onChange={(e) =>
                    patch(index, { ...item, question: e.target.value })
                  }
                />
              </Field>
              <Field label="Answer">
                <textarea
                  className={styles.input}
                  rows={2}
                  value={item.answer}
                  onChange={(e) =>
                    patch(index, { ...item, answer: e.target.value })
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
              onChange={(e) => set({ clientLabel: e.target.value })}
            />
          </Field>
          <Field label="Studio label">
            <input
              className={styles.input}
              value={data.studioLabel}
              onChange={(e) => set({ studioLabel: e.target.value })}
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
          emptyTitle={getBlockMeta(BLOCK_TYPE.ATTACHMENTS).emptyTitle}
          emptyHint={getBlockMeta(BLOCK_TYPE.ATTACHMENTS).emptyHint}
          onChange={(items) => set({ items })}
          renderItem={(item, index, patch) => (
            <>
              <Field label="Name">
                <input
                  className={styles.input}
                  value={item.name}
                  onChange={(e) =>
                    patch(index, { ...item, name: e.target.value })
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
                  patch(
                    index,
                    applyAsset(
                      { ...item, name: item.name || asset?.name || '' },
                      url,
                      asset,
                    ),
                  )
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

export default BlockFields
