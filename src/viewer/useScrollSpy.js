import { useEffect, useState } from 'react'
import { sectionElementId } from './sectionMeta.js'

export function useScrollSpy(sectionIds, { offset = 0.28 } = {}) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? null)

  useEffect(() => {
    if (sectionIds.length === 0) return undefined

    const nodes = sectionIds
      .map((id) => document.getElementById(sectionElementId(id)))
      .filter(Boolean)

    if (nodes.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = visible?.target?.getAttribute('data-section-id')
        if (id) setActiveId(id)
      },
      { rootMargin: `-${Math.round(offset * 100)}% 0px -45% 0px`, threshold: [0.15, 0.4, 0.7] },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [sectionIds, offset])

  return activeId
}

export function scrollToSection(id) {
  const node = document.getElementById(sectionElementId(id))
  if (!node) return
  node.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
