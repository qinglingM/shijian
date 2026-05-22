-- backfill phone numbers for existing auth users
-- reads phone_e164 from raw_user_meta_data and sets the phone column
update auth.users
set phone = raw_user_meta_data ->> 'phone_e164',
    phone_confirmed_at = coalesce(phone_confirmed_at, now())
where raw_user_meta_data ->> 'phone_e164' is not null
  and (phone is null or phone = '');
