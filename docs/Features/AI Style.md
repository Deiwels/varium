# AI Style

## Overview
AI-powered branding/styling using Anthropic Claude API. Generates custom visual themes for booking pages.

## Endpoint
- `POST /api/ai/generate-style` — generates CSS/style based on business info

## Key Facts
- Available on ALL subscription plans (recent change)
- Targets ALL page elements including booking flow
- Uses Dark Cosmos as base style system
- Hero image support via `hero_media_url` setting
- When active: hides default cosmos background, applies clean canvas

## Frontend
- `/settings` — AI style configuration
- `/book/[id]` — booking page where style is applied
- Booking flow has dedicated class for AI style targeting

## Recent Fixes
- AI style full background control — hide cosmos, clean canvas
- AI style properly applied on booking page
- Hero image saving (hero_media_url added to allowed settings)
