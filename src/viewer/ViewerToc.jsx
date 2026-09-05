import Icon from '../components/Icon/Icon.jsx'
import { useViewer } from './ViewerContext.jsx'
import { scrollToSection } from './useScrollSpy.js'
import styles from './ViewerToc.module.css'

function ViewerToc({ sections, activeId, living = false }) {
  const { drawerOpen, setDrawerOpen } = useViewer()

  function jump(id) {
    scrollToSection(id)
    setDrawerOpen(false)
  }

  const list = (
    <ol className={styles.list}>
      {sections.map((section) => (
        <li key={section.id}>
          <button
            type="button"
            className={`${styles.link} ${activeId === section.id ? styles.active : ''}`}
            onClick={() => jump(section.id)}
          >
            {section.title}
          </button>
        </li>
      ))}
    </ol>
  )

  const chips = living ? (
    <div className={styles.chips} role="navigation" aria-label="Proposal sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`${styles.chip} ${activeId === section.id ? styles.chipActive : ''}`}
          data-block-id={section.blockId ?? section.id}
          onClick={() => jump(section.id)}
        >
          {section.title}
        </button>
      ))}
    </div>
  ) : null

  return (
    <>
      <div className={living ? styles.mobileNav : undefined}>
        <button
          type="button"
          className={styles.menu}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open sections"
        >
          <Icon name="menu" size={16} />
          Contents
        </button>
        {chips}
      </div>

      <nav className={styles.rail} aria-label="Proposal sections">
        <p className={styles.kicker}>Contents</p>
        {list}
      </nav>

      {drawerOpen ? (
        <div className={styles.drawer} role="dialog" aria-label="Sections">
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close sections"
            onClick={() => setDrawerOpen(false)}
          />
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <p className={styles.kicker}>Contents</p>
              <button
                type="button"
                className={styles.close}
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            {list}
          </div>
        </div>
      ) : null}
    </>
  )
}

export default ViewerToc
