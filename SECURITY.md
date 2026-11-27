# JobsitePro — Security model

## Isolation by company

Every business record is scoped to a `companies` row via a `company` relation (or `id = @request.auth.company` for the company itself).

- Authenticated users only see data for **their** company.
- API rules that check `@request.auth.role = "admin"` also require `company = @request.auth.company` (create/update/delete).
- `companies.listRule` / `viewRule` are limited to `id = @request.auth.company` (an admin of A cannot list company B).
- Company-wide `listRule` / `viewRule` also require `@request.auth.is_active = true` (pending invite accounts cannot browse company data).
- Employee `createRule` on operational collections require `@request.body.company = @request.auth.company` (PocketBase 0.23+; on 0.22 use `@request.data.company`) and `is_active = true`.

## Roles

Two layers:

| Layer | Field | Values |
|-------|--------|--------|
| PocketBase gate | `users.role` | `admin` (dashboard / management) or `employe` (mobile PWA) |
| RBAC métier | `users.rbac_role` | `admin_patron`, `gestionnaire`, `comptable`, `contremaitre`, `securite_sst`, `employe`, `lecture_seule` |

`comptable` maps to PB `role = "admin"`, so payroll list/view rules that allow company-wide access for `@request.auth.role = "admin"` also cover accountants.

### Server hooks (JSVM isolation)

Helpers live in **`pb_hooks/lib/security.js`** (CommonJS). Each handler does:

```js
var sec = require(__hooks + '/lib/security.js');
```

Handlers are registered **inline** (no top-level function shared across isolates).

| File | Role |
|------|------|
| `pb_hooks/lib/security.js` | `dao()`, `authUser`, `isSuperuser`, `companyUserCount` (fail-closed), RBAC helpers |
| `pb_hooks/users_create_guard.pb.js` | Anti privilege-escalation at signup; public join → `is_active = false` |
| `pb_hooks/rbac_guard.pb.js` | Expense approve; block self-change of `role` / `rbac_role`; lock `company` |

`companyUserCount` **never returns 0 on error** — it throws so a DB failure cannot create a first-admin path.

`dao()` returns `$app.dao()` on PocketBase 0.22, otherwise `$app` (0.23+).

## Who sees what (sensitive data)

| Collection | Employee (active) | Admin / comptable (same company, active) | Inactive user |
|------------|-------------------|------------------------------------------|---------------|
| `pay_stubs`, `payroll_documents`, … | Own rows | Company rows | Own rows only (if any) |
| `sites`, `safety_documents`, CRM… | Company (if active) | Company | **None** (no company list) |
| `expenses`, `leave_requests` | Own; create own | List/approve company-wide | Own only |

Signup flows:

1. **Patron** creates a company, then the first user → `role` admin, `is_active = true`.
2. **Employee invite** (public POST on an existing company) → forced `role`/`rbac_role` = `employe`, **`is_active = false`**. Patron activates from the Employees page (**Activer**).
3. **Patron dashboard** creates a user while authenticated → same company only; can set `is_active: true` immediately.

## XSS

Shared helpers: `shared/escape-html.js` (`escapeHtml`, `escapeAttr`). Loaded by patron/employé PWAs; modules delegate to it.

## Applying rules on an existing PocketBase instance

Source of truth: **`pocketbase/jobsitepro-final-import.json`**.

### Option A — Admin UI (safest for production)

1. Open PocketBase Admin → Collections.
2. Apply rules from `pocketbase/_security-rules-diff.json` and `pocketbase/_is-active-rules-diff.json` (especially `is_active` on list/view).
3. Copy hooks **including the lib folder**:
   - `pocketbase/pb_hooks/lib/security.js`
   - `pocketbase/pb_hooks/users_create_guard.pb.js`
   - `pocketbase/pb_hooks/rbac_guard.pb.js`
   into the live hooks dir (e.g. `pb_data/pb_hooks/`).
4. Restart PocketBase so hooks reload.
5. Run `deployment/test-security.sh` on staging first.

### Option B — Schema import

1. Backup `pb_data`.
2. Import `jobsitepro-final-import.json`.
3. Deploy hooks + `lib/` + restart.
4. Run `deployment/test-security.sh`.

### Hook API note

- 0.22: `onRecordBeforeCreateRequest` / `onRecordBeforeUpdateRequest` + `e.httpContext.get('authRecord')`
- 0.23+: `onRecordCreateRequest` / `onRecordUpdateRequest` + `e.auth` + `e.next()`

Superuser operations skip the signup/role guards.

## Verification

```bash
export PB_URL="https://api.example.com"
export PB_ADMIN_EMAIL="admin@example.com"
export PB_ADMIN_PASSWORD="..."
bash deployment/test-security.sh
```

Checks include: signup role downgrade + `is_active=false`, pay stub peer isolation, cross-company PATCH denial, self role change denial, **inactive employee cannot list company sites**.
