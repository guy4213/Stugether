// The only layer allowed to query the database.
// Components and pages call repositories — never supabase.from() directly.
// One file per aggregate: courses, rooms, invitations, messages, profiles, admin.
export {};
