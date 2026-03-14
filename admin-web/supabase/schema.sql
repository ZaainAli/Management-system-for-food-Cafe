-- ============================================================
-- RESTAURANT ADMIN — SUPABASE SCHEMA
-- Run this in the Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Branches
create table if not exists branches (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  address    text,
  phone      text,
  created_at timestamptz not null default now()
);

-- Profiles (mirrors auth.users — needed because auth.users is not exposed via anon key)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Branch ↔ User mapping with role per branch
create table if not exists branch_users (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  branch_id  uuid not null references branches(id) on delete cascade,
  role       text not null check (role in ('admin','manager','cashier','staff')),
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, branch_id)
);

-- Menu categories per branch
create table if not exists menu_categories (
  id        uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  name      text not null
);

-- Menu items per branch
create table if not exists menu_items (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references branches(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name        text not null,
  price       numeric(10,2) not null default 0,
  available   boolean not null default true
);

-- Bills per branch
create table if not exists bills (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references branches(id) on delete cascade,
  bill_number text,
  subtotal    numeric(10,2) not null default 0,
  discount    numeric(10,2) not null default 0,
  total       numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- Bill line items
create table if not exists bill_items (
  id           uuid primary key default uuid_generate_v4(),
  bill_id      uuid not null references bills(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name         text not null,
  price        numeric(10,2) not null,
  quantity     integer not null default 1
);

-- Stock / Inventory per branch
create table if not exists stock_items (
  id                  uuid primary key default uuid_generate_v4(),
  branch_id           uuid not null references branches(id) on delete cascade,
  name                text not null,
  quantity            numeric(10,3) not null default 0,
  unit                text not null default 'pcs',
  low_stock_threshold numeric(10,3) not null default 0
);

-- Expenses per branch
create table if not exists expenses (
  id          uuid primary key default uuid_generate_v4(),
  branch_id   uuid not null references branches(id) on delete cascade,
  category    text not null,
  description text,
  amount      numeric(10,2) not null default 0,
  date        date not null default current_date,
  source_type      text not null default 'manual'
                   check (source_type in ('manual','khata','salary')),
  source_entity_id uuid,          -- khata_profile.id or employee.id
  source_record_id uuid           -- khata_transaction.id or salary_record.id
);

-- Khata (ledger) profiles per branch
create table if not exists khata_profiles (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references branches(id) on delete cascade,
  name         text not null,
  phone        text,
  notes        text,
  profile_type text not null default 'supplier' check (profile_type in ('supplier','customer'))
);

-- Khata transactions (due / payment)
create table if not exists khata_transactions (
  id         uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references khata_profiles(id) on delete cascade,
  branch_id  uuid not null references branches(id) on delete cascade,
  type           text not null check (type in ('due','payment')),
  amount         numeric(10,2) not null default 0,
  note           text,
  date           date not null default current_date,
  payment_source text check (payment_source in ('today_sale','net_profit')),
  expense_id     uuid
);

-- Employees per branch
create table if not exists employees (
  id        uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references branches(id) on delete cascade,
  name      text not null,
  role      text,
  phone     text,
  salary    numeric(10,2) not null default 0,
  hire_date date,
  active    boolean not null default true
);

-- Salary records per employee
create table if not exists salary_records (
  id          uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references employees(id) on delete cascade,
  branch_id   uuid not null references branches(id) on delete cascade,
  amount      numeric(10,2) not null,
  month       text not null,  -- format: 'YYYY-MM'
  paid_at     timestamptz not null default now()
);

-- Daily sales aggregate per branch
create table if not exists daily_sales (
  id             uuid primary key default uuid_generate_v4(),
  branch_id      uuid not null references branches(id) on delete cascade,
  date           date not null,
  total_revenue  numeric(10,2) not null default 0,
  total_expenses numeric(10,2) not null default 0,
  bill_count     integer not null default 0,
  unique(branch_id, date)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_profiles_id                  on profiles(id);
create index if not exists idx_branch_users_branch_id       on branch_users(branch_id);
create index if not exists idx_branch_users_user_id         on branch_users(user_id);
create index if not exists idx_menu_categories_branch_id    on menu_categories(branch_id);
create index if not exists idx_menu_items_branch_id         on menu_items(branch_id);
create index if not exists idx_bills_branch_id              on bills(branch_id);
create index if not exists idx_bills_created_at             on bills(created_at);
create index if not exists idx_bill_items_bill_id           on bill_items(bill_id);
create index if not exists idx_stock_items_branch_id        on stock_items(branch_id);
create index if not exists idx_expenses_branch_id           on expenses(branch_id);
create index if not exists idx_expenses_date                on expenses(date);
create index if not exists idx_khata_profiles_branch_id     on khata_profiles(branch_id);
create index if not exists idx_khata_transactions_branch_id on khata_transactions(branch_id);
create index if not exists idx_employees_branch_id          on employees(branch_id);
create index if not exists idx_salary_records_branch_id     on salary_records(branch_id);
create index if not exists idx_daily_sales_branch_id        on daily_sales(branch_id);
create index if not exists idx_daily_sales_date             on daily_sales(date);

-- ============================================================
-- TRIGGER: auto-populate profiles on new auth user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table branches           enable row level security;
alter table profiles           enable row level security;
alter table branch_users       enable row level security;
alter table menu_categories    enable row level security;
alter table menu_items         enable row level security;
alter table bills              enable row level security;
alter table bill_items         enable row level security;
alter table stock_items        enable row level security;
alter table expenses           enable row level security;
alter table khata_profiles     enable row level security;
alter table khata_transactions enable row level security;
alter table employees          enable row level security;
alter table salary_records     enable row level security;
alter table daily_sales        enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid recursive RLS)
-- ============================================================

-- Returns true if current user is a member of a given branch
create or replace function is_branch_member(bid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from branch_users
    where user_id   = auth.uid()
    and   branch_id = bid
  );
$$;

-- Returns true if current user has 'admin' role in ANY branch
create or replace function is_global_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from branch_users
    where user_id = auth.uid()
    and   role    = 'admin'
  );
$$;

-- Returns the role of the current user in a given branch
create or replace function branch_role(bid uuid)
returns text language sql security definer as $$
  select role from branch_users
  where user_id   = auth.uid()
  and   branch_id = bid
  limit 1;
$$;

-- ============================================================
-- RLS POLICIES — branches
-- ============================================================
drop policy if exists "branches_select" on branches;
create policy "branches_select" on branches for select
  using (
    is_global_admin()
    or id in (
      select branch_id from branch_users where user_id = auth.uid()
    )
  );

drop policy if exists "branches_insert" on branches;
create policy "branches_insert" on branches for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "branches_update" on branches;
create policy "branches_update" on branches for update
  using (is_global_admin());

drop policy if exists "branches_delete" on branches;
create policy "branches_delete" on branches for delete
  using (is_global_admin());

-- ============================================================
-- RLS POLICIES — profiles
-- ============================================================
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_global_admin());

drop policy if exists "profiles_insert" on profiles;
create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid());

-- ============================================================
-- RLS POLICIES — branch_users
-- ============================================================
drop policy if exists "branch_users_select" on branch_users;
create policy "branch_users_select" on branch_users for select
  using (user_id = auth.uid() or is_global_admin());

drop policy if exists "branch_users_insert" on branch_users;
create policy "branch_users_insert" on branch_users for insert
  with check (is_global_admin());

drop policy if exists "branch_users_update" on branch_users;
create policy "branch_users_update" on branch_users for update
  using (is_global_admin());

drop policy if exists "branch_users_delete" on branch_users;
create policy "branch_users_delete" on branch_users for delete
  using (is_global_admin());

-- ============================================================
-- RLS POLICIES — menu_categories
-- ============================================================
drop policy if exists "menu_categories_select" on menu_categories;
create policy "menu_categories_select" on menu_categories for select
  using (is_branch_member(branch_id));

drop policy if exists "menu_categories_write" on menu_categories;
create policy "menu_categories_write" on menu_categories for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = menu_categories.branch_id
      and   role in ('admin','manager')
    )
  );

-- ============================================================
-- RLS POLICIES — menu_items
-- ============================================================
drop policy if exists "menu_items_select" on menu_items;
create policy "menu_items_select" on menu_items for select
  using (is_branch_member(branch_id));

drop policy if exists "menu_items_write" on menu_items;
create policy "menu_items_write" on menu_items for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = menu_items.branch_id
      and   role in ('admin','manager')
    )
  );

-- ============================================================
-- RLS POLICIES — bills
-- ============================================================
drop policy if exists "bills_select" on bills;
create policy "bills_select" on bills for select
  using (is_branch_member(branch_id));

drop policy if exists "bills_write" on bills;
create policy "bills_write" on bills for all
  using (is_branch_member(branch_id));

-- ============================================================
-- RLS POLICIES — bill_items
-- ============================================================
drop policy if exists "bill_items_select" on bill_items;
create policy "bill_items_select" on bill_items for select
  using (
    bill_id in (
      select id from bills where is_branch_member(branch_id)
    )
  );

drop policy if exists "bill_items_write" on bill_items;
create policy "bill_items_write" on bill_items for all
  using (
    bill_id in (
      select id from bills where is_branch_member(branch_id)
    )
  );

-- ============================================================
-- RLS POLICIES — stock_items
-- ============================================================
drop policy if exists "stock_items_select" on stock_items;
create policy "stock_items_select" on stock_items for select
  using (is_branch_member(branch_id));

drop policy if exists "stock_items_write" on stock_items;
create policy "stock_items_write" on stock_items for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = stock_items.branch_id
      and   role in ('admin','manager','cashier')
    )
  );

-- ============================================================
-- RLS POLICIES — expenses
-- ============================================================
drop policy if exists "expenses_select" on expenses;
create policy "expenses_select" on expenses for select
  using (is_branch_member(branch_id));

drop policy if exists "expenses_write" on expenses;
create policy "expenses_write" on expenses for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = expenses.branch_id
      and   role in ('admin','manager','cashier')
    )
  );

-- ============================================================
-- RLS POLICIES — khata_profiles
-- ============================================================
drop policy if exists "khata_profiles_select" on khata_profiles;
create policy "khata_profiles_select" on khata_profiles for select
  using (is_branch_member(branch_id));

drop policy if exists "khata_profiles_write" on khata_profiles;
create policy "khata_profiles_write" on khata_profiles for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = khata_profiles.branch_id
      and   role in ('admin','manager')
    )
  );

-- ============================================================
-- RLS POLICIES — khata_transactions
-- ============================================================
drop policy if exists "khata_transactions_select" on khata_transactions;
create policy "khata_transactions_select" on khata_transactions for select
  using (is_branch_member(branch_id));

drop policy if exists "khata_transactions_write" on khata_transactions;
create policy "khata_transactions_write" on khata_transactions for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = khata_transactions.branch_id
      and   role in ('admin','manager','cashier')
    )
  );

-- ============================================================
-- RLS POLICIES — employees
-- ============================================================
drop policy if exists "employees_select" on employees;
create policy "employees_select" on employees for select
  using (is_branch_member(branch_id));

drop policy if exists "employees_write" on employees;
create policy "employees_write" on employees for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = employees.branch_id
      and   role in ('admin','manager')
    )
  );

-- ============================================================
-- RLS POLICIES — salary_records
-- ============================================================
drop policy if exists "salary_records_select" on salary_records;
create policy "salary_records_select" on salary_records for select
  using (is_branch_member(branch_id));

drop policy if exists "salary_records_write" on salary_records;
create policy "salary_records_write" on salary_records for all
  using (
    exists (
      select 1 from branch_users
      where user_id   = auth.uid()
      and   branch_id = salary_records.branch_id
      and   role in ('admin','manager')
    )
  );

-- ============================================================
-- RLS POLICIES — daily_sales
-- ============================================================
drop policy if exists "daily_sales_select" on daily_sales;
create policy "daily_sales_select" on daily_sales for select
  using (is_branch_member(branch_id));

drop policy if exists "daily_sales_write" on daily_sales;
create policy "daily_sales_write" on daily_sales for all
  using (is_branch_member(branch_id));

-- ============================================================
-- DELETED ITEMS (trash bin — auto-expire after 30 days)
-- ============================================================
create table if not exists deleted_items (
  id           uuid primary key default uuid_generate_v4(),
  branch_id    uuid not null references branches(id) on delete cascade,
  item_type    text not null,  -- 'khata_transaction' | 'khata_profile' | 'expense'
  item_id      text not null,
  item_data    jsonb not null,
  deleted_by   text not null default 'electron', -- 'electron' | 'web'
  deleted_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_deleted_items_branch_id  on deleted_items(branch_id);
create index if not exists idx_deleted_items_expires_at on deleted_items(expires_at);

alter table deleted_items enable row level security;

drop policy if exists "deleted_items_select" on deleted_items;
create policy "deleted_items_select" on deleted_items for select
  using (is_branch_member(branch_id));

drop policy if exists "deleted_items_write" on deleted_items;
create policy "deleted_items_write" on deleted_items for all
  using (is_branch_member(branch_id));

-- Auto-cleanup: delete expired rows daily (requires pg_cron extension)
-- select cron.schedule('cleanup-deleted-items', '0 2 * * *',
--   $$delete from deleted_items where expires_at < now()$$);
