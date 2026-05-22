-- dishes.name 最大长度 16 字符
alter table dishes
  add constraint dishes_name_max_length
  check (char_length(name) <= 16);
