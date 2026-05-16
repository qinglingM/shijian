# 食鉴p0 Supabase后端数据库定版说明书

> 本文档由 `食鉴p0 Supabase后端数据库定版说明书.docx` 自动转换而来，请以原 docx 为准。

# 食鉴 P0 Supabase 后端数据库定版说明书

## 0. 文档定位

本文档是「食鉴」P0 版本的 Supabase 后端数据库定版说明书。

它以最新产品逻辑为准：

接入高德 POI 辅助确认真实店铺。

用户搜索、选中、点击详情、点击评价都不立即入库。

只有用户完成有效实践单后，餐厅才正式入库。

伯乐由“首次创建者”改为“首次有效实践者”。

标记是用户对未吃过餐厅的兴趣记录；已评价状态由实践记录推导。

好评诱导反馈只允许完成有效实践的用户提交。

# 1. 数据库总体原则

## 1.1 核心链路

高德 POI 搜索
  ↓
临时选中真实店铺对象
  ↓
用户完成实践单
  ↓
校验是否有效实践
  ↓
若店铺不存在，则正式写入 restaurants
  ↓
写入 practice_records
  ↓
写入 dishes / dish_reviews
  ↓
判断伯乐
  ↓
写入好评诱导反馈，若用户勾选

## 1.2 入库边界

以下行为不创建 restaurants 记录：

搜索高德 POI

选中高德 POI

点击店铺详情

点击评价

保存草稿

只有提交有效实践时，才正式创建餐厅。

## 1.3 高德 POI 不是食鉴餐厅库

高德 POI 只负责帮助用户确认真实地点。

食鉴自己的 restaurants 表才是业务餐厅库。

# 2. 核心表总览

P0 必须建表：

| 表名 | 中文名 | 用途 |
| --- | --- | --- |
| profiles | 用户资料 | 用户昵称、头像、食鉴号、注册信息 |
| cities | 城市 | 城市标准数据 |
| districts | 行政区 | 城市下行政区 |
| categories | 分类 | 餐厅分类 |
| restaurants | 餐厅 | 食鉴正式餐厅库 |
| restaurant_aliases | 餐厅别名 | 搜索召回与合并保留旧名 |
| practice_records | 实践单 | 用户对餐厅的一次主实践记录 |
| dishes | 菜品 | 餐厅下的公共菜品实体 |
| dish_aliases | 菜品别名 | 菜品搜索和合并 |
| dish_reviews | 菜品评价 | 用户对菜品的评分与锐评 |
| review_votes | 有品/野榜 | 对店铺评价或菜品评价投票 |
| marks | 标记 | 用户对未吃过餐厅的兴趣标记 |
| bole_records | 伯乐 | 首个有效实践者记录 |
| good_review_guidance_feedbacks | 好评诱导反馈 | 用户实践后匿名反馈 |
| titles | 称号 | 称号定义 |
| user_titles | 用户称号 | 用户获得/佩戴称号 |
| image_assets | 图片资源 | 上传图片元数据 |

说明：此前文档中的 shijian_records 在新版本中建议改名为 practice_records，因为它已经不只是店铺评价，而是一张包含店铺六档、菜品评价、有效实践判断的实践单。

# 3. 枚举设计

## 3.1 餐厅六档 tier

数据库建议存英文内部值：

| 内部值 | 前端展示 |
| --- | --- |
| boom | 夯爆了 |
| hang | 夯 |
| top | 顶级 |
| upper | 人上人 |
| npc | NPC |
| bad | 拉完了 |

## 3.2 POI 来源 poi_source

| 值 | 说明 |
| --- | --- |
| amap | 高德 |
| manual | 用户手动补充 |
| tencent | 腾讯，预留 |
| baidu | 百度，预留 |
| apple | Apple MapKit，预留 |

## 3.3 餐厅状态 restaurant_status

| 值 | 说明 |
| --- | --- |
| active | 正常展示 |
| pending | 待确认 / 疑似重复 |
| merged | 已合并 |
| hidden | 隐藏 |

## 3.4 投票类型 vote_type

| 值 | 展示 |
| --- | --- |
| youpin | 有品 |
| yebang | 野榜 |

## 3.5 投票目标 target_type

| 值 | 说明 |
| --- | --- |
| store_review | 店铺实践锐评 |
| dish_review | 菜品锐评 |

# 4. 用户资料表：profiles

## 4.1 用途

存储用户公开资料和基础账号展示信息。

profiles.id 对应 Supabase Auth 的 auth.users.id。

## 4.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键，对应 auth.users.id |
| user_code | text | 是 | 用户短码，如 SJ8F29A1 |
| nickname | text | 是 | 昵称 |
| avatar_url | text | 否 | 头像 |
| bio | text | 否 | 简介 |
| city_id | uuid | 否 | 当前城市 |
| district_id | uuid | 否 | 默认行政区 |
| current_title_id | uuid | 否 | 当前佩戴称号 |
| created_at | timestamptz | 是 | 注册时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 4.3 展示用途

我的页面展示：

头像

昵称

食鉴号 user_code

注册天数，由 created_at 计算

当前称号

## 4.4 约束

unique(user_code)

# 5. 城市表：cities

## 5.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| name | text | 是 | 城市名 |
| province_name | text | 否 | 省份 |
| sort_order | int | 否 | 排序 |
| is_active | boolean | 是 | 是否启用 |
| created_at | timestamptz | 是 | 创建时间 |

# 6. 行政区表：districts

## 6.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| city_id | uuid | 是 | 城市 ID |
| name | text | 是 | 行政区名 |
| sort_order | int | 否 | 排序 |
| is_active | boolean | 是 | 是否启用 |
| created_at | timestamptz | 是 | 创建时间 |

# 7. 分类表：categories

## 7.1 P0 分类

P0 可先使用：

饭馆

简餐

小吃

饮甜

火锅

烧烤

粉面

其他

## 7.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| name | text | 是 | 分类名 |
| description | text | 否 | 描述 |
| sort_order | int | 否 | 排序 |
| is_active | boolean | 是 | 是否启用 |
| created_at | timestamptz | 是 | 创建时间 |

# 8. 餐厅表：restaurants

## 8.1 用途

存储食鉴正式餐厅对象。

注意：只有有效实践提交后，餐厅才正式进入此表。

## 8.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| poi_source | text | 是 | amap / manual 等 |
| poi_id | text | 否 | 高德 POI ID，手动店可为空 |
| poi_name | text | 否 | 高德原始名称 |
| brand_name | text | 是 | 招牌名 |
| branch_name | text | 否 | 分店名 |
| display_name | text | 是 | 展示名 |
| address_text | text | 否 | 地址文本 |
| location_hint | text | 否 | 位置补充，如五道口 |
| latitude | numeric | 否 | 纬度 |
| longitude | numeric | 否 | 经度 |
| province_name | text | 否 | 地图返回省份 |
| city_name | text | 否 | 地图返回城市 |
| district_name | text | 否 | 地图返回行政区 |
| city_id | uuid | 否 | 食鉴标准城市 ID |
| district_id | uuid | 否 | 食鉴标准行政区 ID |
| category_id | uuid | 否 | 食鉴分类 |
| cover_image_url | text | 否 | 餐厅图，高德图或用户图 |
| created_by | uuid | 是 | 首次有效实践用户 |
| status | text | 是 | active / pending / merged / hidden |
| merged_to_id | uuid | 否 | 合并目标 |
| search_text | text | 否 | 搜索拼接字段 |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 8.3 关键约束

高德 POI 不允许重复入库：

unique(poi_source, poi_id) where poi_id is not null

手动店无 poi_id，不能走该唯一约束。

## 8.4 创建时机

只有提交有效实践时创建。

如果 poi_source='amap' 且 poi_id 已存在：

不创建新餐厅

使用已有餐厅

如果不存在：

创建新餐厅

保存高德返回字段

保存用户实践内容

# 9. 餐厅别名表：restaurant_aliases

## 9.1 用途

用于搜索召回和店铺合并后保留旧名。

## 9.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| restaurant_id | uuid | 是 | 餐厅 ID |
| alias_name | text | 是 | 别名 |
| source_type | text | 是 | user / merge / system |
| created_by | uuid | 否 | 来源用户 |
| created_at | timestamptz | 是 | 创建时间 |

# 10. 实践单表：practice_records

## 10.1 用途

用户对一家餐厅的一次主实践记录。

它包含：

用户选择的餐厅或临时 POI

用户给店铺的六档评价

整店锐评

是否公开

是否满足有效实践

## 10.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 用户 ID |
| restaurant_id | uuid | 是 | 餐厅 ID，提交时必须存在 |
| tier | text | 是 | 六档内部值 |
| store_comment | text | 否 | 整店锐评 |
| is_public | boolean | 是 | 是否公开 |
| is_valid_practice | boolean | 是 | 是否有效实践 |
| valid_practice_at | timestamptz | 否 | 成为有效实践的时间 |
| created_from | text | 是 | amap / manual / existing |
| source_poi_payload | jsonb | 否 | 提交时使用的高德原始 POI 数据快照 |
| is_active | boolean | 是 | 是否有效 |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 10.3 有效实践判断

is_valid_practice = true 必须满足：

有餐厅对象

至少有一道菜品评价

至少一道菜品评价有 0–10 分打分

实践单成功提交

只给店铺打六档不算有效实践。

## 10.4 唯一约束

同一用户对同一家餐厅只能有一条有效主实践记录：

unique(user_id, restaurant_id) where is_active = true

如果后续要支持多次复吃，可另建 visit_records，P0 不做。

# 11. 菜品表：dishes

## 11.1 用途

存储某餐厅下的公共菜品实体。

菜品不跨餐厅合并。

## 11.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| restaurant_id | uuid | 是 | 餐厅 ID |
| name | text | 是 | 菜名 |
| cover_image_url | text | 否 | 菜品代表图 |
| avg_score | numeric(3,1) | 否 | 公开评分均值 |
| review_count | int | 是 | 公开评价人数 |
| top_comment | text | 否 | 代表锐评 |
| youpin_count | int | 是 | 有品聚合 |
| yebang_count | int | 是 | 野榜聚合 |
| created_by | uuid | 是 | 创建用户 |
| status | text | 是 | active / merged / hidden |
| merged_to_id | uuid | 否 | 合并目标 |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 11.3 聚合字段更新

以下字段可由后端任务/RPC 更新：

avg_score

review_count

top_comment

youpin_count

yebang_count

# 12. 菜品别名表：dish_aliases

## 12.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| dish_id | uuid | 是 | 菜品 ID |
| alias_name | text | 是 | 别名 |
| source_type | text | 是 | user / merge / system |
| created_by | uuid | 否 | 来源用户 |
| created_at | timestamptz | 是 | 创建时间 |

# 13. 菜品评价表：dish_reviews

## 13.1 用途

用户在实践单下对某道菜的评价。

## 13.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| practice_record_id | uuid | 是 | 所属实践单 |
| dish_id | uuid | 是 | 菜品 ID |
| score | int | 否 | 0–10 整数 |
| comment | text | 否 | 菜品锐评 |
| image_url | text | 否 | 菜品图 |
| is_public | boolean | 是 | 是否公开 |
| is_active | boolean | 是 | 是否有效 |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 13.3 分数约束

score >= 0 and score <= 10

## 13.4 唯一约束

同一实践单下同一道菜只允许一条评价：

unique(practice_record_id, dish_id) where is_active = true

# 14. 有品/野榜表：review_votes

## 14.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 投票用户 |
| target_type | text | 是 | store_review / dish_review |
| target_id | uuid | 是 | 目标 ID |
| vote_type | text | 是 | youpin / yebang |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 14.2 约束

unique(user_id, target_type, target_id)

## 14.3 交互规则

未投票 → 新增

再点同项 → 取消

点另一项 → 切换

## 14.4 综合排序字段

店铺评价和菜品评价列表需要返回：

youpin_count
yebang_count
heat_score = youpin_count - yebang_count
heat_abs = abs(heat_score)

排序规则：

净值最高优先

净值相同，最新优先

全部为负时，净值绝对值最大优先

# 15. 标记表：marks

## 15.1 用途

用户对未吃过餐厅的兴趣标记。

## 15.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 用户 |
| restaurant_id | uuid | 是 | 餐厅 |
| created_at | timestamptz | 是 | 创建时间 |

## 15.3 约束

unique(user_id, restaurant_id)

## 15.4 三态展示逻辑

数据库不直接存三态。

前端/接口聚合返回：

mark_status: none / marked / reviewed

判断：

如果存在有效 practice_records → reviewed
否则如果存在 marks → marked
否则 → none

用户完成实践后，界面不再显示已标记，而显示已评价。

# 16. 伯乐表：bole_records

## 16.1 用途

记录某家店的首个有效实践者。

## 16.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 伯乐用户 |
| restaurant_id | uuid | 是 | 餐厅 |
| practice_record_id | uuid | 是 | 来源实践单 |
| is_active | boolean | 是 | 是否有效 |
| awarded_at | timestamptz | 是 | 获得时间 |

## 16.3 生成规则

当提交实践后：

判断该实践是否 is_valid_practice = true

判断该餐厅是否已有 active 伯乐

如果没有，创建伯乐记录

## 16.4 约束

一个餐厅只能有一个有效伯乐：

unique(restaurant_id) where is_active = true

# 17. 好评诱导反馈表：good_review_guidance_feedbacks

## 17.1 用途

记录完成有效实践的用户是否反馈该店存在好评诱导。

## 17.2 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 用户 |
| restaurant_id | uuid | 是 | 餐厅 |
| practice_record_id | uuid | 是 | 实践单 |
| has_guidance | boolean | 是 | 是否存在好评诱导 |
| created_at | timestamptz | 是 | 创建时间 |
| updated_at | timestamptz | 是 | 更新时间 |

## 17.3 约束

建议一条有效实践单只能反馈一次：

unique(practice_record_id)

也可限制同一用户同一店一次：

unique(user_id, restaurant_id)

P0 建议使用 unique(user_id, restaurant_id)，因为同一用户对同一店只有一条主实践记录。

## 17.4 计入条件

只有满足以下条件才计入公开统计：

用户有该店有效实践记录

has_guidance = true

实践记录有效且未删除

## 17.5 展示计算

当：

有效实践人数 >= 10
且好评诱导反馈人数 >= 1

店铺详情页展示：

ⓘ 18%

百分比：

has_guidance_count / valid_practice_count

# 18. 称号表：titles

## 18.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| name | text | 是 | 称号名 |
| rarity | text | 是 | 普通/稀有/史诗/传说 |
| description | text | 否 | 描述 |
| icon_url | text | 否 | 图标 |
| unlock_rule | jsonb | 否 | 解锁规则 |
| is_active | boolean | 是 | 是否启用 |
| created_at | timestamptz | 是 | 创建时间 |

# 19. 用户称号表：user_titles

## 19.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| user_id | uuid | 是 | 用户 |
| title_id | uuid | 是 | 称号 |
| is_equipped | boolean | 是 | 是否佩戴 |
| obtained_at | timestamptz | 是 | 获得时间 |

## 19.2 约束

unique(user_id, title_id)

同一用户同时最多佩戴一个称号，由业务层保证，并同步更新 profiles.current_title_id。

# 20. 图片资源表：image_assets

## 20.1 字段

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | uuid | 是 | 主键 |
| owner_id | uuid | 是 | 上传用户 |
| url | text | 是 | 图片 URL |
| bucket | text | 是 | Storage bucket |
| path | text | 是 | Storage 路径 |
| mime_type | text | 否 | 文件类型 |
| size_bytes | int | 否 | 文件大小 |
| target_type | text | 否 | restaurant / dish / dish_review / profile |
| target_id | uuid | 否 | 目标 ID |
| status | text | 是 | active / hidden / deleted |
| created_at | timestamptz | 是 | 创建时间 |

## 20.2 Storage bucket 建议

avatars
restaurants
dishes
reviews

# 21. 餐厅详情页聚合数据

餐厅详情页接口应返回：

{
  "restaurant": {},
  "my_practice": {},
  "public_tier": "top",
  "mark_status": "reviewed",
  "bole": {},
  "top_store_review": {},
  "good_review_guidance": {
    "show": true,
    "percent": 18,
    "valid_practice_count": 50,
    "guidance_count": 9
  },
  "tabs_summary": {
    "store_review_count": 30,
    "dish_count": 12
  }
}

# 22. 首页食鉴图聚合数据

首页接口应返回：

{
  "total_practice_count": 37,
  "emotion_text": "把吃过的店，摆成自己的战利品墙",
  "tiers": [
    {
      "tier": "boom",
      "count": 3,
      "restaurants": [
        {
          "id": "xxx",
          "display_name": "海底捞",
          "cover_image_url": "..."
        }
      ]
    }
  ]
}

加号逻辑由前端根据每档 restaurants.length 和 count 处理。

# 23. 提交实践后端事务

提交实践必须作为事务处理。

事务步骤：

接收 selected_poi 或 manual_restaurant_info

如果 selected_poi 有 poi_id，查询 restaurants 是否存在

如果不存在，但实践满足提交条件，则创建 restaurants

创建或更新 practice_records

创建或复用 dishes

创建 dish_reviews

判断 is_valid_practice

如果该店没有有效伯乐且本次为有效实践，创建 bole_records

如果用户勾选好评诱导，创建/更新 good_review_guidance_feedbacks

更新菜品聚合字段

返回实践结果

注意：

如果没有有效菜品评分，但用户提交了店铺六档评价，可以保存实践记录，但 is_valid_practice = false

此时不触发伯乐

如果该店原本不存在，是否创建 restaurant 需要产品再定；当前建议：只有有效实践才创建正式餐厅

# 24. RLS 权限建议

## 24.1 restaurants

所有人可读 active 餐厅

登录用户不能直接任意创建餐厅，应通过提交实践的服务逻辑创建

管理员可更新、合并、隐藏

## 24.2 practice_records

公开记录所有人可读

私密记录只有本人可读

用户只能创建/更新自己的记录

## 24.3 dish_reviews

公开评价所有人可读

私密评价只有本人可读

用户只能创建/更新自己实践单下的菜品评价

## 24.4 marks

用户只能读写自己的标记

## 24.5 review_votes

登录用户可读写自己的投票

公开评价的统计可读

## 24.6 good_review_guidance_feedbacks

用户只能写自己的反馈

用户本人可查看自己的反馈

公共页面只能读取聚合百分比，不直接读明细

# 25. 索引建议

## 25.1 restaurants

index(poi_source, poi_id)
index(city_id)
index(district_id)
index(status)
index(search_text)
unique(poi_source, poi_id) where poi_id is not null

## 25.2 practice_records

index(user_id)
index(restaurant_id)
index(tier)
index(is_public)
index(is_valid_practice)
unique(user_id, restaurant_id) where is_active = true

## 25.3 dishes

index(restaurant_id)
index(name)
index(status)

## 25.4 dish_reviews

index(practice_record_id)
index(dish_id)
index(is_public)
index(score)
unique(practice_record_id, dish_id) where is_active = true

## 25.5 review_votes

index(target_type, target_id)
unique(user_id, target_type, target_id)

## 25.6 marks

unique(user_id, restaurant_id)
index(user_id)

## 25.7 good_review_guidance_feedbacks

index(restaurant_id)
unique(user_id, restaurant_id)

# 26. P0 后端接口清单

## 26.1 POI 搜索

POST /api/poi/search

负责调用高德 POI。

## 26.2 查询 POI 是否已入库

GET /api/restaurants/by-poi

输入：

poi_source
poi_id

## 26.3 提交实践

POST /api/practices/submit

这是最重要接口。

## 26.4 首页食鉴图

GET /api/home/tier-map

## 26.5 餐厅详情

GET /api/restaurants/:id/detail

## 26.6 店铺评价列表

GET /api/restaurants/:id/store-reviews

支持：

sort=latest|hot
tier=all|boom|hang|top|upper|npc|bad

## 26.7 菜品列表

GET /api/restaurants/:id/dishes

## 26.8 菜品详情

GET /api/dishes/:id/detail

## 26.9 标记/取消标记

POST /api/restaurants/:id/mark
DELETE /api/restaurants/:id/mark

## 26.10 有品/野榜

POST /api/review-votes/toggle

## 26.11 好评诱导反馈

POST /api/restaurants/:id/good-review-guidance

# 27. 开发优先级

## 第一阶段：主链路

profiles

restaurants

practice_records

dishes

dish_reviews

高德 POI 搜索接口

实践提交事务

首页食鉴图接口

## 第二阶段：详情与互动

餐厅详情聚合接口

店铺评价列表

菜品列表

菜品详情

有品/野榜

标记三态

## 第三阶段：治理与激励

伯乐

好评诱导反馈

餐厅别名

菜品别名

重复店反馈

错误信息反馈

# 28. 当前后端一句话定版

食鉴后端的核心不是简单保存餐厅，而是：

用户先通过高德 POI 确认真实店铺，系统不因搜索和浏览创建空店；只有提交包含菜品打分的有效实践后，才正式写入餐厅、实践单、菜品评价，并据此生成伯乐、公共评价、好评诱导统计和首页食鉴图。
