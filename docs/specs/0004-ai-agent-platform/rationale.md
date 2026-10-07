# 0004. AI agent platform: rationale

Decision record for [index.md](index.md). The build does not need this file.

## Context

Today `/voice` runs a Vapi voice assistant. Vapi calls our `/api/vapi/tools` webhook to list doctors and book. Vapi gives a one time credit, so it cannot stay free, and its hosted model processes patient speech under Vapi's own terms. The product goal (scope Feature 5) is an AI front desk that patients can talk or type to in English or Hindi. It must book through our own server side tools, cost nothing at pilot scale, and never let the AI provider train on patient data.

Constraints that shaped every choice:
- **Zero spend.** Only free tiers, no card on file.
- **No training on our data.** That rules out any free tier whose terms let the provider learn from inputs.
- **Vercel only.** No long running worker or socket server. Everything must fit request and response functions with a 60 second ceiling.
- **India first.** Hindi and Hinglish speech, DPDP Act 2023, and the Telemedicine Practice Guidelines 2020 (the AI must not counsel or prescribe).
- **Multi clinic.** Every tool must stay inside one clinic (spec 0003 tenancy).

**Premise note (capacity).** The free tier is small. Groq gives each model 200K tokens a day and 8K tokens a minute. At about 2.5K tokens per model call and roughly 8 calls per booking conversation, that is about 7 conversations a day per model, about 14 with the backup, across all clinics, and only one or two at the same time. That is enough for a one clinic pilot and not for more. The design treats "out of capacity" as a normal path (the booking form), not an error. Growing past the pilot means a paid tier, which reopens the zero spend constraint.

## Options considered

### Option 1: Keep Vapi

The hosted voice platform we already use.

- Pro: already built and working. Real time voice with barge in. Good voices.
- Con: one time credit, then paid. Patient speech goes through Vapi and its model vendor. Tools run as a webhook that trusts a `userId` sent by the caller (we added a signed token, but the shape stays). No text channel.

### Option 2: Turn based agent in Vercel functions (chosen)

The browser detects end of speech, uploads audio, Groq Whisper transcribes, a Groq hosted open model replies with tool calls through the Vercel AI SDK, and the browser speaks the reply.

- Pro: free tiers only. Groq processes as a data processor and does not train on inputs. Tools run in our server with the session's clinic and user. Text and voice share one agent. Fits Vercel with no new infrastructure.
- Con: turn based, so 1 to 3 seconds per turn and no barge in. Browser voices are uneven, especially for Hindi. Small daily capacity.

### Option 3: Real time voice with LiveKit or Pipecat

An open source real time voice framework with a media server and an agent worker.

- Pro: real time conversation with barge in, closest to Vapi.
- Con: needs an always on worker process, which Vercel cannot host, so it needs another host. Free hosting for a long running worker is not reliable. More moving parts than the pilot needs.

### Option 4: Speech to speech model (for example Gemini Live on the free tier)

One model takes audio in and gives audio out.

- Pro: the most natural voice, and the lowest latency.
- Con: the free tiers we checked allow the provider to use inputs to improve its products, which breaks the no training rule. Also needs a socket session that Vercel functions do not hold well.

## Rationale

Option 2 is the only one that meets all three hard constraints at once (zero spend, no training, Vercel only). Options 1 and 4 fail zero spend or no training. Option 3 fails Vercel only.

Inside Option 2, these were the sub choices:
- **Groq for the model and speech to text.** It has a free tier that needs no card, models that support tool use, Whisper with Hindi, and a privacy policy that treats customer data as processed for the customer. Sarvam (strong Indian language support) gives only a small one time credit, so it is not free over time. Google's free Gemini tier may use inputs for training. The browser's own speech recognition works only in Chrome and Edge.
- **Two Groq models with separate limits.** `openai/gpt-oss-120b` first, `qwen/qwen3.8-27b` as backup. Each has its own rate limit bucket, so the backup doubles daily capacity and also covers an outage of one model. Qwen is a strong multilingual model, so the Hindi smoke test may swap the order.
- **Vercel AI SDK.** `streamText` with tools handles the tool loop and streaming. `useChat` handles the client. It has a first party Groq provider. A hand written loop would be more code to get wrong. We call Groq directly, not through the AI Gateway, so there is no extra account or limit.
- **Browser `speechSynthesis` for speaking.** Free and instant. Hosted voices with a free tier are either credit based or train on inputs. The cost is uneven Hindi voices, handled by the text fallback.
- **`@ricky0123/vad-web` for end of speech.** Hands free turns without a server. It also stops silence from reaching Whisper, which otherwise invents words.
- **Metadata only session row, no transcripts.** Health related speech is the most sensitive data the product could hold. Not storing it removes most DPDP obligations for this feature and keeps the 90 day purge trivial.
- **Limits per user per clinic per UTC day.** Protects the small shared token budget from one patient. UTC keeps the count simple and matches how Groq resets its daily limit. Shown with a reset time, so it reads as fair.
- **Vapi kept behind a flag.** The new path can be verified in production before Vapi is removed. Turning it back takes one env var change.

## References

- Groq rate limits (free tier per model limits, Whisper audio limits): https://console.groq.com/docs/rate-limits
- Groq tool use (which models support tools and parallel tool calls): https://console.groq.com/docs/tool-use
- Groq privacy policy (customer data processed for the customer): https://groq.com/privacy-policy
- Sarvam rate limits and credits (one time credit): https://docs.sarvam.ai/api/getting-started/ratelimits
- Sarvam pricing: https://docs.sarvam.ai/api/getting-started/pricing
- AI SDK agent skill (installed at `.claude/skills/ai-sdk/`): https://skills.sh/vercel/ai/ai-sdk
- AI SDK docs: https://ai-sdk.dev/docs
- Repo sources read for this design: `src/lib/services/appointment-booking.ts`, `src/lib/services/doctors.ts`, `src/lib/tenancy.ts`, `src/lib/utils.ts` (`getNext5Days`, `getAvailableTimeSlots`), `src/lib/actions/users.ts` (`syncUser`), `src/app/api/vapi/tools/route.ts`, `src/app/api/cron/purge-clinics/route.ts`, `src/components/voice/AGENTS.md`, `prisma/schema.prisma`, spec [0003](../0003-multi-clinic-data-model/index.md).
