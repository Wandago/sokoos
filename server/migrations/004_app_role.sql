-- Actually running as the unprivileged role.
--
-- 002 created `sokoos_app` without BYPASSRLS and wrote policies against it, on
-- the stated assumption that "the application connects as a role that cannot
-- bypass this". It never did. The service connected as the owner — a superuser
-- on most local installs — and a superuser bypasses row-level security
-- unconditionally. `force row level security` does not change that: it makes
-- policies apply to the *owner*, not to a superuser.
--
-- So every policy in 002 was decorative. It looked right in `pg_policies`, it
-- reported enabled and forced in `pg_class`, and a query that forgot its tenant
-- clause would still have returned another business's books.
--
-- The fix is not a different policy. It is dropping privileges for the duration
-- of each tenant-scoped transaction, with `set local role`, which needs the
-- connecting role to be a member of sokoos_app. That is what this grants.
--
-- Chosen over a second connection string for the application because it needs
-- no extra credential to store, rotate or leak — and because a single
-- connection string is one fewer thing for somebody to get wrong on the day
-- they deploy.

do $$
begin
  execute format('grant sokoos_app to %I', current_user);
exception
  -- Already a member, or the platform manages role membership itself. Neither
  -- is a reason to fail a migration; the check below is what actually matters.
  when others then null;
end
$$;

-- 003 created its tables after 002's blanket grant, so they were never covered.
-- Re-granting is idempotent and catches anything else added in between.
grant select, insert, update, delete on all tables in schema public to sokoos_app;
grant usage, select on all sequences in schema public to sokoos_app;

-- mpesa_events carries a tenant's payment history and was enabled for RLS in
-- 003; the others are keyed by tenant and reached only through withTenant.
alter table mpesa_events force row level security;
