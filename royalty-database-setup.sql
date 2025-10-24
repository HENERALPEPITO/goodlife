-- Create the royalties table
create table royalties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  song_title text,
  iswc text,
  song_composers text,
  broadcast_date date,
  territory text,
  exploitation_source_name text,
  usage_count int,
  gross_amount numeric,
  administration_percent numeric,
  net_amount numeric,
  created_at timestamp default now()
);

-- Enable Row Level Security
alter table royalties enable row level security;

-- Create RLS policies
create policy "Users can view their own data"
on royalties for select
using (auth.uid() = user_id);

create policy "Users can insert their own data"
on royalties for insert
with check (auth.uid() = user_id);

create policy "Users can update their own data"
on royalties for update
using (auth.uid() = user_id);

create policy "Users can delete their own data"
on royalties for delete
using (auth.uid() = user_id);
