# API Contract — Secure Marketplace Web Application

**Project:** 6000CMD / 6005CEM: CW2  
**Repository:** [6000CMD_GrpProject-cw2](https://github.com/Frostbrewn/6000CMD_GrpProject-cw2)  
**Version:** 1.0 (Proposed)  
**Status:** Pending team review

## 1. Purpose

This document defines the communication contract between the marketplace frontend and backend. It specifies the API endpoints, expected request and response formats, access permissions and security requirements.

The frontend developer should use this document when implementing the user interface and connecting it to the backend. The backend developer should follow the same definitions when implementing the API.

Changes to endpoint paths, field names or response formats should be agreed upon and documented before implementation changes are made.

## 2. API Conventions

| Item | Specification |
|---|---|
| API base path | `/api` |
| Data format | JSON |
| Request content type | `application/json` |
| Response content type | `application/json` |
| Authentication | Server-side session using an HTTP cookie |
| Identifier | MongoDB ObjectId represented as a string |
| Date and time | ISO 8601 format |
| Pagination | Page-based pagination |

The frontend and backend should use the same origin in the integrated application. The Express application can serve the frontend's static files, allowing the browser to communicate with the API without requiring broad cross-origin access.

## 3. User Roles and Access Permissions

The application will support the following access levels:

| Function | Visitor | Member | Administrator |
|---|:---:|:---:|:---:|
| Browse active listings | Yes | Yes | Yes |
| View individual active listings | Yes | Yes | Yes |
| Register and log in | Yes | Yes | Yes |
| Create a listing | No | Yes | Yes |
| View own listings | No | Yes | Yes |
| Update own listings | No | Yes | Yes |
| Remove own listings | No | Yes | Yes |
| View all users | No | No | Yes |
| Enable or disable member accounts | No | No | Yes |
| View all listings, including removed listings | No | No | Yes |
| Moderate listing status | No | No | Yes |
| View audit logs and analytics | No | No | Yes |

All authorization decisions must be enforced by the backend. Hiding a button or page in the frontend is not sufficient to protect an API endpoint.

New registrations will always receive the `member` role. Users must not be allowed to assign themselves administrator privileges through registration or profile requests. The initial administrator account will be provisioned through a controlled server-side process.

## 4. Standard Response Format

Successful responses will use a `data` property.

**Example — successful operation:**

```json
{
  "data": {
    "message": "Operation completed successfully."
  }
}
```

**Example — collection response:**

```json
{
  "data": [
    {
      "id": "65f123456789abcdef123456",
      "title": "Second-hand Laptop",
      "price": 1200
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

Errors will use a consistent structure.

**Example — validation error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information."
  }
}
```

The backend must not return stack traces, database errors, password hashes, session identifiers or other internal implementation details to the frontend.

## 5. Authentication Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/csrf-token` | Public | Obtain a CSRF token for subsequent state-changing requests. |
| POST | `/api/auth/register` | Visitor | Register a new member account. |
| POST | `/api/auth/login` | Visitor | Authenticate a user and establish a session. |
| POST | `/api/auth/logout` | Authenticated | End the current session. |
| GET | `/api/auth/me` | Authenticated | Retrieve the currently authenticated user's information. |

### 5.1 Registration

**Request: `POST /api/auth/register`**

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "ExamplePassword123!"
}
```

The `role` field must not be accepted from the registration request. The backend assigns the `member` role automatically.

**Successful response: HTTP 201**

```json
{
  "data": {
    "message": "Account registered successfully."
  }
}
```

### 5.2 Login

**Request: `POST /api/auth/login`**

```json
{
  "email": "user@example.com",
  "password": "ExamplePassword123!"
}
```

**Successful response: HTTP 200**

```json
{
  "data": {
    "user": {
      "id": "65f123456789abcdef123456",
      "name": "Example User",
      "email": "user@example.com",
      "role": "member"
    }
  }
}
```

A successful login also establishes a session through an HTTP cookie. The session identifier must not be included in the JSON response.

Invalid credentials should return a generic message that does not disclose whether a particular email address is registered.

### 5.3 Logout

**Request: `POST /api/auth/logout`**

The backend destroys the current session and clears the session cookie.

**Successful response: HTTP 200**

```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```

### 5.4 Current User

**Request: `GET /api/auth/me`**

**Successful response: HTTP 200**

```json
{
  "data": {
    "user": {
      "id": "65f123456789abcdef123456",
      "name": "Example User",
      "email": "user@example.com",
      "role": "member"
    }
  }
}
```

Unauthenticated requests return HTTP 401.

## 6. Marketplace Listing Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/listings` | Public | Retrieve active marketplace listings. |
| GET | `/api/listings/:listingId` | Public | Retrieve one active listing. |
| POST | `/api/listings` | Member, Administrator | Create a listing. |
| GET | `/api/my/listings` | Member, Administrator | Retrieve the authenticated member's own listings. |
| PATCH | `/api/listings/:listingId` | Listing owner | Update an owned listing. |
| DELETE | `/api/listings/:listingId` | Listing owner | Remove an owned listing. |

### 6.1 Listing Fields

The minimum listing information will be:

| Field | Data type | Requirement |
|---|---|---|
| `title` | String | Required; maximum 80 characters. |
| `description` | String | Required; maximum 1,000 characters. |
| `category` | String | Required; must match an accepted category. |
| `price` | Number | Required; must be a finite, non-negative value. |
| `ownerId` | String | Assigned by the backend using the authenticated user's ID. |
| `status` | String | Assigned by the backend; initially `active`. |
| `createdAt` | Date | Generated by the backend. |
| `updatedAt` | Date | Updated by the backend. |

Initial accepted categories:

- Electronics
- Fashion
- Home
- Books
- Other

The client must not be allowed to supply or override `ownerId`, `status` or server-generated timestamps.

### 6.2 Create Listing

**Request: `POST /api/listings`**

```json
{
  "title": "Second-hand Laptop",
  "description": "Laptop in good working condition.",
  "category": "Electronics",
  "price": 1200
}
```

The backend assigns the authenticated user as the listing owner and sets the initial status to `active`.

### 6.3 Update Listing

**Request: `PATCH /api/listings/:listingId`**

```json
{
  "title": "Updated Laptop Listing",
  "price": 1100
}
```

Only the listing owner may update the listing's content. The backend must verify ownership before applying changes.

### 6.4 Remove Listing

**Request: `DELETE /api/listings/:listingId`**

The backend changes the listing status to `removed` rather than permanently deleting the record. This preserves information needed for administrative review and activity logging.

The public listing endpoints must return active listings only.

## 7. Administrator Endpoints

All endpoints in this section require an authenticated administrator session.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/users` | Retrieve registered users. |
| PATCH | `/api/admin/users/:userId/status` | Enable or disable a member account. |
| GET | `/api/admin/listings` | Retrieve all listings, including removed listings. |
| PATCH | `/api/admin/listings/:listingId/status` | Change a listing's moderation status. |
| GET | `/api/admin/analytics/summary` | Retrieve application activity statistics. |
| GET | `/api/admin/audit-logs` | Retrieve security and account activity logs. |

### 7.1 User Management

**Request: `PATCH /api/admin/users/:userId/status`**

```json
{
  "status": "disabled"
}
```

Accepted values: `active` and `disabled`.

Disabling an account should prevent further authenticated access and invalidate its existing sessions. Administrators must not accidentally disable their own account through this function.

This endpoint does not provide a way to grant administrator privileges.

### 7.2 Listing Moderation

**Request: `PATCH /api/admin/listings/:listingId/status`**

```json
{
  "status": "removed"
}
```

Accepted values: `active` and `removed`.

Only administrators can moderate listing status. Restoring a removed listing is also permitted through this endpoint.

## 8. Logging and Analytics

The backend should record relevant application activities, including:

| Activity | Example event |
|---|---|
| Successful registration | `user_registered` |
| Successful login | `login_success` |
| Failed login | `login_failed` |
| Logout | `logout` |
| Listing creation | `listing_created` |
| Listing update | `listing_updated` |
| Listing removal | `listing_removed` |
| Listing viewed | `listing_viewed` |
| User account status changed | `user_status_changed` |
| Listing moderated | `listing_status_changed` |

Audit records should contain relevant information such as:

- Event timestamp.
- Actor ID, when available.
- Actor role or visitor status.
- Action performed.
- Target resource type and identifier, where applicable.
- Outcome of the operation.

Passwords, password hashes, session identifiers, CSRF tokens and other authentication secrets must never be recorded in application activity logs.

### 8.1 Analytics Summary

**Request: `GET /api/admin/analytics/summary`**

Illustrative response structure:

```json
{
  "data": {
    "totalUsers": 25,
    "activeListings": 40,
    "removedListings": 3,
    "listingViewsToday": 18,
    "actionsToday": 32
  }
}
```

The administrator dashboard will use this endpoint to display basic application statistics.

### 8.2 Audit Logs

**Request: `GET /api/admin/audit-logs?page=1&limit=10`**

The endpoint returns paginated activity records. Only administrators may access this information.

## 9. Security and Error Handling Requirements

The following requirements apply across the API:

1. **Authentication:** Protected endpoints must verify the user's session before processing the request.
2. **Authorization:** The backend must enforce role permissions and resource ownership.
3. **Password handling:** Passwords must be hashed before storage and never returned in API responses.
4. **Session management:** Sessions must be regenerated after successful login and destroyed after logout.
5. **CSRF protection:** State-changing requests must include a valid CSRF token in the `X-CSRF-Token` request header.
6. **Cookie security:** Session cookies must use `HttpOnly`, `SameSite` and appropriate `Secure` attributes.
7. **Input validation:** All incoming data must be validated on the server, including identifiers, numeric values and allowed categories.
8. **Injection prevention:** Database queries must not directly interpret uncontrolled user-supplied query operators.
9. **Output safety:** The frontend must render user-generated content safely rather than treating it as executable HTML.
10. **Rate limiting:** Authentication endpoints should have rate limits to reduce repeated login attempts.
11. **HTTPS:** Deployed application traffic must use HTTPS with valid certificate verification.
12. **Error handling:** Internal errors must be logged securely while users receive general error messages.

### 9.1 Standard HTTP Status Codes

| Status | Meaning | Example |
|---|---|---|
| 200 | OK | Successful login or data retrieval. |
| 201 | Created | Successful registration or listing creation. |
| 400 | Bad Request | Invalid input or validation failure. |
| 401 | Unauthorized | Missing or invalid authentication session. |
| 403 | Forbidden | Authenticated user lacks the required permission or CSRF validation fails. |
| 404 | Not Found | Resource does not exist or is not accessible to the requester. |
| 409 | Conflict | Duplicate email registration or conflicting operation. |
| 429 | Too Many Requests | Rate limit exceeded. |
| 500 | Internal Server Error | Unexpected server-side failure. |

## 10. Items Outside the Initial API Scope

To keep the implementation manageable within the assignment deadline, the first version does not include:

- Payment processing.
- Order and delivery management.
- Real-time messaging or chat.
- Image upload and storage.
- Separate buyer and seller account roles.
- Public administrator registration or user-controlled role assignment.

These features may be considered only after the required marketplace functionality and security controls are operational.

## 11. Change Management

Both developers should refer to this contract when implementing their respective components.

Any changes to endpoint paths, request fields, response formats, access permissions or authentication behaviour must be communicated and reflected in this document.

The API contract describes the intended interface. The final report must distinguish between planned behaviour and functionality that has actually been implemented and tested.
