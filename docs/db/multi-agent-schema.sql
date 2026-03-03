-- Multi-tenant core
create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table if not exists workspace_member (
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  primary key (workspace_id, user_id)
);

-- Simulation session
create table if not exists simulation_session (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  created_by_user_id uuid not null references app_user(id),
  title text not null,
  problem_statement text not null,
  status text not null check (status in ('draft', 'running', 'completed', 'failed')) default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists simulation_revision (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references simulation_session(id) on delete cascade,
  revision_no int not null,
  notes text,
  created_by_user_id uuid not null references app_user(id),
  created_at timestamptz not null default now(),
  unique (session_id, revision_no)
);

-- Agent run tracking
create table if not exists agent_run (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references simulation_session(id) on delete cascade,
  revision_id uuid references simulation_revision(id) on delete set null,
  run_mode text not null check (run_mode in ('single_role', 'team_pipeline')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')) default 'queued',
  requested_by_user_id uuid not null references app_user(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists agent_step (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_run(id) on delete cascade,
  step_order int not null,
  role_key text not null check (role_key in ('business_analyst', 'product_owner', 'solution_architect', 'data_scientist', 'reviewer')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')) default 'queued',
  model_name text,
  prompt_version text,
  input_context jsonb,
  output_markdown text,
  output_json jsonb,
  fallback_used boolean not null default false,
  quality_score numeric(5,2),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_agent_step_run_order on agent_step(run_id, step_order);

-- Review and approval workflow
create table if not exists review_comment (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_run(id) on delete cascade,
  role_key text not null,
  section_key text,
  comment_type text not null check (comment_type in ('issue', 'suggestion', 'question', 'approval')),
  content text not null,
  created_by_user_id uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table if not exists approval_decision (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_run(id) on delete cascade,
  decided_by_user_id uuid not null references app_user(id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

-- Knowledge base (RAG)
create table if not exists knowledge_document (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('manual', 'pdf', 'docx', 'url')),
  source_uri text,
  created_by_user_id uuid not null references app_user(id),
  created_at timestamptz not null default now()
);

create table if not exists knowledge_chunk (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_document(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_chunk_document on knowledge_chunk(document_id);

-- Metering / billing
create table if not exists subscription (
  workspace_id uuid primary key references workspace(id) on delete cascade,
  plan_key text not null check (plan_key in ('free', 'pro', 'team', 'enterprise')),
  monthly_run_quota int not null,
  status text not null check (status in ('active', 'past_due', 'canceled')) default 'active',
  period_start timestamptz not null,
  period_end timestamptz not null
);

create table if not exists usage_event (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspace(id) on delete cascade,
  run_id uuid references agent_run(id) on delete set null,
  event_type text not null check (event_type in ('run_started', 'run_completed', 'export_pdf', 'export_jira')),
  units int not null default 1,
  created_at timestamptz not null default now()
);
