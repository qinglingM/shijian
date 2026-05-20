# 食鉴 App 餐饮分类映射方案

本文档用于指导 OpenCode / AI 编程助手理解并实现「食鉴」App 的餐饮分类标准。

本方案的核心目标是：

1. 不直接照搬高德 POI 的中类、小类展示给用户。
2. 高德 POI 分类只作为底层原始数据和映射依据。
3. 食鉴前台餐厅卡片只展示一个清晰的小类标签。
4. 食鉴大类只用于筛选、聚合、统计，不默认展示在餐厅卡片上。
5. 所有带括号的分类名，前台展示时去掉括号内容。
6. 对高德中的品牌型小类进行泛化，不直接把品牌名当分类展示。

---

## 1. 背景说明

高德 POI 餐饮数据通常包含三层：

```text
大类：餐饮服务
中类：中餐厅 / 外国餐厅 / 快餐厅 / 咖啡厅 / 甜品店 等
小类：北京菜 / 四川菜(川菜) / 麦当劳 / 肯德基 / 日本料理 等
```

食鉴是美食评价 App，不需要展示「餐饮服务」这个大类。

高德中类也不适合直接展示，因为它更像地图数据库分类，例如：

```text
中餐厅
外国餐厅
快餐厅
咖啡厅
```

这些词不符合用户在餐厅卡片上的阅读习惯。

因此，食鉴需要建立自己的分类映射层。

---

## 2. 分类层级定义

系统中建议保留三套字段。

### 2.1 高德原始分类字段

用于保留高德返回的原始数据，不直接用于前台展示。

```text
amap_big_category      高德大类，例如：餐饮服务
amap_mid_category      高德中类，例如：中餐厅、快餐厅
amap_small_category    高德小类，例如：北京菜、麦当劳
amap_type_code         高德 typecode
```

### 2.2 食鉴标准分类字段

食鉴自己的产品分类。

```text
shijian_category       食鉴大类，例如：中餐、小吃快餐、咖啡茶饮
shijian_subcategory    食鉴小类，例如：北京菜、汉堡炸鸡、咖啡
```

### 2.3 前台展示字段

餐厅卡片实际展示给用户看的分类标签。

```text
display_category_label
```

通常情况下：

```text
display_category_label = shijian_subcategory
```

---

## 3. 食鉴大类

食鉴大类用于筛选、聚合、统计，不默认显示在餐厅卡片上。

当前建议保留 9 个大类：

| 顺序 | 食鉴大类 |
|---:|---|
| 1 | 中餐 |
| 2 | 火锅烧烤 |
| 3 | 小吃快餐 |
| 4 | 日韩料理 |
| 5 | 西餐 |
| 6 | 东南亚菜 |
| 7 | 咖啡茶饮 |
| 8 | 甜品面包 |
| 9 | 其他餐饮 |

注意：

- 原「中式正餐」必须改为「中餐」。
- 原「东南亚及其他外国菜」必须改为「东南亚菜」。
- 大类不展示在餐厅卡片上，只用于筛选、分类页和统计。

---

## 4. 食鉴大类与小类关系

### 4.1 中餐

包含小类：

```text
综合中餐
综合酒楼
四川菜
广东菜
山东菜
江苏菜
浙江菜
上海菜
湖南菜
安徽菜
福建菜
北京菜
湖北菜
东北菜
云贵菜
西北菜
老字号
地方风味
海鲜
素食
清真菜馆
台湾菜
潮州菜
```

说明：

- 所有带括号的菜系名，前台去掉括号。
- 例如：`四川菜(川菜)` 展示为 `四川菜`。
- 例如：`山东菜(鲁菜)` 展示为 `山东菜`。

### 4.2 火锅烧烤

包含小类：

```text
火锅
烧烤
烤肉
烤鱼
串串
涮肉
```

说明：

- 如果高德只返回 `火锅店`，食鉴小类展示为 `火锅`。

### 4.3 小吃快餐

包含小类：

```text
快餐
汉堡炸鸡
中式快餐
日式快餐
港式快餐
茶餐厅
面馆
粉面
米粉米线
麻辣烫
包子饺子
盖饭简餐
```

说明：

- 高德的 `快餐厅` 比较特殊。
- 快餐厅下面的小类很多是品牌名，例如麦当劳、肯德基、必胜客。
- 品牌名不能直接作为食鉴小类展示，需要映射成真实品类。

### 4.4 日韩料理

包含小类：

```text
日本料理
韩国料理
寿司
日式拉面
韩式烤肉
居酒屋
```

### 4.5 西餐

包含小类：

```text
西餐
法国菜
意大利菜
地中海菜
美式餐厅
英国菜
牛排
俄国菜
葡国菜
德国菜
巴西菜
墨西哥菜
披萨
```

### 4.6 东南亚菜

包含小类：

```text
泰越菜
印度菜
亚洲菜
东南亚菜
```

说明：

- 大类名称统一为 `东南亚菜`，不要叫 `东南亚及其他外国菜`。
- 卡片展示仍然展示具体小类，例如 `泰越菜`、`印度菜`。

### 4.7 咖啡茶饮

包含小类：

```text
咖啡
茶饮
茶馆
冷饮
果汁
奶茶
```

说明：

- `星巴克咖啡`、`上岛咖啡` 这类品牌型小类，统一展示为 `咖啡`。

### 4.8 甜品面包

包含小类：

```text
甜品
面包烘焙
蛋糕
冰淇淋
```

### 4.9 其他餐饮

包含小类：

```text
其他餐饮
休闲餐饮
餐饮相关场所
未知餐饮
```

说明：

- 无法准确归类时进入该大类。
- 不建议大量使用，后续应通过人工规则逐步减少。

---

## 5. 前台餐厅卡片展示规则

餐厅卡片只展示食鉴小类，不展示高德中类，不展示食鉴大类。

### 5.1 正确示例

```text
四季民福
北京 · ¥150
夯爆了
北京菜
```

```text
麦当劳
国贸 · ¥35
NPC
汉堡炸鸡
```

```text
星巴克
三里屯 · ¥40
人上人
咖啡
```

```text
聚宝源
牛街 · ¥120
夯爆了
火锅
```

### 5.2 错误示例

不要展示：

```text
中餐厅 · 北京菜
```

不要展示：

```text
中餐 · 北京菜
```

不要展示：

```text
餐饮服务 · 中餐厅 · 北京菜
```

不要展示：

```text
麦当劳
```

原因：店名已经是麦当劳，分类再显示麦当劳没有信息增量。

---

## 6. 映射规则

### 6.1 普通小类清洗规则

普通高德小类可以清洗后直接成为食鉴小类。

| 高德小类 | 食鉴小类 / 卡片展示 |
|---|---|
| 四川菜(川菜) | 四川菜 |
| 山东菜(鲁菜) | 山东菜 |
| 湖南菜(湘菜) | 湖南菜 |
| 安徽菜(徽菜) | 安徽菜 |
| 广东菜(粤菜) | 广东菜 |
| 北京菜 | 北京菜 |
| 日本料理 | 日本料理 |
| 韩国料理 | 韩国料理 |
| 甜品店 | 甜品 |
| 咖啡厅 | 咖啡 |

### 6.2 括号清洗规则

前台展示时，删除中文括号和英文括号内的内容。

示例：

```text
四川菜(川菜) -> 四川菜
山东菜（鲁菜） -> 山东菜
广东菜(粤菜) -> 广东菜
```

建议实现函数：

```ts
function removeBracketContent(name: string): string {
  return name
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();
}
```

### 6.3 品牌型小类泛化规则

部分高德小类是品牌名，不应该直接展示，需要映射成食鉴小类。

#### 快餐品牌

| 高德中类 | 高德小类 | 食鉴大类 | 食鉴小类 / 卡片展示 |
|---|---|---|---|
| 快餐厅 | 麦当劳 | 小吃快餐 | 汉堡炸鸡 |
| 快餐厅 | 肯德基 | 小吃快餐 | 汉堡炸鸡 |
| 快餐厅 | 汉堡王 | 小吃快餐 | 汉堡炸鸡 |
| 快餐厅 | 德克士 | 小吃快餐 | 汉堡炸鸡 |
| 快餐厅 | 华莱士 | 小吃快餐 | 汉堡炸鸡 |
| 快餐厅 | 必胜客 | 西餐 | 披萨 |
| 快餐厅 | 吉野家 | 小吃快餐 | 日式快餐 |
| 快餐厅 | 永和豆浆 | 小吃快餐 | 中式快餐 |
| 快餐厅 | 大家乐 | 小吃快餐 | 港式快餐 |
| 快餐厅 | 大快活 | 小吃快餐 | 港式快餐 |
| 快餐厅 | 茶餐厅 | 小吃快餐 | 茶餐厅 |

说明：

- 麦当劳、肯德基、汉堡王等不展示品牌名，统一展示为 `汉堡炸鸡`。
- 必胜客不展示品牌名，展示为 `披萨`。
- 吉野家展示为 `日式快餐`。
- 永和豆浆展示为 `中式快餐`。

#### 咖啡品牌

| 高德中类 | 高德小类 | 食鉴大类 | 食鉴小类 / 卡片展示 |
|---|---|---|---|
| 咖啡厅 | 星巴克咖啡 | 咖啡茶饮 | 咖啡 |
| 咖啡厅 | 上岛咖啡 | 咖啡茶饮 | 咖啡 |
| 咖啡厅 | 咖啡厅 | 咖啡茶饮 | 咖啡 |

说明：

- 品牌型咖啡小类统一展示为 `咖啡`。

---

## 7. 推荐字段结构

餐厅表建议包含以下分类字段：

```ts
interface RestaurantCategoryFields {
  amap_type_code?: string;
  amap_big_category?: string;
  amap_mid_category?: string;
  amap_small_category?: string;

  shijian_category: string;
  shijian_subcategory: string;
  display_category_label: string;

  category_source: 'amap_mapping' | 'manual_override' | 'user_submit' | 'unknown';
  category_confidence: number;
  manual_override: boolean;
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| amap_type_code | 高德 POI typecode |
| amap_big_category | 高德大类，通常是餐饮服务 |
| amap_mid_category | 高德中类，例如中餐厅、快餐厅 |
| amap_small_category | 高德小类，例如北京菜、麦当劳 |
| shijian_category | 食鉴大类，例如中餐、小吃快餐 |
| shijian_subcategory | 食鉴小类，例如北京菜、汉堡炸鸡 |
| display_category_label | 餐厅卡片展示标签，通常等于食鉴小类 |
| category_source | 分类来源 |
| category_confidence | 分类置信度，0 到 1 |
| manual_override | 是否人工覆盖 |

---

## 8. 映射优先级

分类映射建议按以下优先级执行：

```text
1. manual_override 人工覆盖
2. brand_mapping 品牌型小类映射
3. exact_mapping 精确小类映射
4. mid_category_fallback 高德中类兜底映射
5. unknown 其他餐饮
```

伪代码：

```ts
function mapRestaurantCategory(input: {
  amapMidCategory?: string;
  amapSmallCategory?: string;
  manualCategory?: string;
  manualSubcategory?: string;
}) {
  if (input.manualCategory && input.manualSubcategory) {
    return {
      shijian_category: input.manualCategory,
      shijian_subcategory: input.manualSubcategory,
      display_category_label: input.manualSubcategory,
      category_source: 'manual_override',
      category_confidence: 1,
      manual_override: true,
    };
  }

  const small = removeBracketContent(input.amapSmallCategory || '');
  const mid = input.amapMidCategory || '';

  const brandKey = `${mid}:${small}`;

  if (BRAND_MAPPING[brandKey]) {
    const result = BRAND_MAPPING[brandKey];
    return {
      ...result,
      display_category_label: result.shijian_subcategory,
      category_source: 'amap_mapping',
      category_confidence: 0.95,
      manual_override: false,
    };
  }

  if (EXACT_SMALL_CATEGORY_MAPPING[small]) {
    const result = EXACT_SMALL_CATEGORY_MAPPING[small];
    return {
      ...result,
      display_category_label: result.shijian_subcategory,
      category_source: 'amap_mapping',
      category_confidence: 0.9,
      manual_override: false,
    };
  }

  if (MID_CATEGORY_FALLBACK[mid]) {
    const result = MID_CATEGORY_FALLBACK[mid];
    return {
      ...result,
      display_category_label: result.shijian_subcategory,
      category_source: 'amap_mapping',
      category_confidence: 0.6,
      manual_override: false,
    };
  }

  return {
    shijian_category: '其他餐饮',
    shijian_subcategory: '其他餐饮',
    display_category_label: '其他餐饮',
    category_source: 'unknown',
    category_confidence: 0.3,
    manual_override: false,
  };
}
```

---

## 9. 示例映射

### 9.1 四季民福

```text
高德大类：餐饮服务
高德中类：中餐厅
高德小类：北京菜

食鉴大类：中餐
食鉴小类：北京菜
卡片展示：北京菜
```

卡片：

```text
四季民福
北京 · ¥150
夯爆了
北京菜
```

### 9.2 麦当劳

```text
高德大类：餐饮服务
高德中类：快餐厅
高德小类：麦当劳

食鉴大类：小吃快餐
食鉴小类：汉堡炸鸡
卡片展示：汉堡炸鸡
```

卡片：

```text
麦当劳
国贸 · ¥35
NPC
汉堡炸鸡
```

### 9.3 肯德基

```text
高德大类：餐饮服务
高德中类：快餐厅
高德小类：肯德基

食鉴大类：小吃快餐
食鉴小类：汉堡炸鸡
卡片展示：汉堡炸鸡
```

### 9.4 必胜客

```text
高德大类：餐饮服务
高德中类：快餐厅
高德小类：必胜客

食鉴大类：西餐
食鉴小类：披萨
卡片展示：披萨
```

### 9.5 星巴克

```text
高德大类：餐饮服务
高德中类：咖啡厅
高德小类：星巴克咖啡

食鉴大类：咖啡茶饮
食鉴小类：咖啡
卡片展示：咖啡
```

### 9.6 四川菜

```text
高德大类：餐饮服务
高德中类：中餐厅
高德小类：四川菜(川菜)

食鉴大类：中餐
食鉴小类：四川菜
卡片展示：四川菜
```

---

## 10. 开发注意事项

1. 不要直接把高德小类写死为前台展示标签。
2. 不要在餐厅卡片展示高德中类。
3. 不要在餐厅卡片展示食鉴大类。
4. 前台分类名必须去掉括号内容。
5. 品牌型小类必须进入品牌映射表。
6. 未命中的分类进入 `其他餐饮`，但要保留原始高德分类，方便后续补规则。
7. 后续允许人工覆盖分类，人工覆盖优先级最高。
8. 餐厅卡片上分类标签尽量只展示一个，避免信息拥挤。

---

## 11. 当前结论

最终产品规则：

```text
高德分类负责识别 POI。
食鉴分类负责组织内容。
餐厅卡片只展示食鉴小类。
```

餐厅卡片展示规则：

```text
display_category_label = 食鉴小类
```

不要展示：

```text
高德大类
高德中类
食鉴大类
括号内容
品牌型高德小类
```

