# Patient-information warnings advise and never block

The product is operational-only, but text that looks like patient details triggers an advisory Patient-information warning instead of a hard block. The deterministic detector is not accurate enough to make compliance decisions, and false blocks would stop urgent operational messages. Audit events record the warning rule, actor, time, and Scope, never the flagged content. This is not a compliance control. Any move to blocking needs a validated classifier and legal, privacy, and compliance review.
