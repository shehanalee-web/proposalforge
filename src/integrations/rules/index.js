/**
 * H16.3 — Automation Rules Engine public surface.
 */

import { setAutomationEventAcceptedListener } from '../events/intake.js'
import { onAutomationEventAccepted } from './engine.js'

// Wire H16.2 → H16.3 without intake importing the rules engine.
setAutomationEventAcceptedListener(onAutomationEventAccepted)

export {
  AUTOMATION_RULE_SCHEMA_VERSION,
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_RULE_ACTION_TYPES,
  AUTOMATION_RULE_CONDITION_OP,
  AUTOMATION_RULE_CONDITION_OPS,
  AUTOMATION_RULE_EVENT_PATHS,
  AUTOMATION_RULE_RUN_STATUS,
  AUTOMATION_RULE_RUN_STATUSES,
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_LIMITS,
} from './types.js'

export {
  isAllowedAutomationRuleEventPath,
  readAutomationEventPath,
  makeAutomationRule,
  cloneAutomationRule,
  nextAutomationRuleVersion,
  presentStudioAutomationRule,
  makeAutomationRuleExecutionKey,
  makeAutomationRuleRun,
  cloneAutomationRuleRun,
  presentStudioAutomationRuleRun,
} from './schema.js'

export {
  evaluateAutomationPredicate,
  evaluateAutomationConditions,
} from './conditions.js'

export {
  resolveAutomationActionParam,
  executeAutomationAction,
} from './actions.js'

export {
  configureAutomationRulesStore,
  allAutomationRules,
  allAutomationRuleRuns,
  replaceAutomationRules,
  replaceAutomationRuleRuns,
  resetAutomationRulesStore,
  resetAutomationRuleRunsStore,
  serializeAutomationRules,
  serializeAutomationRuleRuns,
  findAutomationRuleById,
  findAutomationRuleRunByIdempotencyKey,
  getAutomationRuleForCompany,
  listAutomationRulesForCompany,
  listEnabledAutomationRulesForCompany,
  listAutomationRuleRunsForCompany,
  upsertAutomationRuleRecord,
  deleteAutomationRuleRecord,
  recordAutomationRuleRun,
} from './store.js'

export {
  getAutomationRuleEvaluationDepth,
  isAutomationRuleEvaluationActive,
  evaluateAutomationRulesForEvent,
  onAutomationEventAccepted,
} from './engine.js'

export {
  listStudioAutomationRules,
  getStudioAutomationRule,
  upsertStudioAutomationRule,
  patchStudioAutomationRule,
  deleteStudioAutomationRule,
  listStudioAutomationRuleRuns,
} from './repository.js'
