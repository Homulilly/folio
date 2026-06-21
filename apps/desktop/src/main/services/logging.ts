import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, crashReporter, shell } from 'electron'

// Diagnostics: a native crash reporter (dumps kept on disk, never uploaded — offline-first per §13)
// plus a human-readable main-process log capturing uncaught errors and renderer/child crashes.

/** Folder holding the human-readable log; native crash dumps live under userData/Crashpad. */
export function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

function logFile(): string {
  return join(logsDir(), 'main.log')
}

/** Append a timestamped line. Never throws — a logging failure must not take down the process. */
function appendLine(line: string): void {
  try {
    mkdirSync(logsDir(), { recursive: true })
    appendFileSync(logFile(), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore: logging is best-effort
  }
}

/** Start Electron's native crash reporter. Dumps are kept locally and never sent anywhere.
 * Call before app `ready` (Electron's recommendation for capturing early crashes). */
export function startCrashReporter(): void {
  crashReporter.start({
    productName: 'Folio',
    companyName: 'Folio',
    uploadToServer: false,
  })
}

/** Install process- and app-level error logging. Call after app is ready (needs the userData path). */
export function initLogging(): void {
  process.on('uncaughtException', (err) => {
    appendLine(`[uncaughtException] ${err?.stack ?? String(err)}`)
  })
  process.on('unhandledRejection', (reason) => {
    appendLine(`[unhandledRejection] ${reason instanceof Error ? reason.stack : String(reason)}`)
  })
  app.on('render-process-gone', (_e, _wc, details) => {
    appendLine(`[render-process-gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })
  app.on('child-process-gone', (_e, details) => {
    appendLine(`[child-process-gone] type=${details.type} reason=${details.reason}`)
  })
  appendLine(
    `[start] Folio ${app.getVersion()} electron=${process.versions.electron} ${process.platform}/${process.arch}`,
  )
}

/** Reveal the logs folder in the OS file manager (Settings → Diagnostics). */
export async function openLogs(): Promise<void> {
  try {
    mkdirSync(logsDir(), { recursive: true })
  } catch {
    // ignore: openPath below still surfaces a useful error if the dir is truly unavailable
  }
  await shell.openPath(logsDir())
}
