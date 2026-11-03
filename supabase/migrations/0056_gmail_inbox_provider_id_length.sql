-- PostgreSQL's regex repetition bound is 255; enforce the provider-ID length separately.
alter table public.gmail_inbox_messages
  drop constraint gmail_inbox_messages_gmail_message_id_check,
  add constraint gmail_inbox_messages_gmail_message_id_check
    check (length(gmail_message_id) between 1 and 256 and gmail_message_id ~ '^[a-zA-Z0-9_-]+$'),
  drop constraint gmail_inbox_messages_gmail_thread_id_check,
  add constraint gmail_inbox_messages_gmail_thread_id_check
    check (length(gmail_thread_id) between 1 and 256 and gmail_thread_id ~ '^[a-zA-Z0-9_-]+$');
