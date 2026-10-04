# YKSG Workspace

Internal, operational-only messaging and coordination for the staff of Phòng Khám Y Khoa Sài Gòn (YKSG) across its Locations. It never carries patient information or clinical exchange.

## Language

### Organization and people

**Organization**:
YKSG as a whole: the single tenant that owns every Location, Department, Member, and Channel.
_Avoid_: Tenant, clinic, company

**Location**:
One physical site of the Organization, such as Cơ sở Trung tâm or Cơ sở phía Đông.
_Avoid_: Site, branch, campus, cơ sở (in English text)

**Department**:
A functional group, such as Front Desk or Nursing, that can operate at one or more Locations.
_Avoid_: Team, unit, ward

**Member**:
A person who belongs to the Organization through a Membership.
_Avoid_: User, employee, account, staff member

**Membership**:
A Member's standing in the Organization: active, suspended, or expired. Only an active Membership grants access.
_Avoid_: Account status

**Assignment**:
The placement of a Member at a Location and/or Department, optionally time-boxed. One Assignment is the Member's primary Assignment and sets their defaults.
_Avoid_: Posting, placement, task assignment

**Float Member**:
A Member with Assignments at more than one Location.
_Avoid_: Dual-site staff, shared staff

**Role**:
A named level of authority that a Member holds within a Scope: Owner, Organization admin, Location manager, Department lead, Staff, Contractor, or IT support.
_Avoid_: Permission level, user type

**Scope**:
The Organization, Locations, or Departments that a Role applies to.
_Avoid_: Reach, area

**Manager**:
Any Member whose Role lets them direct others' work in a Scope: Owner, Organization admin, Location manager, or Department lead.
_Avoid_: Supervisor, boss, admin (when not an Organization admin)

**Invitation**:
An offer to join the Organization that carries the Role, Assignment, and optional expiry the new Member will receive.

**Onboarding**:
The steps a newly invited Member completes before first use: profile, guidance acknowledgement, and preferences.

**Transfer**:
Moving a Member's Assignment from one Location or Department to another.

**Offboarding**:
Ending a Member's Membership, Assignments, and access while keeping the audit history.

### Channels and messaging

**Channel**:
A named conversation space with a Channel type, an owner, and visibility rules.
_Avoid_: Room (except Incident room), group, thread

**Channel type**:
The kind of Channel, which fixes who can see, create, and join it: Department, Interface, Project, Location, Announcement, Leadership, Incident, or Direct message.

**Hub**:
An Organization-wide or Location Channel that gives every Member a predictable entry point. Specialized work happens in the other Channel types.

**Interface channel**:
A standing Channel for a recurring workflow between named Departments, such as Front Desk and Nursing coordinating same-day scheduling.
_Avoid_: Cross-team channel, shared channel

**Incident room**:
An Incident-type Channel with explicit urgency, time-boxed membership, and a resolution state, opened when urgent work outgrows an ordinary Channel.
_Avoid_: War room, emergency channel

**Direct message**:
A Channel whose only members are its explicit participants.
_Avoid_: DM thread, private chat

**Access request**:
A Member's request to join one specific Channel without receiving a new Assignment.

**Urgent message**:
A single message marked as needing prompt attention. Marking a message urgent does not make its Channel urgent.
_Avoid_: Priority message, alert

**Announcement**:
A one-to-many notice published to an audience within the author's Scope, optionally requiring Acknowledgement.
_Avoid_: Broadcast (except for emergencies), bulletin, post

**Acknowledgement**:
A recipient's explicit confirmation that they read an urgent Announcement.
_Avoid_: Read receipt

**Attachment**:
A file sent with a message. It is Quarantined until scanned and becomes Available only after it passes.
_Avoid_: Upload, document (when meaning a message file)

**Patient-information warning**:
An advisory prompt shown before sending text that resembles patient details. The sender can edit or confirm. It never blocks.
_Avoid_: PHI filter, content block, DLP

### Work

**Task**:
A piece of accountable work with one assignee and a due date, optionally linked to the Channel it came from.
_Avoid_: Todo, ticket, job

**Delegation**:
A Manager giving a Task to another Member, who must accept or decline it before work starts.
_Avoid_: Assignment, handoff

**Self-created task**:
A Task a Member creates for themselves. It skips acceptance.

**Task status**:
Where a Task is in its lifecycle: Pending acceptance, Accepted, In progress, Blocked, Done, Declined, or Canceled.

**Block report**:
The assignee's statement of why a Task cannot proceed. Filing one moves the Task to Blocked.
_Avoid_: Issue, flag

**Reassignment**:
A Manager moving a Delegated Task to a different assignee.

**Task template**:
A reusable Task definition with a title, a checklist, and optionally a Recurrence.

**Recurrence**:
A daily, weekly, or monthly schedule that generates Tasks from a Task template.
_Avoid_: Repeat, schedule (alone)

**Meeting**:
A scheduled call, such as Google Meet or Zoom, with an organizer, a time, and invitees drawn from a Channel.
_Avoid_: Event, appointment

**Meeting response**:
An invitee's answer to a Meeting: accepted or declined. The organizer is accepted automatically.
_Avoid_: RSVP

**Work agenda**:
One Member's combined, time-ordered view of their Tasks and accepted Meetings. A Manager can view it for their Scope.
_Avoid_: Calendar, dashboard

**Staffing snapshot**:
A timestamped, read-only copy of shift coverage imported from the External scheduler.
_Avoid_: Roster, schedule, live staffing

**External scheduler**:
The system outside this product that owns shifts. This product never creates or edits shifts.

### Surfaces

**Workspace**:
The main YKSG application for desktop use. Mobile access belongs to the Mini App; mobile PWA and standalone Android and iOS apps are outside the current release scope.
_Avoid_: Portal, dashboard, client

**Preview mode**:
The unauthenticated Workspace running on synthetic data for interface work and demos. Nothing in it is durable.
_Avoid_: Demo mode, sandbox, mock mode

**Inbox**:
The Workspace's first screen, showing what needs the Member's attention.
_Avoid_: Home, feed, overview

**Zalo panel**:
A Member's personal Zalo inbox opened in a separate window docked beside the Workspace. It stays outside YKSG's data boundary.
_Avoid_: Zalo integration, embedded Zalo

**Mini App**:
The mobile companion to the Workspace that runs inside the Zalo client.
_Avoid_: Zalo panel (which means the separate personal inbox window)

**Work rail**:
The Mini App's list of today's Tasks and Meetings that need a response.
