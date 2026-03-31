# pitchmasters.club

## What It Is

pitchmasters.club is a **community self-improvement tool for hackers** to practice and improve their pitching skills.

**The deeper insight:** Messaging and communication is natural and effortless for some people, but extractively difficult and opaque for others who may be very talented and skilled at building products. People can spend years reading startup books and all the classics, but this is like trying to learn karate by only reading books - you need to practice, get feedback, and iterate.

## The Problem

Hackers build good projects but often pitch them poorly. But there's a deeper issue: some people release garbage projects that become wildly successful (good marketing/pitching), while passionate, dedicated developers with high-quality software go completely unseen (bad pitching).

This tool is for ANY project - hackathon projects AND open source GitHub projects. The goal is the same: practice communicating what your project is so people actually notice it.

## How It Works

1. **Import a project** - Hacker imports a project they pitched (from Devpost URL or manually). Includes: title, short description, longer story, video, GitHub, website.

2. **People watch the pitch** - Others view the project page (video + description) and write what they think the product is - their honest interpretation of what they saw.

3. **Hacker reviews feedback** - The hacker who made the project sees these descriptions and thinks: "aha! I miscommunicated this" or "I did that wrong."

4. **Rate the attempted descriptions** - Hacker marks each description as "correct" (they understood correctly) or "incorrect" (they got the wrong idea).

5. **Improve with revisions** - Hacker updates the pitch with a new revision. NEW people try again - hacker sees if communication accuracy improved.

6. **Track accuracy over time** - Hacker can see their communication accuracy across revisions - this is the fundamental feedback loop for improvement.

## Key Features

- Import projects from Devpost or GitHub (scrapes title, description, readme, links)
- Multiple revisions per project
- Responses have an `isCorrect` field: `null` (not rated), `0` (incorrect), `1` (correct)
- Embedded YouTube video player
- Clean, modern UI

## Data Model

- **Users** - id, githubId, username, displayName, avatarUrl
- **Projects** - id, userId, title, provenanceUrl (unique per user), createdAt
- **Revisions** - id, projectId, revisionNumber, description, videoUrl, githubUrl, websiteUrl
- **Responses** - id, revisionId, userId, description, isCorrect (null/0/1), createdAt