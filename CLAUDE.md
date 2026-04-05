# arlemo-llc.github.io — Project Instructions

## What This Is
Arlemo LLC company website. Static site hosted on GitHub Pages at arlemo.com.

## No Local Memory — Repo Docs Are the Source of Truth
Do not use Claude Code's file-based memory system (`~/.claude/projects/.../memory/`) for this project. All project context lives in the repo's files — versioned, portable, readable without Claude running.

## Key Docs
- [developer.md](developer.md) — pointer to canonical profile in Process repo

## Routines
At the start of every conversation:
1. Run `git pull` to get the latest from remote.
2. Check git status and recent commits.
3. Brief summary of current state.
