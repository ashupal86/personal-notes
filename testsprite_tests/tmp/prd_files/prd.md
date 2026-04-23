# The Quiet Archive — Platform Testing PRD

> **Version:** 1.0 | **Status:** Testing Ready | **Last Updated:** April 2026  
> **Purpose:** This document provides all information needed for QA engineers, testers, and automated test-generation tools to produce comprehensive end-to-end test cases including edge cases, security scenarios, and RBAC validation.

---

## 1. Platform Overview

**The Quiet Archive** is a multi-tenant, role-based knowledge workspace. Users can write and organise Markdown notes, manage tasks, and schedule calendar events — all scoped to their assigned workspaces.

### 1.1 Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS |
| Backend | Next.js Route Handlers (REST API) |
| Database | Supabase (PostgreSQL) |
| Auth | Custom session (HTTP-only cookie qa_session) + API Key |
| Real-time | WebSockets (via Supabase Realtime) |
| Icons | lucide-react (unified) |
| State | TanStack Query v5 |
| Markdown | Custom Typora-style per-line editor + marked |

### 1.2 Entry Points
| URL | Purpose |
|-----|---------|
| /setup | First-run super admin bootstrap |
| /login | Standard login form |
| / | Dashboard (requires auth) |
| /workspace?ws={id} | Workspace note editor |
| /tasks | Task management (admin+) |
| /calendar | Calendar events (admin+) |
| /settings?tab={tab} | Settings panel |

---

## 2. User Roles & Permissions Matrix

### 2.1 Role Hierarchy
super_admin (weight: 3) > admin (weight: 2) > user (weight: 1)

### 2.2 Permissions Table

| Feature | user | admin | super_admin |
|---------|------|-------|------------|
| Read own workspace notes | YES | YES | YES |
| Create/edit/delete notes (own workspace) | YES | YES | YES |
| Access tasks page | NO | YES | YES |
| Create/edit tasks | NO | YES | YES |
| Access calendar page | NO | YES | YES |
| Create/edit events | NO | YES | YES |
| Create workspaces | NO | YES | YES |
| Delete workspaces | NO | NO | YES |
| Add members to workspace | NO | YES | YES |
| Create users | NO | YES | YES |
| Delete users | NO | NO | YES |
| Generate API keys | NO | YES | YES |
| View settings workspaces tab | NO | YES | YES |
| View settings users tab | NO | YES | YES |

### 2.3 Workspace Access Rules
- super_admin: Sees and accesses ALL workspaces
- admin: Sees only workspaces they created or are a member of
- user: Sees only workspaces they are explicitly assigned to. Default = "General" workspace

---

## 3. API Endpoint Reference

### 3.1 Authentication APIs

| Method | Endpoint | Auth Required | Role | Description |
|--------|----------|--------------|------|-------------|
| GET | /api/auth/setup | No | - | Check if setup is needed |
| POST | /api/auth/setup | No | - | Create super admin (first run only) |
| POST | /api/auth/login | No | - | Login, sets qa_session cookie |
| POST | /api/auth/logout | Yes | any | Clear session |
| GET | /api/me | Yes | any | Get current user info |

### 3.2 Notes APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/notes?workspace_id={id} | Session/Key | any |
| POST | /api/notes | Session/Key | any |
| PATCH | /api/notes/{id} | Session/Key | any |
| DELETE | /api/notes/{id} | Session/Key | any |

### 3.3 Tasks APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/tasks?workspace_id={id} | Session/Key | admin+ |
| POST | /api/tasks | Session/Key | admin+ |
| PATCH | /api/tasks/{id} | Session/Key | admin+ |
| DELETE | /api/tasks/{id} | Session/Key | admin+ |

### 3.4 Calendar APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/calendar?workspace_id={id} | Session/Key | admin+ |
| POST | /api/calendar | Session/Key | admin+ |
| PATCH | /api/calendar/{id} | Session/Key | admin+ |
| DELETE | /api/calendar/{id} | Session/Key | admin+ |

### 3.5 Workspace APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/workspaces | Session/Key | any |
| POST | /api/workspaces | Session/Key | admin+ |
| DELETE | /api/workspaces/{id} | Session/Key | admin+ |
| POST | /api/workspaces/{id}/members | Session/Key | admin+ |

### 3.6 User Management APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | /api/users | Session/Key | admin+ |
| POST | /api/users | Session/Key | admin+ |
| DELETE | /api/users/{id} | Session/Key | admin+ |

### 3.7 API Key Management APIs

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /api/auth/api-keys | Session | admin+ | Get all API keys |
| POST | /api/auth/api-keys | Session | admin+ | Generate new API key |
| DELETE | /api/auth/api-keys/{id} | Session | admin+ | Revoke API key |

---

## 4. Test Scenarios by Feature

### 4.1 Setup & First Run

**TC-SETUP-001**: First-run detection  
- Precondition: Empty database  
- Action: GET /api/auth/setup  
- Expected: { setup_required: true }

**TC-SETUP-002**: Create super admin happy path  
- Action: POST /api/auth/setup { email, password (8+ chars), display_name }  
- Expected: 200, qa_session cookie set, General workspace created, user role = super_admin

**TC-SETUP-003**: Duplicate setup blocked  
- Precondition: User already exists  
- Action: POST /api/auth/setup again  
- Expected: 409 "Setup already completed"

**TC-SETUP-004**: Setup with weak password  
- Action: POST /api/auth/setup with password = "abc"  
- Expected: 400 "Password must be at least 8 characters"

**TC-SETUP-005**: Setup page redirect after completion  
- Action: Navigate to /setup after setup is done  
- Expected: Redirected to /login

---

### 4.2 Authentication

**TC-AUTH-001**: Successful login  
- Action: POST /api/auth/login with valid credentials  
- Expected: 200, qa_session HTTP-only cookie set, redirect to /

**TC-AUTH-002**: Wrong password  
- Expected: 401, no cookie set

**TC-AUTH-003**: Non-existent email  
- Expected: 401 (same response as wrong password for timing safety)

**TC-AUTH-004**: Empty credentials  
- Expected: 400 validation error

**TC-AUTH-005**: Session persistence  
- Action: Login, close tab, reopen /  
- Expected: Still authenticated (cookie valid 30 days)

**TC-AUTH-006**: Logout clears session  
- Action: Login, logout  
- Expected: Cookie cleared, redirect to /login, API calls return 401

**TC-AUTH-007**: Access protected route without session  
- Action: GET /api/notes without cookie or API key  
- Expected: 401 { error: "Unauthorized" }

**TC-AUTH-008**: Role label in sidebar  
- Action: Login as each role, check profile area  
- Expected: Correct role shown

---

### 4.3 Notes CRUD

**TC-NOTE-001**: Create note in workspace  
- Action: POST /api/notes { title, content_md: "", workspace_id }  
- Expected: 201, note object returned

**TC-NOTE-002**: Create note in workspace not in user membership  
- Precondition: Regular user  
- Expected: 403 "Access denied to workspace"

**TC-NOTE-003**: Read notes scoped to workspace  
- Action: GET /api/notes?workspace_id=id  
- Expected: Only notes for that workspace, no cross-workspace leakage

**TC-NOTE-004**: Update note title and content  
- Action: PATCH /api/notes/{id} { title, content_md }  
- Expected: 200, note updated

**TC-NOTE-005**: Delete note  
- Action: DELETE /api/notes/{id}  
- Expected: 200, soft-deleted, disappears from GET

**TC-NOTE-006**: Delete note twice  
- Expected: Second call 404 (not crash)

**TC-NOTE-007**: Update non-existent note  
- Action: PATCH /api/notes/nonexistent-uuid  
- Expected: 404

**TC-NOTE-008**: Create note without workspace_id  
- Expected: 400 "workspace_id required"

**TC-NOTE-009**: Pin/unpin note  
- Expected: Pinned notes at top of list

**TC-NOTE-010**: Markdown rendered in preview  
- Action: Create note with "# Heading\n**bold**"  
- Expected: Preview shows H1 and bold text

**TC-NOTE-011**: Right-click context menu  
- Action: Right-click note in sidebar  
- Expected: Context menu: Rename, Pin, Duplicate, Delete

**TC-NOTE-012**: 3-dot menu on note  
- Action: Hover note, click three-dot button  
- Expected: Same context menu as right-click

**TC-NOTE-013**: Duplicate note  
- Expected: New note with title "X (copy)" and same content in same workspace

**TC-NOTE-014**: Auto-save after 2s idle  
- Action: Edit note, wait 2 seconds  
- Expected: Note auto-saved

**TC-NOTE-015**: Note search  
- Action: Type in search box  
- Expected: List filters in real-time by title (case-insensitive)

---

### 4.4 Workspace Management

**TC-WS-001**: Create workspace as admin  
- Action: POST /api/workspaces { name }  
- Expected: 201, slug auto-generated, creator added as owner

**TC-WS-002**: Create workspace as user  
- Expected: 403

**TC-WS-003**: super_admin sees all workspaces  
- Action: GET /api/workspaces as super_admin  
- Expected: All workspaces returned

**TC-WS-004**: user sees only assigned workspaces  
- Expected: Only their assigned workspaces

**TC-WS-005**: Workspace sidebar expansion  
- Action: Login, click Workspace nav item  
- Expected: Sub-list shows only accessible workspaces

**TC-WS-006**: Delete workspace as super_admin  
- Action: DELETE /api/workspaces/{id}  
- Expected: 200, soft-deleted

**TC-WS-007**: Delete workspace as admin  
- Expected: 403

**TC-WS-008**: Add member to workspace  
- Action: POST /api/workspaces/{id}/members { userId, role }  
- Expected: 200, member added

**TC-WS-009**: Duplicate workspace name  
- Expected: Unique slugs auto-generated

**TC-WS-010**: Navigate to workspace via URL with ws param  
- Action: Open /workspace?ws={id}  
- Expected: Correct workspace loaded

**TC-WS-011**: Workspace access blocked via URL manipulation  
- Precondition: User not in workspace  
- Action: Open /workspace?ws=other_workspace_id  
- Expected: API returns 0 results (filtered)

---

### 4.5 User Management

**TC-USR-001**: Create user as admin  
- Expected: 201, user created, assigned to General

**TC-USR-002**: Create user with invalid email  
- Expected: 400

**TC-USR-003**: Duplicate email  
- Expected: 409

**TC-USR-004**: Delete user as super_admin  
- Expected: 200, soft-deleted

**TC-USR-005**: Delete user as admin  
- Expected: 403

**TC-USR-006**: Delete self  
- Expected: 400 "Cannot delete yourself"

**TC-USR-007**: Users tab hidden from user role  
- Expected: No Users tab in Settings

**TC-USR-008**: Users tab visible for admin  
- Expected: Tab shows, list loads

---

### 4.6 Tasks CRUD

**TC-TASK-001**: Create task as admin  
- Expected: 201, status = "todo"

**TC-TASK-002**: Create task as user  
- Expected: 403

**TC-TASK-003**: Update task status to done  
- Action: PATCH { status: "done" }  
- Expected: Updated correctly

**TC-TASK-004**: Tasks scoped to workspace  
- Expected: Only tasks for requested workspace_id

**TC-TASK-005**: Tasks page inaccessible to user role  
- Expected: Not shown in nav, 403 on direct API call

**TC-TASK-006**: Delete task  
- Expected: Soft-deleted, disappears from list

**TC-TASK-007**: Missing workspace_id  
- Expected: 400

**TC-TASK-008**: Right-click context menu (or 3-dot icon)  
- Action: Right-click task or click 3-dot menu
- Expected: Context menu to Edit, Delete, or change status

---

### 4.7 Calendar Events CRUD

**TC-CAL-001**: Create event as admin  
- Expected: 201

**TC-CAL-002**: Create event as user  
- Expected: 403

**TC-CAL-003**: Event end_time before start_time  
- Expected: 400 or document behavior

**TC-CAL-004**: Events scoped to workspace  
- Expected: Only events for that workspace_id

**TC-CAL-005**: Calendar page inaccessible to user  
- Expected: Not in nav, 403 on direct URL

**TC-CAL-006**: Right-click context menu (or 3-dot icon)  
- Action: Right-click event or click 3-dot menu
- Expected: Context menu to Edit, Delete event

---

### 4.8 Settings Page

**TC-SET-001**: Profile tab shows real user data  
- Expected: Display name and email match, role badge shown

**TC-SET-002**: Theme switcher changes theme immediately  
- Expected: Page theme changes, persisted to localStorage

**TC-SET-003**: Theme persists after page reload  
- Expected: Correct theme on load (no flash)

**TC-SET-004**: Workspaces tab visible to admin  
- Expected: Tab visible, workspace list loads

**TC-SET-005**: Create workspace from settings UI  
- Expected: Workspace created, appears in list

**TC-SET-006**: Workspaces tab hidden from user  
- Expected: No Workspaces or Users tabs

**TC-SET-007**: ?tab= query parameter pre-selects tab  
- Action: /settings?tab=users  
- Expected: Users tab is active

**TC-SET-008**: API Key Generation  
- Action: Admin goes to API Keys setting, clicks Generate  
- Expected: API Key is created and displayed once

**TC-SET-009**: API Key Revocation  
- Action: Admin deletes API key  
- Expected: Key is revoked, subsequent API calls with it fail (401)

**TC-SET-010**: API Key Usage Logging  
- Action: View API Key usage in Settings  
- Expected: Log shows endpoints accessed with API keys for security tracking

---

### 4.9 Markdown Editor (Typora-style)

**TC-MD-001**: Click to edit a line  
- Expected: Line switches to raw text input

**TC-MD-002**: Blur returns to preview  
- Expected: Line renders as HTML

**TC-MD-003**: Heading rendering  
- Action: Line = "# Hello World"  
- Expected: Preview shows H1 styling

**TC-MD-004**: Bold/Italic rendering  
- Action: "**bold** and *italic*"  
- Expected: Styled preview

**TC-MD-005**: Enter creates new line  
- Expected: New blank line, cursor moves there

**TC-MD-006**: Backspace at line start merges lines  
- Expected: Content merged into previous line

**TC-MD-007**: Arrow key navigation between lines  
- Expected: Focus moves between lines

**TC-MD-008**: List continuation with Enter  
- Action: "- Item" then Enter  
- Expected: Next line starts with "- "

**TC-MD-009**: Task checkbox rendering  
- Action: "- [x] Done"  
- Expected: Checked checkbox in preview

**TC-MD-010**: Click on empty space below lines  
- Expected: Last line gets focus

---

### 4.10 Navigation & UI

**TC-NAV-001**: Sidebar workspace expansion toggle  
- Expected: Workspace sub-list expands/collapses

**TC-NAV-002**: Active workspace highlighted  
- Action: Open /workspace?ws={id}  
- Expected: That workspace highlighted in sub-list

**TC-NAV-003**: Profile dropdown opens/closes  
- Expected: Dropdown shows Theme + Settings + Sign out

**TC-NAV-004**: Profile dropdown closes on outside click  
- Expected: Dropdown closes

**TC-NAV-005**: Tasks/Calendar hidden in nav for user role  
- Expected: Items not visible in sidebar nav

**TC-NAV-006**: Manage Workspaces link visible for admin+  
- Expected: Link at bottom of workspace sub-list

**TC-NAV-007**: Mobile hamburger menu  
- Action: Viewport < 768px, click hamburger  
- Expected: Sidebar slides in, overlay appears

**TC-NAV-008**: Workspace sub-list auto-expands on /workspace route  
- Expected: Automatically expanded

**TC-NAV-009**: Right-click context menu for workspaces  
- Action: Right-click workspace in sidebar or click 3-dot menu 
- Expected: Context menu to Edit, Delete workspace

---

### 4.11 Real-Time Synchronization (WebSockets)

**TC-RT-001**: Notes real-time update  
- Action: Open note in Browser A and Browser B. Edit in Browser A.  
- Expected: Browser B sees the updated content without refresh.

**TC-RT-002**: Tasks and Calendar real-time update  
- Action: Change task status or create event in one session.  
- Expected: Visible immediately in other active sessions.

---

## 5. Security & Edge Case Testing

### 5.1 RBAC Bypass Attempts

| ID | Scenario | Expected |
|----|----------|---------|
| SEC-001 | GET /api/tasks as user | 403 |
| SEC-002 | POST /api/workspaces as user | 403 |
| SEC-003 | DELETE /api/workspaces/{id} as admin | 403 |
| SEC-004 | DELETE /api/users/{id} as admin | 403 |
| SEC-005 | GET /api/users as user | 403 |
| SEC-006 | GET notes from another workspace via ?workspace_id= | 0 results (filtered) |
| SEC-007 | Forge role=super_admin in request body | Ignored, server reads from session |
| SEC-008 | /settings?tab=users as user | Tab not rendered, API 403 |

### 5.2 Input Validation

| ID | Input | Expected |
|----|-------|---------|
| VAL-001 | XSS in note title: script alert | Escaped, not executed |
| VAL-002 | SQL injection in search | No crash, no data loss |
| VAL-003 | Note title > 1000 chars | Truncated or 400 |
| VAL-004 | Empty note title | Defaults to "Untitled" or 400 |
| VAL-005 | Note content > 500KB | 413 or graceful error |
| VAL-006 | Invalid UUID in route | 404 or 400 |
| VAL-007 | Malformed JSON body | 400 |

### 5.3 Session Security

| ID | Scenario | Expected |
|----|----------|---------|
| SESS-001 | Modify qa_session cookie value | 401 |
| SESS-002 | Copy cookie to different browser | Works (stateless) |
| SESS-003 | Session after 30 days | Expired, redirect to login |
| SESS-004 | Concurrent sessions (two browsers) | Both work |

---

## 6. Database State Verification

After CREATE operations, verify:
- deleted_at IS NULL
- Correct workspace_id set
- created_by = authenticated user ID
- Timestamps are server-set

After DELETE (soft), verify:
- deleted_at IS NOT NULL
- Record still exists in table
- GET endpoints exclude soft-deleted records

---

## 7. Test Environment Setup

### 7.1 Test Users

```
superadmin@test.com / Test1234! — role: super_admin
admin@test.com      / Test1234! — role: admin
user@test.com       / Test1234! — role: user
```

### 7.2 Test Workspaces

```
General  (default, all users assigned)
Research (admin only)
Private  (empty, no members)
```

---

## 8. Regression Checklist

Run after every deployment:

- [ ] /api/auth/setup health check correct
- [ ] Login works for all three roles
- [ ] Workspace list filters correctly per role
- [ ] Notes scoped to workspace (no cross-reads)
- [ ] Tasks/Calendar blocked for user role
- [ ] Context menu on notes, tasks, events, and workspaces (right-click + 3-dot)
- [ ] Theme picker changes and persists after reload
- [ ] Settings tabs correct per role
- [ ] Profile dropdown opens and closes
- [ ] Markdown preview renders headings, bold, code
- [ ] Auto-save fires after 2 seconds
- [ ] Pinned notes at top of list
- [ ] Workspace sub-list auto-expands on /workspace
- [ ] API keys can be generated and revoked (Admin+)
- [ ] API key usage is correctly logged in Settings
- [ ] WebSockets sync notes, tasks, and calendar in real-time
- [ ] UI loads without Runtime ReferenceError Note is not defined

---

## 9. Known Limitations (Current Version)

| Feature | Status |
|---------|--------|
| Password change | UI stub only |
| File attachments | Not planned |

---

## 10. Automation Selectors

| Element | Selector |
|---------|---------|
| Login email input | input[type="email"] |
| Login password input | input[type="password"] |
| Login submit | button[type="submit"] |
| Sidebar toggle | #sidebar-toggle |
| Global search | #global-search |
| New Note button | #topbar-new-btn |
| Profile menu | #profile-menu-btn |
| Theme light | #theme-light |
| Theme dark | #theme-dark |
| Theme sepia | #theme-sepia |
| Logout | #logout-btn |
