import { Link } from 'react-router'
import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { useBrandKit } from '../../hooks/useBrandKit.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'
import { PATH } from '../../workspace/paths.js'

function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'PF'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function Team() {
  const { kit } = useBrandKit()
  const members = kit?.teamMembers ?? []

  return (
    <WorkspacePlaceholder
      moduleId={WORKSPACE_MODULE.TEAM}
      action={
        <Link to={PATH.BRAND_KIT} className={styles.action}>
          Edit in Brand Kit
        </Link>
      }
    >
      {members.length === 0 ? (
        <p className={styles.emptyNote}>
          No team members yet. Add people in Brand Kit and they appear here and
          on proposals with a Team block.
        </p>
      ) : (
        <ul className={styles.records}>
          {members.map((member) => (
            <li key={member.id} className={styles.record}>
              {member.portrait?.url ? (
                <img src={member.portrait.url} alt="" className={styles.portrait} />
              ) : (
                <span className={styles.portraitFallback}>
                  {initials(member.name)}
                </span>
              )}
              <div className={styles.recordBody}>
                <p className={styles.recordTitle}>
                  {member.name.trim() || 'Untitled'}
                </p>
                <p className={styles.recordMeta}>
                  {member.role.trim() || 'No role'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePlaceholder>
  )
}

export default Team
