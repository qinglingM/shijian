-- ====================================================================
-- 0005 · 行级安全策略（Row Level Security）
-- ====================================================================
-- 策略总览：
--   * 查表（cities/districts/categories/titles）：全员只读，写需 service_role
--   * profiles：全员可读公开资料，仅本人可改
--   * restaurants/dishes/bole_records/restaurant_aliases/dish_aliases：
--     全员读 active，写必须走 Edge Function（service_role 绕过 RLS）
--   * practice_records/dish_reviews：本人读写全部，他人只读 is_public=true
--   * marks：本人读写
--   * review_votes：全员可读（用于聚合），本人写
--   * good_review_guidance_feedbacks：本人读写，聚合通过 RPC（M7 加）
--   * user_titles：全员可读（展示称号），本人改 is_equipped
--   * image_assets：全员可读，本人写
-- ====================================================================

-- ----------------------------------------------------------------
-- 启用 RLS
-- ----------------------------------------------------------------
alter table cities                            enable row level security;
alter table districts                         enable row level security;
alter table categories                        enable row level security;
alter table titles                            enable row level security;
alter table profiles                          enable row level security;
alter table restaurants                       enable row level security;
alter table practice_records                  enable row level security;
alter table dishes                            enable row level security;
alter table dish_reviews                      enable row level security;
alter table marks                             enable row level security;
alter table bole_records                      enable row level security;
alter table review_votes                      enable row level security;
alter table good_review_guidance_feedbacks    enable row level security;
alter table user_titles                       enable row level security;
alter table restaurant_aliases                enable row level security;
alter table dish_aliases                      enable row level security;
alter table image_assets                      enable row level security;

-- ----------------------------------------------------------------
-- 查表：全员只读
-- ----------------------------------------------------------------
create policy "cities read all"     on cities      for select using (is_active);
create policy "districts read all"  on districts   for select using (is_active);
create policy "categories read all" on categories  for select using (is_active);
create policy "titles read all"     on titles      for select using (is_active);

-- ----------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------
create policy "profiles read all" on profiles
  for select using (true);

create policy "profiles update self" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------
-- restaurants
-- 读：active 全员可见；自己创建的隐藏/待审也能看
-- 写：禁止（必须走 Edge Function 使用 service_role）
-- ----------------------------------------------------------------
create policy "restaurants read active" on restaurants
  for select using (status = 'active' or auth.uid() = created_by);

-- ----------------------------------------------------------------
-- practice_records
-- 读：本人 / 公开
-- 写：本人增删改
-- ----------------------------------------------------------------
create policy "practice read own or public" on practice_records
  for select using (
    auth.uid() = user_id
    or (is_public = true and is_active = true)
  );

create policy "practice insert own" on practice_records
  for insert with check (auth.uid() = user_id);

create policy "practice update own" on practice_records
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- dishes
-- 读：active 全员可见
-- 写：禁止（走 Edge Function）
-- ----------------------------------------------------------------
create policy "dishes read active" on dishes
  for select using (status = 'active');

-- ----------------------------------------------------------------
-- dish_reviews
-- 读：本人 / 公开
-- 写：本人，且必须属于自己的实践单
-- ----------------------------------------------------------------
create policy "dish_reviews read own or public" on dish_reviews
  for select using (
    (is_public = true and is_active = true)
    or exists (
      select 1 from practice_records pr
      where pr.id = dish_reviews.practice_record_id
        and pr.user_id = auth.uid()
    )
  );

create policy "dish_reviews insert own practice" on dish_reviews
  for insert with check (
    exists (
      select 1 from practice_records pr
      where pr.id = dish_reviews.practice_record_id
        and pr.user_id = auth.uid()
    )
  );

create policy "dish_reviews update own practice" on dish_reviews
  for update using (
    exists (
      select 1 from practice_records pr
      where pr.id = dish_reviews.practice_record_id
        and pr.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- marks · 本人读写
-- ----------------------------------------------------------------
create policy "marks read own" on marks
  for select using (auth.uid() = user_id);

create policy "marks insert own" on marks
  for insert with check (auth.uid() = user_id);

create policy "marks delete own" on marks
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- bole_records · 全员读 active
-- ----------------------------------------------------------------
create policy "bole read active" on bole_records
  for select using (is_active);

-- ----------------------------------------------------------------
-- review_votes
-- 读：全员（用于聚合 + 显示自己是否投过）
-- 写：本人
-- ----------------------------------------------------------------
create policy "votes read all" on review_votes
  for select using (true);

create policy "votes insert own" on review_votes
  for insert with check (auth.uid() = user_id);

create policy "votes update own" on review_votes
  for update using (auth.uid() = user_id);

create policy "votes delete own" on review_votes
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- good_review_guidance_feedbacks
-- 读：本人（明细不公开，聚合通过 RPC，待 M7）
-- 写：本人，且必须属于自己的有效实践单
-- ----------------------------------------------------------------
create policy "guidance read own" on good_review_guidance_feedbacks
  for select using (auth.uid() = user_id);

create policy "guidance insert own valid practice" on good_review_guidance_feedbacks
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from practice_records pr
      where pr.id = practice_record_id
        and pr.user_id = auth.uid()
        and pr.is_valid_practice = true
    )
  );

create policy "guidance update own" on good_review_guidance_feedbacks
  for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- user_titles
-- 读：全员（展示佩戴的称号）
-- 改 is_equipped：本人
-- ----------------------------------------------------------------
create policy "user_titles read all" on user_titles
  for select using (true);

create policy "user_titles update own" on user_titles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- restaurant_aliases / dish_aliases · 全员读，写禁止
-- ----------------------------------------------------------------
create policy "restaurant_aliases read all" on restaurant_aliases
  for select using (true);

create policy "dish_aliases read all" on dish_aliases
  for select using (true);

-- ----------------------------------------------------------------
-- image_assets · 全员读 active，本人写
-- ----------------------------------------------------------------
create policy "image_assets read all" on image_assets
  for select using (status = 'active');

create policy "image_assets insert own" on image_assets
  for insert with check (auth.uid() = owner_id);

create policy "image_assets update own" on image_assets
  for update using (auth.uid() = owner_id);
