#!/usr/bin/env node
/**
 * check-build-portability.mjs — keep the locally-run npm scripts runnable on Windows.
 *
 *   node scripts/check-build-portability.mjs
 *
 * ## Why this exists
 *
 * npm runs scripts through a shell, and on Windows that shell is cmd.exe. cmd
 * has no inline environment-variable prefix: `FOO=bar cmd` is not "run cmd with
 * FOO set", it is a request to execute a program literally named `FOO=bar`. So
 * a script written in the POSIX `VAR=value cmd` form does not run with the wrong
 * environment on Windows — it does not run at all:
 *
 *   'NODE_OPTIONS' is not recognized as an internal or external command,
 *   operable program or batch file.
 *
 * 7d11132 raised the Next build's heap that way to stop Railway's builder OOMing.
 * It fixed Railway (Linux, sh) and simultaneously broke `npm run build` on the
 * Windows dev box, where the command aborted before Next was ever invoked. The
 * failure names NODE_OPTIONS rather than anything the developer changed, so it
 * reads as a broken checkout rather than a broken script.
 *
 * ## Why it is scoped to the scripts developers run locally
 *
 * `start` is deliberately exempt. It uses `TZ="America/New_York"` and
 * `${PORT:-3000}`, both POSIX-only, and it is equally unrunnable on Windows —
 * but it is Railway's runtime entrypoint, not something anyone invokes on the
 * dev box, and PORT only exists in Railway's environment anyway. Making it
 * cross-platform would be a change nobody needs. This check guards the scripts
 * whose breakage actually costs someone a debugging session.
 *
 * ## Why a script and not a test
 *
 * There is no test runner in this project. This is plain Node with no
 * dependencies, run the same way `wrap-artifact.mjs` is.
 */

import { readFileSync } from "node:fs";

/**
 * Scripts a developer runs on their own machine. Anything not listed here is
 * assumed to run only on Railway; see the scoping note above.
 */
const LOCAL_SCRIPTS = ["dev", "build", "lint"];

/** A leading `VAR=value` on a command — cmd.exe reads this as a program name. */
const ENV_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** POSIX parameter expansion such as `${PORT:-3000}` — cmd.exe does not expand it. */
const POSIX_EXPANSION = /\$\{[^}]*\}/;

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = pkg.scripts ?? {};
const problems = [];

for (const name of LOCAL_SCRIPTS) {
  const command = scripts[name];
  if (command === undefined) continue;

  // `a && b`, `a || b` and `a; b` each start a fresh command, so every segment
  // needs checking, not just the first.
  for (const segment of command.split(/&&|\|\||;/)) {
    const trimmed = segment.trim();
    if (ENV_PREFIX.test(trimmed)) {
      problems.push(
        `${name}: "${trimmed.split(/\s+/)[0]}" is a POSIX env-var prefix; ` +
          `cmd.exe treats it as the program to run, so the script aborts on Windows.`
      );
    }
    if (POSIX_EXPANSION.test(trimmed)) {
      problems.push(
        `${name}: "${trimmed.match(POSIX_EXPANSION)[0]}" is POSIX parameter ` +
          `expansion; cmd.exe passes it through literally.`
      );
    }
  }
}

/**
 * The heap limit itself must survive. Dropping it is what made every Railway
 * deployment fail silently from 2026-09-20 — the site kept serving a stale
 * image, so nothing looked wrong. A cross-platform rewrite that quietly loses
 * the flag would reintroduce exactly that.
 */
if (scripts.build !== undefined && !/max[-_]old[-_]space[-_]size/.test(scripts.build)) {
  problems.push(
    "build: the raised heap limit is gone. Railway's builder OOMs without it " +
      "(see 7d11132), and a failed build there is invisible — the last good " +
      "image keeps serving."
  );
}

if (problems.length > 0) {
  console.error("Build scripts are not portable to the Windows dev box:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`OK — ${LOCAL_SCRIPTS.length} locally-run scripts are cross-platform.`);
