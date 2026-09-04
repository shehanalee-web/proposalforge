import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  BLOCK_CATEGORIES,
  BLOCK_CATEGORY_LABELS,
  BLOCK_VARIABLES,
  LIBRARY_BLOCK_STATUSES,
  LIBRARY_BLOCK_STATUS_LABELS,
  restoreLibraryBlock,
} from '../../models/contentBlock.js'
import { BUILTIN_BLOCK_TYPES } from '../../blocks/ids.js'
import { makeBlock } from '../../blocks/instance.js'
import { getScreenRenderer } from '../../blocks/screenRegistry.js'
import { getBlockMeta } from '../../blocks/editor/blockMeta.js'
import BlockFields from '../../blocks/editor/BlockFields.jsx'
import DocumentSurface from '../../theme/DocumentSurface.jsx'
import { buildVariableContext, interpolateInstance } from '../../blocks/variables.js'
import { useLibraryBlock } from '../../hooks/useLibraryBlock.js'
import { useLibraryBlocks } from '../../hooks/useLibraryBlocks.js'
import { useCreateLibraryBlock } from '../../hooks/useCreateLibraryBlock.js'
import { useUpdateLibraryBlock } from '../../hooks/useUpdateLibraryBlock.js'
import { CONTENT_BLOCK_TYPE_LABELS } from '../../models/contentBlock.js'
import { PATH } from '../../workspace/paths.js'
import styles from './ContentLibraryEditor.module.css'

const EMPTY = {
  name: '',
  description: '',
  type: 'executive-summary',
  category: 'text',
  status: 'published',
  tags: '',
  favorite: false,
  data: {},
}

function valuesFromBlock(block) {
  return {
    name: block.name ?? '',
    description: block.description ?? '',
    type: block.type,
    category: block.category,
    status: block.status,
    tags: (block.tags ?? []).join(', '),
    favorite: Boolean(block.favorite),
    data: block.data ?? {},
  }
}

function ContentLibraryEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = !id
  const navigate = useNavigate()
  const fromId = params.get('from')
  const typeParam = params.get('type')

  const { block, loading, error, notFound, refetch } = useLibraryBlock(id)
  const { blocks: library } = useLibraryBlocks()
  const source = fromId ? library.find((item) => item.id === fromId) : null
  const createFlow = useCreateLibraryBlock()
  const updateFlow = useUpdateLibraryBlock()
  const { submitting, error: saveError, fieldErrors } = isNew ? createFlow : updateFlow

  const [draft, setDraft] = useState(null)
  const seeded = draft ?? (isNew
    ? {
        ...EMPTY,
        type: typeParam || source?.type || EMPTY.type,
        name: source ? `${source.name} copy` : '',
        description: source?.description ?? '',
        category: source?.category ?? EMPTY.category,
        tags: (source?.tags ?? []).join(', '),
        data: source?.data ?? {},
      }
    : block
      ? valuesFromBlock(block)
      : null)

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  function patch(partial) {
    if (!seeded) return
    setDraft({ ...seeded, ...partial })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!seeded) return
    const payload = {
      name: seeded.name,
      description: seeded.description,
      type: seeded.type,
      category: seeded.category,
      status: seeded.status,
      tags: seeded.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      favorite: seeded.favorite,
      data: seeded.data,
      snapshot: !isNew,
    }
    const saved = isNew
      ? await createFlow.create(payload)
      : await updateFlow.update(id, payload)
    if (saved) navigate(PATH.CONTENT_LIBRARY)
  }

  async function handleRestore(versionId) {
    if (!block) return
    const restored = restoreLibraryBlock(block, versionId)
    setDraft(valuesFromBlock(restored))
  }

  const previewInstance = useMemo(() => {
    if (!seeded) return null
    return makeBlock({ type: seeded.type, data: seeded.data, enabled: true })
  }, [seeded])

  const Screen = previewInstance ? getScreenRenderer(previewInstance.type) : null
  const fakeProposal = {
    title: 'Brand Identity Refresh',
    clientName: 'Dana Whitfield',
    company: 'Northwind Studio',
    amount: 18500,
    validUntil: '2026-09-10',
    createdAt: '2026-08-01T00:00:00.000Z',
    id: 'prop-1001',
    clientEmail: 'dana@northwindstudio.com',
  }
  const previewBrand = {
    companyName: 'ProposalForge',
    contact: {},
    logos: {},
    colors: {},
  }
  const livePreview = previewInstance
    ? interpolateInstance(
        previewInstance,
        buildVariableContext({ proposal: fakeProposal, brand: previewBrand }),
      )
    : null

  if (!isNew && notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Block not found</p>
          <Link to={PATH.CONTENT_LIBRARY} className={styles.action}>
            Back to Proposal Blocks
          </Link>
        </div>
      </section>
    )
  }

  if (!isNew && error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this block</p>
          <p className={styles.stateText}>{error.message}</p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (!seeded || (!isNew && loading)) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading block…</p>
      </section>
    )
  }

  const meta = getBlockMeta(seeded.type)

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        {isNew
          ? 'Create a reusable block. Proposals insert a copy and keep a reference to this record.'
          : 'Saving creates a revision. Existing proposals keep the copy they inserted.'}
      </p>

      {requestError ? (
        <div className={styles.banner} role="alert">
          <p className={styles.bannerTitle}>Could not save the block</p>
          <p className={styles.bannerText}>{requestError.message}</p>
        </div>
      ) : null}

      <form className={styles.layout} onSubmit={handleSubmit}>
        <div className={styles.panel}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              value={seeded.name}
              onChange={(event) => patch({ name: event.target.value })}
              required
            />
            {fieldErrors.name ? <em>{fieldErrors.name}</em> : null}
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <textarea
              rows={3}
              value={seeded.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Type</span>
              <select
                value={seeded.type}
                onChange={(event) => patch({ type: event.target.value, data: {} })}
              >
                {BUILTIN_BLOCK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTENT_BLOCK_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Category</span>
              <select
                value={seeded.category}
                onChange={(event) => patch({ category: event.target.value })}
              >
                {BLOCK_CATEGORIES.map((id) => (
                  <option key={id} value={id}>
                    {BLOCK_CATEGORY_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                value={seeded.status}
                onChange={(event) => patch({ status: event.target.value })}
              >
                {LIBRARY_BLOCK_STATUSES.map((id) => (
                  <option key={id} value={id}>
                    {LIBRARY_BLOCK_STATUS_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            <span>Tags</span>
            <input
              value={seeded.tags}
              onChange={(event) => patch({ tags: event.target.value })}
              placeholder="pricing, intro"
            />
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={seeded.favorite}
              onChange={(event) => patch({ favorite: event.target.checked })}
            />
            Favorite
          </label>

          <div className={styles.fields}>
            <p className={styles.section}>Content · {meta.short}</p>
            <BlockFields
              block={previewInstance}
              onData={(data) => patch({ data: { ...seeded.data, ...data } })}
            />
          </div>

          <div className={styles.variables}>
            <p className={styles.section}>Variables</p>
            <p className={styles.hint}>
              Type tokens in any text field. They resolve in preview, the client
              viewer and PDF.
            </p>
            <ul>
              {BLOCK_VARIABLES.map((item) => (
                <li key={item.id}>
                  <code>{`{{${item.id}}}`}</code>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {!isNew && block?.versions?.length ? (
            <div className={styles.versions}>
              <p className={styles.section}>Version history</p>
              <ul>
                {[...block.versions].reverse().map((entry) => (
                  <li key={entry.versionId}>
                    <span>
                      v{entry.versionNumber} · {entry.label}
                    </span>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => handleRestore(entry.versionId)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Saving…' : isNew ? 'Create block' : 'Save changes'}
            </button>
            <Link to={PATH.CONTENT_LIBRARY} className={styles.secondary}>
              Cancel
            </Link>
          </div>
        </div>

        <aside className={styles.preview} aria-label="Block preview">
          <p className={styles.section}>Preview</p>
          <DocumentSurface className={styles.surface}>
            {Screen && livePreview ? (
              <Screen
                instance={livePreview}
                proposal={fakeProposal}
                settings={null}
                brand={previewBrand}
                layout={{ id: 'portrait' }}
              />
            ) : null}
          </DocumentSurface>
        </aside>
      </form>
    </section>
  )
}

export default ContentLibraryEditor
