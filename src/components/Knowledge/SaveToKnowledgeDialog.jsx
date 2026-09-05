import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { getBlockMeta } from '../../blocks/editor/blockMeta.js'
import { useKnowledgeMutations } from '../../hooks/useKnowledgeMutations.js'
import {
  DEFAULT_COMPANY_ID,
  KNOWLEDGE_TYPE,
  KNOWLEDGE_TYPES,
  KNOWLEDGE_TYPE_LABELS,
} from '../../knowledge/types.js'
import { draftFieldsFromProposalBlock } from '../../knowledge/sources.js'
import { fetchKnowledgeDuplicates } from '../../services/knowledgeService.js'
import { PATH } from '../../workspace/paths.js'
import styles from './SaveToKnowledgeDialog.module.css'

function SaveToKnowledgeDialog({
  open,
  block,
  proposalId,
  companyId = DEFAULT_COMPANY_ID,
  onClose,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const { saveFromProposal, submitting, error, fieldErrors, reset } = useKnowledgeMutations()
  const extracted = useMemo(() => {
    if (!block) return null
    const fields = draftFieldsFromProposalBlock(block)
    const fallback = getBlockMeta(block.type).label
    return {
      ...fields,
      title:
        fields.title && fields.title !== 'Reusable proposal block'
          ? fields.title
          : fallback,
    }
  }, [block])

  const [title, setTitle] = useState('')
  const [type, setType] = useState(KNOWLEDGE_TYPE.PROPOSAL_BLOCK)
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(null)
  const [duplicates, setDuplicates] = useState([])

  useEffect(() => {
    if (!open || !extracted) return
    setTitle(extracted.title)
    setType(extracted.type)
    setContent(extracted.content)
    setSaved(null)
    setDuplicates([])
    reset()
  }, [open, extracted, reset])

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  useEffect(() => {
    if (!open || !content.trim()) {
      setDuplicates([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const found = await fetchKnowledgeDuplicates({
          companyId,
          title,
          content,
        })
        if (!cancelled) setDuplicates(found)
      } catch {
        if (!cancelled) setDuplicates([])
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, companyId, title, content])

  async function handleSubmit(event) {
    event.preventDefault()
    const record = await saveFromProposal({
      companyId,
      proposalId,
      block,
      title,
      type,
      content,
    })
    if (record) setSaved(record)
  }

  const node = (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Save to Company Knowledge
          </h2>
          <p className={styles.lede}>
            This creates a <strong>draft</strong>. It will not be used in AI context until someone
            approves it in Company Knowledge.
          </p>
        </div>

        {saved ? (
          <div className={styles.body}>
            <p className={styles.success} role="status">
              Saved as draft: {saved.title}
            </p>
            <div className={styles.footer}>
              <Link className={styles.primary} to={`${PATH.KNOWLEDGE}/${saved.id}`}>
                Open in Company Knowledge
              </Link>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  aria-invalid={Boolean(fieldErrors.title)}
                />
              </label>
              <label className={styles.field}>
                <span>Type</span>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  {KNOWLEDGE_TYPES.map((id) => (
                    <option key={id} value={id}>
                      {KNOWLEDGE_TYPE_LABELS[id]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Content</span>
                <textarea
                  rows={8}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  required
                  aria-invalid={Boolean(fieldErrors.content)}
                />
              </label>
              {duplicates.length > 0 ? (
                <p className={styles.warn} role="status">
                  Possible duplicate: {duplicates[0].title}. Nothing will be merged automatically.
                </p>
              ) : null}
              {error ? (
                <p className={styles.error} role="alert">
                  {error.message || 'Could not save to Company Knowledge.'}
                </p>
              ) : null}
            </div>
            <div className={styles.footer}>
              <button type="submit" className={styles.primary} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save as draft'}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  )

  if (typeof document === 'undefined') return node
  return createPortal(node, document.body)
}

export default SaveToKnowledgeDialog
