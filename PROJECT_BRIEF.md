# Project Brief: Secure Marketplace Web Application

**Module:** 6000CMD / 6005CEM: Security  
**Assignment:** CW2: Secure Application Development and Implementation  
**Repository:** [6000CMD_GrpProject-cw2](https://github.com/Frostbrewn/6000CMD_GrpProject-cw2)  
**Project Type:** Group Project (2 members)  
**Development Status:** Initial Planning

## 1. Project Overview

The project involves designing and developing a basic marketplace web application as part of the CW2 Secure Application Development and Implementation assignment.

The application will allow users to browse marketplace listings, register and authenticate accounts, and create and manage their own advertisements. An administrator will have additional privileges to manage users and listings and access security-related activity records and analytics.

The application is independently developed and uses common marketplace functionality found in platforms such as Mudah.my and Shopee as its conceptual reference. It is not intended to reproduce either platform.

The primary objective is to demonstrate how security controls can be incorporated into the design and implementation of a functional web application.

## 2. Application Scope

### 2.1 User Roles

The application will support three access levels:

| Role | Permissions |
|---|---|
| Visitor | Browse marketplace listings and access registration and login pages. |
| Member | Create, view, update and delete their own listings; manage their account. |
| Administrator | Manage users and marketplace listings; access administrative functions, audit logs and system analytics. |

A registered member may act as either a buyer or seller. Separate buyer and seller account types are not required for the initial implementation.

### 2.2 Core Functional Requirements

The application will provide:

1. User registration and login.
2. Public marketplace listing browsing.
3. Creation and management of member-owned listings.
4. Access restrictions based on user roles and resource ownership.
5. An administrator interface for managing users and listings.
6. A dashboard presenting relevant activity logs and analytics, restricted to authorized administrators.

Payment processing, order fulfillment and real-time messaging are outside the initial project scope.

## 3. Security Requirements

Security will be incorporated into the application's backend and, where appropriate, its hosting configuration.

| Security Area | Planned Implementation |
|---|---|
| Authentication | Secure registration and login, with passwords stored using an appropriate password-hashing algorithm. |
| Authorization | Server-side Role-Based Access Control (RBAC) and resource-ownership checks following the Principle of Least Privilege. |
| Input Validation | Validate incoming data and reject unexpected or invalid input. |
| Injection Prevention | Use controlled database queries and prevent user input from being interpreted as database query operators. |
| Output Encoding | Encode or safely render user-generated content to reduce cross-site scripting (XSS) risks. |
| Error Handling | Provide general user-facing errors without exposing stack traces, credentials or internal implementation details. |
| Session Security | Apply appropriate session expiration, invalidation and secure cookie attributes. |
| Secure Communication | Use HTTPS/TLS for deployed application traffic and appropriate certificate validation. |
| Data Protection | Minimise collected personal information, protect sensitive data and provide a privacy notice and basic user security guidance. |
| Security Logging | Record relevant security and account activity without storing passwords, tokens or other unnecessary sensitive information. |
| Analytics Access | Restrict security logs and administrative analytics to authorized users. |
| Additional Controls | Consider login rate limiting, CSRF protection and security response headers according to the application's architecture. |

The implementation will be evaluated through manual and automated security testing aligned with the relevant OWASP Top 10 risks.

## 4. Technology Stack

The following technology stack has been agreed upon by both team members and will be used for the application development.

| Component | Technology |
|---|---|
| Backend runtime | Node.js |
| Backend framework | Express.js |
| Programming language | JavaScript |
| Frontend | HTML, CSS and JavaScript |
| UI framework | Bootstrap |
| Database | MongoDB |
| Database modelling | Mongoose |
| Database management interface | MongoDB Compass |
| Version control | Git and GitHub |

MongoDB Compass will be used to inspect and manage the database; it is not itself the database server.

The application will use a separated frontend/backend structure, communicating through HTTP API endpoints.

## 5. Team Responsibilities

### Developer A — Backend and Security

Responsible for:

- Backend project structure and Express configuration.
- MongoDB connection and data access.
- Registration, authentication and session management.
- Password hashing.
- RBAC and server-side authorization.
- Input validation and injection prevention.
- Error handling and secure application configuration.
- Audit logging and analytics data.
- Backend security testing and vulnerability remediation.

### Developer B — Frontend

Responsible for:

- Frontend project structure and interface design.
- Registration and login interfaces.
- Marketplace browsing and listing interfaces.
- Member dashboard and listing-management interface.
- Administrator dashboard and analytics presentation.
- Frontend validation and safe rendering of user-generated content.
- Integration with backend API endpoints.

### Shared Responsibilities

Both developers will:

- Agree on application requirements and API contracts.
- Review and integrate each other's contributions.
- Test the complete application and different user roles.
- Conduct security and vulnerability testing.
- Collect implementation screenshots and test evidence.
- Contribute to the CW2 technical report.

## 6. Development and Collaboration

The GitHub repository is the central source of truth for the application.

- Both developers will contribute through their own Git branches.
- Changes should be committed with meaningful messages.
- Significant changes should be reviewed before merging into `main`.
- API endpoints and their request/response formats should be documented before frontend integration.
- Shared project documentation must be updated when agreed requirements or implementation decisions change.
- No passwords, database credentials, API keys, session tokens, private keys or real user data should be committed to the public repository.
- Environment-specific configuration should be stored in local environment files excluded through `.gitignore`.

## 7. Security Assessment and Testing

The completed application will undergo security testing covering relevant areas such as:

- Authentication and password handling.
- Role-based authorization and resource ownership.
- Input validation and injection resistance.
- Cross-site scripting and output encoding.
- Session management and CSRF protection, where applicable.
- HTTP security configuration and secure communication.
- Error handling and sensitive information exposure.
- Security logging and restricted dashboard access.

Testing will combine manual test cases with appropriate automated security tools. Findings, evidence, outcomes and any remediation will be documented in the final report.

Testing must be performed against the team's own application and authorized test accounts.

## 8. Project Deliverables

The group will produce:

1. A functional marketplace web application.
2. Implemented application-level and relevant host/network-level security controls.
3. Manual and automated security testing evidence.
4. A technical report of approximately 4,000 words, within the permitted ±20% range.

The report will explain the application design, security implementation choices, technical justifications, testing procedures, results and remaining limitations.

## 9. Project Scope Principle

The project will prioritize a functional application with demonstrable security controls over unnecessary marketplace features.

Features will be added only when they support the assignment requirements or are necessary for the application's operation. Security claims in the report must be supported by actual implementation and testing evidence.
