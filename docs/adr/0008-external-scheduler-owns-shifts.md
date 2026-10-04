# The External scheduler owns shifts

The product shows only timestamped, read-only Staffing snapshots imported from the clinic's External scheduler, and it never creates or edits shifts. We rejected built-in scheduling because it would duplicate the system of record and let two sources of truth drift apart. For the same reason, the product does not monitor live intake capacity, throughput, or diversion.
