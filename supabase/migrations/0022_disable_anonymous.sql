-- disable anonymous reviews: set all existing anonymous records to non-anonymous
update practice_records set is_anonymous = false where is_anonymous = true;
