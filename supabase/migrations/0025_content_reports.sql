-- ====================================================================
-- 0025 · 内容举报
-- ====================================================================

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (
    target_type in (
      'practice_record',
      'dish_review',
      'dish_review_image',
      'restaurant',
      'restaurant_image'
    )
  ),
  target_id uuid not null,
  reason_code text not null check (
    reason_code in (
      'abuse',
      'porn',
      'illegal',
      'false_info',
      'spam',
      'infringement',
      'other'
    )
  ),
  description text,
  status text not null default 'pending' check (
    status in ('pending', 'resolved_hidden', 'resolved_ignore')
  ),
  snapshot jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now()
);

create unique index if not exists content_reports_reporter_target_unique
  on content_reports (reporter_user_id, target_type, target_id);

create index if not exists content_reports_reporter_idx
  on content_reports (reporter_user_id, created_at desc);

create index if not exists content_reports_target_idx
  on content_reports (target_type, target_id, created_at desc);

create index if not exists content_reports_status_idx
  on content_reports (status, created_at desc);

alter table content_reports enable row level security;

create policy "content_reports read own" on content_reports
  for select using (auth.uid() = reporter_user_id);

create policy "content_reports insert own" on content_reports
  for insert with check (auth.uid() = reporter_user_id);
