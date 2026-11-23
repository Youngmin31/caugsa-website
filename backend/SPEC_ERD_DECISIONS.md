# API specification / ERD implementation decisions

This file records points that were missing, inconsistent, or ambiguous in the
2026-08 API specification and ERD. Please confirm these decisions before a
production migration.

## Decisions applied

1. **Canonical and legacy endpoint paths**
   - The endpoint index defines `/api/posts` and `/api/posts/{id}` as the new
     post API, while individual examples still use `/api/dbtest`,
     `/api/detail_board`, `/api/create_board`, `/api/update_board`, and
     `/api/delete_board`.
   - The REST paths are implemented as canonical paths. The old paths remain as
     aliases so the current frontend does not break immediately.

2. **ERD `id2` columns**
   - `Event.id2`, `Post.id2`, and `Attachment.id2` are interpreted as foreign
     keys to `Menu.id` and are named `menu_id` in SQL.

3. **`Board.organization` type**
   - The ERD displays it as `VARCHAR`, but also draws a relationship to
     `Organization.id` (`INT`). It is implemented as nullable
     `organization_id INT UNSIGNED`.

4. **Profile fields missing from the ERD**
   - The profile APIs require `zipCode`, `address1`, and `address2`, but the ERD
     omits them. `User.zip_code`, `User.address1`, and `User.address2` were added.

5. **Notice state missing from the ERD**
   - The post-list response requires `isNotice`. `Post.is_notice` was added and
     defaults to `FALSE`.

6. **Attachment storage name missing from the ERD**
   - Keeping only an original filename causes collisions and path-traversal
     risk. `Attachment.name` stores the original client filename, while the
     additional `Attachment.stored_name` stores a generated server filename.

7. **Calendar API fields versus `Event` fields**
   - The API uses `event_date` and `content`; the ERD uses `start_date` and
     `name`. They are mapped as follows:
     - `event_date` -> `Event.start_date`
     - `content` -> `Event.name`
   - A standalone calendar item defaults `end_date` to `start_date`.

8. **Post participation/event fields**
   - For post creation and update, `isparticipate=true` creates or updates a
     related `Event`.
   - `event_date` maps to `start_date`; `form_date` maps to `apply_date`;
     `end_date` is accepted as an optional extension and defaults to
     `event_date`; the post title becomes the event name.

9. **Nullable event relationships**
   - `Event.organization_id`, `Event.post_id`, and `Event.menu_id` are nullable
     because `/api/events` can create a standalone calendar entry without a
     post, board, or organization in its request.

10. **Comments/replies**
    - The API example contains `reply`, but the new ERD has no reply/comment
      entity. The legacy `Reply` table is not recreated. Post detail returns an
      empty `reply` array for response compatibility.

11. **User roles and approval**
    - Legacy `intGubun` and `intCertify` are replaced with `role` (`admin` or
      `user`) and `is_approved` (`BOOLEAN`). JWTs still include a legacy-shaped
      `user_info` claim temporarily for client compatibility.

12. **Password storage**
    - New and changed passwords are hashed with Werkzeug.
    - Login verifies against the stored hash only. A stored value that is not a
      `scrypt:`/`pbkdf2:` hash never authenticates.
    - The earlier plaintext-comparison fallback was **removed**. It made the
      stored value itself a working password, so any account holding a
      non-hash sentinel (for example `!`) could be signed into by submitting
      that same string. Legacy rows must be re-hashed or left unusable rather
      than compared in plaintext.

13. **Logout and email verification persistence**
    - The ERD has no token-revocation or email-verification table. Revoked JWT
      IDs and email codes are therefore held in process memory and disappear on
      server restart. Production should use Redis or dedicated DB tables.

14. **HTTP status codes**
    - Many specification status tables are blank and old handlers returned
      HTTP 200 for failures. The implementation uses 400/401/403/404/409/500 as
      appropriate and 201 for successful creation.

15. **Reference rows and `Board.is_event`**
    - `Menu`, `Organization`, and `Board` reference rows are seeded by
      `schema.sql` so API board slugs resolve immediately.
    - Only the `activity` board is currently marked `is_event=TRUE`. The exact
      list of event boards was not specified and needs confirmation.

## Migration items requiring confirmation

- `schema.sql` is a clean rebuild script: it drops both new and legacy tables.
  It has **not** been executed against the local database by this change.
- Existing rows in `mTb_Member2`, `BOARD_v1`, `Reply`, and `calendar_events`
  need a separate data-migration script before this schema is used on a
  database whose data must be retained.
- `db/seeds/local_dummy_data.sql` still targets the legacy schema and must not
  be run after the new `schema.sql`. It was intentionally left unchanged
  because the request named only `schema.sql` and `app.py` and because desired
  test identities/passwords were not specified for the new model.
- The intended uniqueness policy for primary email, backup email, and mobile
  number is not stated. Only `login_id` and non-null `student_id` are unique.
- The ERD does not define whether deleting a user should delete authored posts.
  The implementation uses `ON DELETE RESTRICT` to avoid accidental content
  loss.
- The API specification does not define whether replacing a post attachment
  should append to or replace existing attachments. Uploading files during
  update currently replaces all attachments; omitting files preserves them.
- The email verification specification returns `status`, while the current
  signup frontend checks `response.data.result`. The backend follows the
  specification, so the frontend check must be changed to `status` before that
  flow works end to end.
- The current frontend validates passwords as 4-12 alphanumeric characters,
  while profile update in the new backend requires at least 8 characters. A
  single password policy should be confirmed and shared by both layers.
