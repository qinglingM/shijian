-- 0018: Composite indexes for query performance
-- Target queries: useTierMap, useSquareFeed, useMapRestaurants

-- 1. useTierMap: user practices by user + active status + time
CREATE INDEX IF NOT EXISTS practice_records_user_active_time_idx
  ON practice_records (user_id, is_active, created_at DESC);

-- 2. Square feed: public practices with comments
CREATE INDEX IF NOT EXISTS practice_records_feed_idx
  ON practice_records (is_public, is_active, created_at DESC)
  WHERE store_comment IS NOT NULL AND store_comment != '';

-- 3. Square feed: posts (kept for future use)
CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON posts (is_public, created_at DESC);

-- 4. HomeMap: restaurants with coordinates
CREATE INDEX IF NOT EXISTS restaurants_geo_active_idx
  ON restaurants (status, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 5. HomeMap: practices by restaurant + active
CREATE INDEX IF NOT EXISTS practice_records_restaurant_active_idx
  ON practice_records (restaurant_id, is_active);

-- 6. Review votes: lookups by target + type + vote type
CREATE INDEX IF NOT EXISTS review_votes_target_lookup_idx
  ON review_votes (target_type, target_id, vote_type);
