-- ============================================================
-- Papers table: enable RLS and add per-user policies
-- ============================================================

alter table if exists public.papers enable row level security;

-- Drop any existing policies so this migration is idempotent
drop policy if exists "users can read own papers"    on public.papers;
drop policy if exists "users can insert own papers"  on public.papers;
drop policy if exists "users can update own papers"  on public.papers;
drop policy if exists "users can delete own papers"  on public.papers;

-- Authenticated users can only see their own papers
create policy "users can read own papers"
  on public.papers for select
  using (auth.uid() = user_id);

-- Authenticated users can only create papers for themselves
create policy "users can insert own papers"
  on public.papers for insert
  with check (auth.uid() = user_id);

-- Authenticated users can only update their own papers
create policy "users can update own papers"
  on public.papers for update
  using (auth.uid() = user_id);

-- Authenticated users can only delete their own papers
create policy "users can delete own papers"
  on public.papers for delete
  using (auth.uid() = user_id);


-- ============================================================
-- Storage bucket: pdfs — per-user isolation
-- ============================================================

-- Make sure the bucket exists
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do nothing;

drop policy if exists "users can upload own pdfs"   on storage.objects;
drop policy if exists "anyone can read pdfs"        on storage.objects;
drop policy if exists "users can delete own pdfs"   on storage.objects;

-- PDFs are publicly readable (needed for inline viewer)
create policy "anyone can read pdfs"
  on storage.objects for select
  using (bucket_id = 'pdfs');

-- Only authenticated users can upload, and only into their own folder
create policy "users can upload own pdfs"
  on storage.objects for insert
  with check (
    bucket_id = 'pdfs'
    and auth.uid() is not null
  );

-- Users can only delete their own uploads
create policy "users can delete own pdfs"
  on storage.objects for delete
  using (
    bucket_id = 'pdfs'
    and auth.uid() is not null
  );
