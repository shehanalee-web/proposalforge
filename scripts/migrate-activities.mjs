/**
 * H16.8 — Apply numbered Activity SQL migrations.
 *
 * Ops command. Never invoked by the HTTP plugin. Exit 2 if the DSN is missing.
 * Does not print the connection string.
 */
import { migrateActivities } from '../src/persistence/migrate.js'

const result = await migrateActivities()
const stream = result.ok ? process.stdout : process.stderr
if (result.message) stream.write(`${result.message}\n`)
process.exit(result.code)
