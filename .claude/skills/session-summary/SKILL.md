---
name: session-summary
description: >
  Produces a brief, copy-pasteable recap of the current conversation so the user can carry it
  into a new session (pasted as the opening message) once this one ends or its context is
  compacted. USE THIS SKILL whenever the user asks to summarize the session, wrap up, recap
  what was done, or says anything like "summarize this session", "give me a recap", "give me
  something to paste into a new chat", "wrap this up for next time". Output only — never
  writes anything to disk.
---

# Session Summary Skill

Recaps the current conversation into a short block the user can copy and paste as the first message of a fresh session.

---

## Step 1 — Review the conversation

Go back over what actually happened in this session, not what was discussed in passing:
- What was the overall goal or starting request?
- What concrete work was done — files created/changed, skills added, commands run, decisions made?
- What was decided and *why* (the reasoning is more valuable than the fact, since a new session can read the diff itself but not the reasoning)
- What's still open — unanswered questions, unfinished steps, things the user said "later" to

Don't pad this with things that were discussed and then abandoned or superseded — only the current, final state matters.

---

## Step 2 — Produce the recap

Output a single fenced code block (so it's trivially selectable/copyable) with this shape:

```
## Session recap — <one-line topic>

**Goal:** <what this session set out to do>

**Done:**
- <concrete accomplishment, file/skill name if relevant>
- ...

**Decisions:**
- <decision — brief why, if the why isn't obvious from the decision alone>
- ...

**Open / next:**
- <unresolved question or next step>
- ...
```

Keep every bullet to one line. Omit any section that's empty (e.g. no "Open / next" if nothing is outstanding) rather than writing "None".

After the block, add one line:
> Paste this at the start of your next session to pick back up.

---

## Notes

- This skill never writes to a file — output only. If the user wants it saved somewhere, that's a separate explicit request, not this skill's job.
- Keep it brief — this is a recap, not a transcript. If the session covered a lot, favor the final decisions over the path taken to reach them.
- Don't re-fetch external context (tickets, PRs) — this is purely about what happened in this conversation.
