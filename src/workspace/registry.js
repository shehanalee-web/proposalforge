import { WORKSPACE_GROUPS } from './ids.js'
import { WORKSPACE_MODULES } from './modules.js'

const MODULE_BY_ID = new Map(
  WORKSPACE_MODULES.map((module) => [module.id, module]),
)

const MODULE_BY_PATH = new Map(
  WORKSPACE_MODULES.map((module) => [module.path, module]),
)

/**
 * @param {string} id
 * @returns {import('./modules.js').WorkspaceModule | undefined}
 */
export function getWorkspaceModule(id) {
  return MODULE_BY_ID.get(id)
}

/**
 * @param {string} path
 * @returns {import('./modules.js').WorkspaceModule | undefined}
 */
export function getWorkspaceModuleByPath(path) {
  return MODULE_BY_PATH.get(path)
}

export function listWorkspaceModules() {
  return WORKSPACE_MODULES
}

export function listNavModules() {
  return WORKSPACE_MODULES.filter((module) => module.inNav)
}

/**
 * Nav modules grouped for the sidebar.
 *
 * @returns {{ id: string, label: string, modules: import('./modules.js').WorkspaceModule[] }[]}
 */
export function listNavGroups() {
  const byGroup = new Map()

  for (const module of listNavModules()) {
    const current = byGroup.get(module.group) ?? []
    current.push(module)
    byGroup.set(module.group, current)
  }

  return WORKSPACE_GROUPS.map((group) => ({
    ...group,
    modules: byGroup.get(group.id) ?? [],
  })).filter((group) => group.modules.length > 0)
}
