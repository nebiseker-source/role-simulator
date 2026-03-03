# MVP -> Pro Backlog

## Epic 1: Multi-Agent Core
1. Team pipeline endpoint (`/api/simulate-team`)
2. Orchestrator state machine
3. Agent step logging
4. Final synthesis response contract

## Epic 2: Quality & Governance
1. Reviewer agent
2. JSON schema validation per role
3. Quality score (completeness, feasibility, clarity, traceability)
4. Prompt/version registry

## Epic 3: Knowledge (RAG)
1. Document upload (pdf/docx/url/manual)
2. Chunk + embedding pipeline
3. Role-aware retrieval
4. Source citation in outputs

## Epic 4: Collaboration Workflow
1. Session versioning (v1, v2, ...)
2. Commenting and review threads
3. Approval flow (approved / changes requested)
4. Diff view between revisions

## Epic 5: Export & Integration
1. Jira export (Epic/Story/Task map)
2. Confluence export
3. PDF/DOCX export
4. Mermaid -> image export

## Epic 6: SaaS Platform
1. Workspace/team permissions
2. Subscription + quota enforcement
3. Usage dashboard
4. Stripe billing events

## Epic 7: Security & Compliance
1. Audit logs
2. PII redaction
3. Data retention policy
4. SSO (Google/Microsoft), sonra SAML

## İlk 3 Sprint Planı
### Sprint 1
1. Team simulation endpoint
2. Orchestrator + fallback
3. Docs (architecture + schema + backlog)

### Sprint 2
1. Reviewer agent
2. Quality score kartı
3. Session history (backend)

### Sprint 3
1. Knowledge upload + basic retrieval
2. Source citation
3. Export (PDF + Jira basic)
