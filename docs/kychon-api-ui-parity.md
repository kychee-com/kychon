# Kychon API UI Parity

The bundled UI should migrate workflow-by-workflow to shared capability handlers or SDK/API calls.

Migration order:

1. Member approval and admin actions.
2. Event create, update, delete, timezone, RSVP, and registration option flows.
3. Announcement publish, update, pin, unpin, and delete flows.
4. Resource upload and delete flows.
5. Forum topic, reply, and moderator flows.
6. Poll create, vote, close, reopen, and delete flows.
7. Committee member management flows.
8. Settings, config, page, and section edit flows.

Current UI-only behavior should be listed in the capability manifest `uiParity.uiOnly` field with rationale until migrated.
