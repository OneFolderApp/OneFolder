# Documentation Guide

Welcome to the `docs/` folder! This guide describes **how we write and maintain documentation** so that it is equally useful to:

- **Humans** – new contributors, reviewers, and future‑you.
- **AIs** – tools like Cursor that rely on concise, well‑structured Markdown for accurate context.

Follow the conventions below and our docs will stay discoverable, trustworthy, and friction‑free.

---

## 1. Purpose of `docs/`

1. **Single source of truth** for the parts that are _not obvious from reading the code_—especially design decisions and the reasons we chose this approach over alternatives—along with architecture and feature behaviour.
2. **Fast context for AI** – Cursor automatically loads Markdown under `docs/` into its context window, letting you prompt with _what_ you want instead of _why_.
3. **Living handbook** – every pull‑request that changes behaviour **must** update or create docs.

> ❗ **Never** leave a feature undocumented. If it is worth merging, it is worth documenting.

---

## 2. Expected Folder Layout

```
project-root/
├── docs/
│   ├── index.md            ← Overview of the app & doc index (see §4)
│   ├── architecture.md     ← High‑level diagrams & design rationale
│   ├── api/
│   │   ├── README.md       ← How to work with external APIs
│   │   └── auth.md
│   ├── features/
│   │   ├── user-profiles.md
│   │   └── notifications.md
│   ├── guides/
│   │   └── local-setup.md
│   ├── glossary.md         ← Domain language & acronyms
│   └── contributing.md     ← How to propose changes to docs/code
└── src/
```

_Feel free to add nested folders to keep related documents together. Keep paths lowercase and use hyphens (**`-`**) not spaces._

---

## 3. Writing Guidelines

| Aspect                | Rule of Thumb                                                         |
| --------------------- | --------------------------------------------------------------------- |
| **Audience**          | Write for a mid‑level engineer new to the codebase.                   |
| **Length**            | Prefer short focused files (< \~300 lines). Split if longer.          |
| **Tone**              | Clear, active voice. Avoid future/tense ambiguity.                    |
| **Headings**          | `#` for title, `##` for major sections, `###` sub‑sections.           |
| **Code blocks**       | Always annotate language (e.g. \`\`\`ts).                             |
| **Cross‑links**       | Use relative links (`[Auth](../api/auth.md)`).                        |
| **Diagrams**          | Use [Mermaid](https://mermaid.js.org/) or ASCII art in fenced blocks. |
| **Metadata**          | Add a YAML front‑matter header (see below) so AIs know the intent.    |
| **Examples > Theory** | Show typical call flows, edge‑cases, and gotchas.                     |

### 3.1 YAML Front‑Matter Template

Place this at the top of every new doc (excluding `index.md`):

```yaml
---
title: User Profiles Feature
author: @alice
last_updated: 2025-07-17
scope: feature
aliases: ["profiles", "users"]
---
```

Cursor treats `title`, `aliases`, and `scope` as high‑value keywords when ranking context.

### 3.2 AI‑Friendly Tips

1. Keep paragraphs under \~120 words.
2. Define **one concept per file**; cross‑reference instead of duplicating.
3. Use bullet lists for key facts – language models recall lists more reliably.
4. Put the "why" before the "how"; motivate design choices.

---

## 4. `docs/index.md` Specification

`index.md` is the single entry point that both humans and Cursor read **first**. It must always answer three questions:

1. **What does the application do?** · A 3–5 sentence elevator pitch.
2. **Where is the code?** · A pruned file‑tree of `src/`, max 2 levels deep.
3. **What documentation exists?** · A bullet list of every file under `docs/` with one‑line summaries.

### 4.1 Mandatory Sections & Order

```md
# <Project Name>

<Brief description of what the app achieves and its primary users.>

---

## Project File Structure (top‑level)
```

\<output of `tree -L 2 -I 'node_modules|dist|.git'` trimmed to essentials>

```

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| [architecture.md](architecture.md) | High‑level component & data‑flow diagrams |
| [api/README.md](api/README.md) | How to consume third‑party APIs |
| ... | ... |
```

Keep the table alphabetically sorted. When you add a new doc, update this list in the same pull‑request.

### 4.2 Regeneration Helper Prompt

> **Tip:** Paste the following into Cursor to regenerate `index.md` automatically when adding files:
>
> ```cursor
> # SYSTEM
> You are UpdateIndexBot.  Scan docs/, list each .md file (max depth 2) with one‑line summary (first H1 or YAML title).  Rewrite docs/index.md accordingly.
> ```

---

## 6. Keeping Docs Alive

- **Review** – During code‑review, missing docs are a change‑request.
- **Refactor** – When deleting or moving code, delete/move its docs too.
- **Automate** – Consider adding a CI job that fails if `index.md` is stale (compare `git diff --name-only HEAD~1 docs/`).

---

## 7. Further Reading

[Diátaxis Documentation Framework](https://diataxis.fr/) – inspiration for splitting docs by purpose.

- [Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/) – clear, consistent technical prose.

---

Happy documenting! \:sparkles:
