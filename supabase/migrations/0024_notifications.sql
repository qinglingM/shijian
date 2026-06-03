-- ====================================================================
-- 0024 · 通知系统
-- ====================================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  content text not null,
  type text not null default 'system' check (type in ('system', 'personal', 'update')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications (user_id, is_read) where is_read = false;

alter table notifications enable row level security;

create policy "notifications read own" on notifications
  for select using (auth.uid() = user_id);

create policy "notifications update own" on notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 新用户注册时自动创建欢迎通知
create or replace function create_welcome_notification()
returns trigger as $$
begin
  insert into notifications (user_id, title, content, type)
  values (
    new.id,
    '欢迎加入食鉴',
    '展信佳，我是食鉴的作者。

很高兴你能读到这封信。这说明，我至少成功吸引到了一个有潜力的贪吃鬼，开头先说一声谢谢。

我做食鉴，真正想解决的，是我们吃饭时越来越常遇到的几件烦心事。

**评分越来越像摆设。**

很多店看起来都是高分，却分不清是真好吃评出来的，还是广告推上来的，还是送菜、送饮料、返现好评堆出来的。五星好评，可能是这个时代通货膨胀最严重的资产之一。

所以食鉴不用一团和气的五星，而是用更直接的档位：**夯爆了、夯、顶级、人上人、NPC、拉完了**。好就是好，普通就是普通，不值就是不值。主观评价或许永远不完美，但难吃不需要遮羞布，美味也值得更好的归宿。

**店和菜不能混为一谈。**

你或许经历过：朋友推荐一家店，去了发现踩雷了，不是这家店差，是你点错了。也可能反过来，一家看起来普通的小店，藏着一道你这辈子都会念念不忘的东西。

食鉴把店铺评价和菜品评价分开，告诉你这家店值不值得去，去了该点什么，不该点什么。

**不想让真实体验继续被营销淹没。**

返现好评、模板文案、平台推荐，会把人的判断搅浑。在很多地方，评价正在变成"99% 的默认好评"和"1% 的暴怒差评"。

但食鉴更看重一次真实的实践：你真的去吃了，真的打了分，真的留下判断。在这里，你不需要费劲写下三图百字的优质好评。真实的评价不该反人性，它只需要发自肺腑。

食鉴不设任何形式的好评激励，也不接受商家付费干预评价。我们唯一能做的，是让真实的人说真实的话。

**美好的经历不该被遗忘。**

你或许也经历过：朋友来到你的城市，问你有什么好吃的，你明明吃过很多，却一时说不出几个。那些夯店、踩过的坑、念念不忘的一道菜，本来都应该被记住。它们是简单的经验，也是宝贵的财富。

食鉴想把这些判断沉下来，变成你的饭桌档案，也成为别人少踩坑的依据。

如果有一天，食鉴能让好店不被埋没，让烂店少坑一个人，让每个认真吃饭的人都留下有分量的一票，那它就没有白做。

我不怕真实得罪谁。我只希望每个贪吃鬼，都别浪费自己的肚子。

记得天塌下来，有我扛着。

——作者',
    'system'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 在 handle_new_user trigger 之后添加欢迎通知 trigger
drop trigger if exists trigger_welcome_notification on auth.users;
create trigger trigger_welcome_notification
  after insert on auth.users
  for each row
  execute function create_welcome_notification();
