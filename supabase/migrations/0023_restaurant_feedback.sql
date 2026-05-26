-- ====================================================================
-- 0023 · 餐厅信息反馈（错误信息 / 重复店铺）
-- ====================================================================

create table restaurant_feedbacks (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('error_info', 'duplicate')),
  description   text not null,
  contact       text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table restaurant_feedbacks enable row level security;

create policy "restaurant_feedbacks insert all" on restaurant_feedbacks
  for insert with check (true);

create policy "restaurant_feedbacks read own" on restaurant_feedbacks
  for select using (created_by = auth.uid());
