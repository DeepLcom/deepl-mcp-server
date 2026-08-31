# Auto-approval rules

This file defines rules Gitar should use to auto-approve merge requests in this
repository. Each rule has a natural-language `When` condition and an `Action`.

This repository is an MCP server published to npm as `deepl-mcp-server`. Users
run it straight from the registry, so its tool surface is a public API and a
break here lands in their MCP client with the next release. semantic-release
cuts every release from `main` without a merge request, which means anything
merged here ships on its own.

Dependency updates are out of scope. Renovate labels its non-major merge
requests `automerge`, and a bot approves and merges them. Major updates change
the SDK, the DeepL client or the toolchain under the server, so they always wait
for a human. Do not auto-approve dependency update merge requests.

## Rule: Documentation-only changes

**When:** Every changed file in the merge request is a Markdown file (`.md`),
and the merge request does not touch source code, CI configuration, or
dependency manifests.

**Action:** Approve the merge request automatically and add the label
`auto-approved`.

## Rule: Test-only changes

**When:** Every changed file in the merge request is under `test/`, and the
merge request does not modify server source code, CI configuration, or
dependency manifests.

**Action:** Approve the merge request automatically and add the label
`auto-approved`.

## Rule: Re-approve after rebase

**When:** The merge request was previously approved by at least one human
reviewer, and the approval was reset solely because the author rebased or
force-pushed. The substantive diff relative to the target branch is identical
to the version that received the original approval, and no new commits with new
logic or content were added since that approval.

**Action:** Approve the merge request automatically and add the label
`auto-approved`.

## Rule: Safe, backwards-compatible change

**When:** All of the following hold for the merge request:

- **CI is green.** The pipeline for the latest commit has completed
  successfully, with no failing, running, or pending required jobs.
- **Tests cover the change if needed.** New or changed server behavior has a
  matching case under `test/`. Changes that genuinely need no tests, such as
  comments or log text, may omit them.
- **The diff matches the MR description.** The code changes do exactly what the
  title and description say, with no unexplained or unrelated changes bundled
  in.
- **The tool surface stays backwards compatible.** Adding new capability is
  fine: a new tool, a new optional input, a new field in a response. What is
  not allowed is breaking what an MCP client already calls. Do not auto-approve
  a removed or renamed tool or tool input, an input that becomes required, a
  narrowed input schema, a changed response shape or content type, a different
  DeepL endpoint behind an existing tool, a raised `engines.node`, or a change
  to the runtime dependencies in `package.json`.

**Action:** Approve the merge request automatically and add the label
`auto-approved`.

> Apply this rule strictly: only approve when the merge request **clearly and
> unambiguously** satisfies every condition above. If any condition is
> uncertain, leave the merge request for human review.

## Rule: Everything else

**When:** The merge request does not clearly satisfy one of the rules above.
This includes CI configuration (`.github/workflows/`, `.gitlab-ci.yml`), the
release configuration (`.releaserc.mjs`), `renovate.json5`,
`.auto-approve.yaml`, `.gitar/**`, and any change to the dependencies in
`package.json` or to `package-lock.json`.

**Action:** Do not auto-approve. Leave the merge request for human review.
