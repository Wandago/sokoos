-- Row-level security, as defence in depth.
--
-- Every query in the application already goes through a repository that takes
-- a tenant id, so in principle this changes nothing. That is exactly why it is
-- here: the day someone writes a query that forgets the tenant clause — and on
-- a long enough timeline someone will — the database refuses it rather than
-- quietly returning another business's books.
--
-- The application connects as a role that cannot bypass this. Migrations run
-- as the owner, which can.

-- A role for the application itself. It gets no BYPASSRLS, on purpose.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sokoos_app') then
    create role sokoos_app;
  end if;
end
$$;

grant usage on schema public to sokoos_app;
grant select, insert, update, delete on all tables in schema public to sokoos_app;
grant usage, select on all sequences in schema public to sokoos_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to sokoos_app;

alter table records          enable row level security;
alter table tenant_cursors   enable row level security;
alter table applied_batches  enable row level security;
alter table memberships      enable row level security;

alter table records          force row level security;
alter table tenant_cursors   force row level security;
alter table applied_batches  force row level security;

-- The tenant for the current transaction is set with set_config, not taken
-- from the row, so a query cannot widen its own scope. An unset value is the
-- empty string, which matches no tenant — the safe direction to fail.
create or replace function current_tenant() returns uuid
language sql stable as $$
  select nullif(current_setting('sokoos.tenant_id', true), '')::uuid
$$;

create policy tenant_isolation on records
  using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

create policy tenant_isolation on tenant_cursors
  using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

create policy tenant_isolation on applied_batches
  using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

-- Memberships are read during sign-in, before a tenant is known, so this one
-- is scoped by account instead.
create policy membership_visibility on memberships
  using (
    account_id = nullif(current_setting('sokoos.account_id', true), '')::uuid
    or tenant_id = current_tenant()
  );
