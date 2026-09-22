import { assertStorageWritable, endJsonResponse, flushAndNext, ignoreUnavailableWrite, readJson, writeJson } from './runtimeStore.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { findWorkflowByProposal } from '../src/workflow/store.js'
import { findPortalByProposal } from '../src/portal/store.js'
import { listInteractionsForProposal } from '../src/interactions/store.js'
import {
  findLivingSessionByShareToken,
  listLivingSessionsForProposal,
} from '../src/living/store.js'
import {
  allFollowupRecords,
  configureFollowupResolvers,
  configureFollowupStore,
  replaceFollowupRecords,
} from '../src/followup/index.js'
import {
  allLivingEngagementEvents,
  allLivingPublications,
  allLivingSessions,
  applyLivingDecisions,
  configureLivingEventStore,
  configureLivingPublicationStore,
  configureLivingResolvers,
  configureLivingStore,
  getLivingClientView,
  getLivingPublicationState,
  getLivingSnapshot,
  getLivingStudioSummary,
  LIVING_CAPABILITIES,
  listLivingSnapshots,
  listStudioLivingEngagementEvents,
  publishLivingProposal,
  recordLivingEngagementEvent,
  replaceLivingEngagementEvents,
  replaceLivingPublications,
  replaceLivingSessions,
} from '../src/living/index.js'

function json(res, status, body) {
  return endJsonResponse(res, status, body)
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('Payload is too large.'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function matchRoute(url, pattern) {
  const path = url.split('?')[0]
  const routeParts = pattern.split('/')
  const pathParts = path.split('/')
  if (routeParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < routeParts.length; i += 1) {
    if (routeParts[i].startsWith(':')) {
      params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i])
      continue
    }
    if (routeParts[i] !== pathParts[i]) return null
  }
  return params
}

function queryOf(url) {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  return new URLSearchParams(q)
}

function fail(res, error) {
  if (error instanceof ValidationError) {
    return json(res, 400, { message: error.message, errors: error.errors })
  }
  if (error instanceof ForbiddenError) {
    return json(res, 403, {
      message: error.message,
      reason: error.reason,
    })
  }
  if (error instanceof NotFoundError) {
    return json(res, 404, {
      message: error.message,
      reason: error.reason,
    })
  }
  const status = error.status ?? 500
  return json(res, status, { message: error.message || 'Living request failed.' })
}

function companyFrom(body, query) {
  return body?.companyId || query?.get?.('companyId') || DEFAULT_COMPANY_ID
}

/**
 * Persist living sessions to `data/living.json`, engagement events to
 * `data/living-events.json`, and publications to `data/living-publications.json`.
 * Decision side-effects may reconcile H13 follow-ups into `data/followups.json`.
 * Never writes `data/proposals.json`.
 */
export function livingPlugin() {
  let ready = false
  let followupReady = false
  let proposals = []

  function persistSessions(records) {
    assertStorageWritable()
    return writeJson('living.json', records)
  }

  function persistEvents(records) {
    assertStorageWritable()
    return writeJson('living-events.json', records)
  }

  function persistPublications(records) {
    assertStorageWritable()
    return writeJson('living-publications.json', records)
  }

  function persistFollowups(records) {
    assertStorageWritable()
    return writeJson('followups.json', records)
  }

  function readProposals() {
    return Array.isArray(proposals) ? proposals : []
  }

  async function refreshProposals() {
    const stored = await readJson('proposals.json', [])
    proposals = Array.isArray(stored) ? stored : []
    return proposals
  }

  async function ensureFollowupStore() {
    if (followupReady) return
    const stored = await readJson('followups.json', null)
    if (Array.isArray(stored)) {
      replaceFollowupRecords(stored)
    } else {
      replaceFollowupRecords([])
      await ignoreUnavailableWrite(() => persistFollowups(allFollowupRecords()))
    }
    configureFollowupStore({ persist: persistFollowups })
    configureFollowupResolvers({
      getProposal(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy =
          String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (ownedBy !== companyId) return null
        return found
      },
      listProposals(companyId) {
        return readProposals().filter((item) => {
          const ownedBy =
            String(item.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
          return ownedBy === companyId
        })
      },
      getWorkflow(companyId, proposalId) {
        return findWorkflowByProposal(companyId, proposalId) ?? null
      },
      getPortal(companyId, proposalId) {
        return findPortalByProposal(companyId, proposalId) ?? null
      },
      getInteractions(companyId, proposalId) {
        return listInteractionsForProposal(companyId, proposalId)
      },
      getLivingSession(companyId, proposalId) {
        const proposal = readProposals().find((item) => item.id === proposalId)
        if (proposal?.shareToken) {
          const byToken = findLivingSessionByShareToken(proposal.shareToken)
          if (byToken) return byToken
        }
        const sessions = listLivingSessionsForProposal(proposalId)
        return sessions.find((item) => item.companyId === companyId) ?? sessions[0] ?? null
      },
    })
    followupReady = true
  }

  async function ensureStore() {
    if (ready) return
    const storedSessions = await readJson('living.json', null)
    if (Array.isArray(storedSessions)) {
      replaceLivingSessions(storedSessions)
    } else {
      replaceLivingSessions([])
      await ignoreUnavailableWrite(() => persistSessions(allLivingSessions()))
    }
    configureLivingStore({ persist: persistSessions })

    const storedEvents = await readJson('living-events.json', null)
    if (Array.isArray(storedEvents)) {
      replaceLivingEngagementEvents(storedEvents)
    } else {
      replaceLivingEngagementEvents([])
      await ignoreUnavailableWrite(() => persistEvents(allLivingEngagementEvents()))
    }
    configureLivingEventStore({ persist: persistEvents })

    const storedPublications = await readJson('living-publications.json', null)
    if (Array.isArray(storedPublications)) {
      replaceLivingPublications(storedPublications)
    } else {
      replaceLivingPublications([])
      await ignoreUnavailableWrite(() => persistPublications(allLivingPublications()))
    }
    configureLivingPublicationStore({ persist: persistPublications })

    configureLivingResolvers({
      getProposalByShareToken(shareToken) {
        const token = String(shareToken ?? '').trim()
        if (!token) return null
        return readProposals().find((item) => item.shareToken === token) ?? null
      },
      getProposalById(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy =
          String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (companyId && ownedBy !== companyId) return null
        return found
      },
    })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/living')) return flushAndNext(next)

    const method = req.method || 'GET'

    try {
      // Hydrate inside try/catch so persisted close/payment event types that fail
      // schema validation return JSON errors instead of crashing the process.
      await ensureStore()
      await refreshProposals()
      if (method === 'GET' && matchRoute(url, '/api/living/capabilities')) {
        return json(res, 200, { capabilities: LIVING_CAPABILITIES })
      }

      const studioSnapshotOne = matchRoute(
        url,
        '/api/living/proposal/:proposalId/snapshots/:snapshotId',
      )
      if (studioSnapshotOne) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          getLivingSnapshot({
            proposalId: studioSnapshotOne.proposalId,
            snapshotId: studioSnapshotOne.snapshotId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const studioSnapshots = matchRoute(url, '/api/living/proposal/:proposalId/snapshots')
      if (studioSnapshots) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          listLivingSnapshots({
            proposalId: studioSnapshots.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const studioPublication = matchRoute(
        url,
        '/api/living/proposal/:proposalId/publication',
      )
      if (method === 'GET' && studioPublication) {
        const query = queryOf(url)
        return json(
          res,
          200,
          getLivingPublicationState({
            proposalId: studioPublication.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const studioPublish = matchRoute(url, '/api/living/proposal/:proposalId/publish')
      if (method === 'POST' && studioPublish) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(
          res,
          201,
          publishLivingProposal({
            proposalId: studioPublish.proposalId,
            companyId: companyFrom(body, null),
            publishedBy: body.publishedBy,
          }),
        )
      }

      const studioEvents = matchRoute(url, '/api/living/proposal/:proposalId/events')
      if (studioEvents) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          listStudioLivingEngagementEvents({
            proposalId: studioEvents.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const studio = matchRoute(url, '/api/living/proposal/:proposalId')
      if (method === 'GET' && studio) {
        const query = queryOf(url)
        return json(
          res,
          200,
          getLivingStudioSummary({
            proposalId: studio.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const publicSnapshots = matchRoute(url, '/api/living/:token/snapshots')
      if (publicSnapshots) {
        return json(res, 403, {
          message: 'Living publication snapshots are studio-only.',
          reason: 'studio_only',
        })
      }

      const publicPublication = matchRoute(url, '/api/living/:token/publication')
      if (publicPublication) {
        return json(res, 403, {
          message: 'Living publication controls are studio-only.',
          reason: 'studio_only',
        })
      }

      const events = matchRoute(url, '/api/living/:token/events')
      if (events) {
        if (method === 'GET') {
          return json(res, 403, {
            message: 'Living engagement feeds are studio-only.',
            reason: 'studio_only',
          })
        }
        if (method !== 'POST') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(
          res,
          201,
          {
            event: recordLivingEngagementEvent({
              shareToken: events.token,
              type: body.type,
              blockId: body.blockId,
              offerId: body.offerId,
              sessionId: body.sessionId,
              metadata: body.metadata,
              at: body.at,
              // Ignored identity / money fields — token establishes proposal.
              proposalId: body.proposalId,
              companyId: body.companyId,
              amount: body.amount,
              total: body.total,
              selectedTotal: body.selectedTotal,
              packageAmount: body.packageAmount,
            }),
          },
        )
      }

      const decisions = matchRoute(url, '/api/living/:token/decisions')
      if (method === 'POST' && decisions) {
        await ensureFollowupStore()
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const patch = { shareToken: decisions.token }
        if ('selectedPackageId' in body) patch.selectedPackageId = body.selectedPackageId
        if ('selectedAlternativeId' in body) {
          patch.selectedAlternativeId = body.selectedAlternativeId
        }
        if ('selectedAddonIds' in body) patch.selectedAddonIds = body.selectedAddonIds
        if ('toggleAddonId' in body) patch.toggleAddonId = body.toggleAddonId
        if ('amount' in body) patch.amount = body.amount
        if ('total' in body) patch.total = body.total
        if ('selectedTotal' in body) patch.selectedTotal = body.selectedTotal
        if ('packageAmount' in body) patch.packageAmount = body.packageAmount
        return json(res, 200, applyLivingDecisions(patch))
      }

      const client = matchRoute(url, '/api/living/:token')
      if (method === 'GET' && client) {
        if (client.token === 'proposal' || client.token === 'capabilities') {
          return flushAndNext(next)
        }
        return json(res, 200, getLivingClientView({ shareToken: client.token }))
      }

      return flushAndNext(next)
    } catch (error) {
      return fail(res, error)
    }
  }

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-living',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
