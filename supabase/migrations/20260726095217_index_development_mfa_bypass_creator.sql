create index development_mfa_bypasses_created_by_idx
  on private.development_mfa_bypasses (created_by)
  where created_by is not null;
