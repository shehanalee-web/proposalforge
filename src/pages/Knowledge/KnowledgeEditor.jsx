import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useKnowledgeItem } from '../../hooks/useKnowledgeItem.js'
import { useKnowledgeMutations } from '../../hooks/useKnowledgeMutations.js'
import { fetchKnowledgeDuplicates } from '../../services/knowledgeService.js'
import {
  DEFAULT_COMPANY_ID,
  DEFAULT_TYPE_CATEGORY,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TYPE,
  KNOWLEDGE_TYPE_LABELS,
  KNOWLEDGE_TYPES,
} from '../../knowledge/types.js'
import { PATH, knowledgePath } from '../../workspace/paths.js'
import styles from './KnowledgeEditor.module.css'

const EMPTY = {
  title: '',
  content: '',
  type: KNOWLEDGE_TYPE.PROPOSAL_BLOCK,
  category: DEFAULT_TYPE_CATEGORY[KNOWLEDGE_TYPE.PROPOSAL_BLOCK],
  tags: '',
  status: KNOWLEDGE_STATUS.DRAFT,
}

function valuesFromItem(item) {
  return {
    title: item.title ?? '',
    content: item.content ?? '',
    type: item.type,
    category: item.category,
    tags: (item.tags ?? []).join(', '),
    status: item.status,
  }
}

function KnowledgeEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const companyId = DEFAULT_COMPANY_ID
  const { item, loading, error, notFound, refetch } = useKnowledgeItem(id, companyId)
  const { create, update, submitting, error: saveError, fieldErrors, reset } =
    useKnowledgeMutations()

  const [draft, setDraft] = useState(null)
  const [duplicateNote, setDuplicateNote] = useState('')
  const values = draft ?? (isNew ? EMPTY : item ? valuesFromItem(item) : null)

  function handleChange(name, value) {
    if (!values) return
    reset()
    const next = { ...values, [name]: value }
    if (name === 'type' && !draft?.categoryTouched) {
      next.category = DEFAULT_TYPE_CATEGORY[value] ?? next.category
    }
    setDraft(next)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!values) return

    const payload = {
      companyId,
      title: values.title,
      content: values.content,
      type: values.type,
      category: values.category,
      tags: values.tags,
      status: isNew ? KNOWLEDGE_STATUS.DRAFT : values.status,
      source: item?.source ?? KNOWLEDGE_SOURCE.MANUAL,
    }

    const duplicates = await fetchKnowledgeDuplicates({
      companyId,
      title: payload.title,
      content: payload.content,
      excludeId: id,
    }).catch(() => [])
    if (duplicates.length > 0) {
      setDuplicateNote(
        `Possible duplicate: ${duplicates[0].title}. It will still save — nothing is merged.`,
      )
    } else {
      setDuplicateNote('')
    }

    const saved = isNew
      ? await create(payload)
      : await update(id, payload, companyId)

    if (saved) navigate(knowledgePath(saved.id))
  }

  const requestError =
    saveError && Object.keys(fieldErrors).length === 0 ? saveError : null

  const typeOptions = useMemo(
    () =>
      KNOWLEDGE_TYPES.map((value) => ({
        id: value,
        label: KNOWLEDGE_TYPE_LABELS[value],
      })),
    [],
  )

  if (!isNew && notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Knowledge not found</p>
          <p className={styles.stateText}>It may belong to another company or was removed.</p>
          <Link to={PATH.KNOWLEDGE} className={styles.secondary}>
            Back to Company Knowledge
          </Link>
        </div>
      </section>
    )
  }

  if (!isNew && error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load knowledge</p>
          <p className={styles.stateText}>{error.message}</p>
          <button type="button" className={styles.secondary} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (!values || loading) {
    return (
      <section className={styles.page}>
        <div className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <p className={styles.intro}>
        {isNew
          ? 'New records are saved as drafts. Approve them from the knowledge list before they can be used as AI context.'
          : 'Editing does not change Proposal Health, Coach, or Improvements. Status changes are explicit.'}
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Title
          {fieldErrors.title ? <em> {fieldErrors.title}</em> : null}
          <input
            value={values.title}
            onChange={(event) => handleChange('title', event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.title)}
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            Type
            <select
              value={values.type}
              onChange={(event) => handleChange('type', event.target.value)}
            >
              {typeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Category
            <select
              value={values.category}
              onChange={(event) => handleChange('category', event.target.value)}
            >
              {KNOWLEDGE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {KNOWLEDGE_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          {isNew ? (
            <p className={styles.readonly}>
              Status
              <span>{KNOWLEDGE_STATUS_LABELS[KNOWLEDGE_STATUS.DRAFT]}</span>
            </p>
          ) : (
            <label className={styles.field}>
              Status
              <select
                value={values.status}
                onChange={(event) => handleChange('status', event.target.value)}
              >
                {KNOWLEDGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {KNOWLEDGE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className={styles.field}>
          Tags
          <input
            value={values.tags}
            onChange={(event) => handleChange('tags', event.target.value)}
            placeholder="warranty, legal, models"
            aria-describedby="knowledge-tags-hint"
          />
        </label>
        <p id="knowledge-tags-hint" className={styles.hint}>
          Comma-separated. Used for search, not scoring.
        </p>

        <label className={styles.field}>
          Content
          {fieldErrors.content ? <em> {fieldErrors.content}</em> : null}
          <textarea
            rows={12}
            value={values.content}
            onChange={(event) => handleChange('content', event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.content)}
          />
        </label>

        {duplicateNote ? (
          <p className={styles.warn} role="status">
            {duplicateNote}
          </p>
        ) : null}
        {requestError ? (
          <p className={styles.error} role="alert">
            {requestError.message || 'Could not save knowledge.'}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={submitting}>
            {submitting ? 'Saving…' : isNew ? 'Save as draft' : 'Save changes'}
          </button>
          <Link to={id ? knowledgePath(id) : PATH.KNOWLEDGE} className={styles.secondary}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}

export default KnowledgeEditor
