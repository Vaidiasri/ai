# Voice assistant (Vapi)

## Overview

The `/voice` page runs a Vapi voice call in the browser. The assistant (id in `NEXT_PUBLIC_VAPI_ASSISTANT_ID`) is configured in the Vapi dashboard, and its tools currently run on the client inside `VapiWidget.tsx`. A server webhook for the same tools also exists.

## Key files

| File | Owns |
| --- | --- |
| `src/components/voice/VapiWidget.tsx` | Starts the call, listens for `tool-calls` / `function-call` messages, runs `get_doctors`, `initiate_payment`, `book_appointment`, and sends results back as `role: "tool"` messages |
| `src/lib/vapi.ts` | The shared `Vapi` client and `isVapiConfigured` flag |
| `src/app/api/vapi/tools/route.ts` | Server tool webhook (`get_doctors`, `get_current_user`, `book_appointment`), checked by `verifyVapiWebhookSecret` |
| `src/lib/services/appointment-booking.ts` | `createAppointmentForClerkUser`, the one booking path both sides call |
| `src/lib/vapi-prompt.ts` | A multi specialty system prompt; nothing imports it yet |

## Conventions

- Book through `createAppointmentForClerkUser`; never write appointments from the widget or route directly.
- Normalise dates and times with `parseAppointmentDate` and `toCanonicalTime` from `src/lib/utils/time.ts`.
- The tool names in code must match the tool names defined on the Vapi assistant in the dashboard; renaming one side silently breaks the call.

## Gotchas

- `initiate_payment` is a fake: it only shows a payment UI and returns `payment_ui_shown`. No money moves and no gateway is wired.
- The webhook trusts the `userId` the caller puts in `variableValues` or `metadata`. Do not treat it as proof of identity.
- With no `VAPI_WEBHOOK_SECRET` and no `VAPI_PRIVATE_KEY`, the webhook accepts every request in development. The secret check is a plain `===` compare.
- The assistant's real prompt and model live in the Vapi dashboard, not in this repo. `assistant_config.json` is a local, git ignored dump that may be stale.
- `NEXT_PUBLIC_VAPI_API_KEY` is the public key and ships to the browser; `VAPI_PRIVATE_KEY` must stay server side.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
