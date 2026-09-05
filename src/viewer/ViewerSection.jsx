import { useEffect, useRef, useState } from 'react'
import styles from './ViewerSection.module.css'

function ViewerSection({ id, children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.12 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      id={`viewer-section-${id}`}
      data-section-id={id}
      data-block-id={id}
      className={`${styles.section} ${visible ? styles.visible : ''}`}
    >
      {children}
    </section>
  )
}

export default ViewerSection
