update private.environment_settings
set environment = 'development', updated_at = now()
where singleton;
