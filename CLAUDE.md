# arlemo-llc.github.io — Project Instructions

## What This Is
Arlemo LLC company website. Static site hosted on GitHub Pages at arlemo.com.

## Repo-Canonical Memory Policy
Git-tracked repo files are the source of truth for this project.

Do not treat Claude Code's file-based memory system
(`~/.claude/projects/.../memory/`) as authoritative project memory.

Local transcript/history search is allowed only as a continuity fallback when
Jeff asks what was decided earlier, when the repo seems stale, or when there is
an obvious mismatch between repo state and recent session history.

If continuity is recovered from local transcripts/history, write the durable
parts back into repo files before relying on them going forward.

## Local Settings Policy

`/Users/jeff/Arlemo/arlemo-llc.github.io/.claude/settings.local.json` is
prohibited. This project should stay simple and portable.

## Key Docs
- [developer.md](developer.md) — pointer to canonical profile in Process repo

## Routines
At the start of every conversation:
1. Run `git pull` to get the latest from remote.
2. Check git status and recent commits.
3. If there is a continuity mismatch or Jeff asks about prior decisions, check
   local transcripts/history on this machine only as a fallback, then write any
   durable recovered context back into repo files.
4. Brief summary of current state.
