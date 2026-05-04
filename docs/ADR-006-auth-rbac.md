# ADR-006: Auth + RBAC

**Status:** Accepted  
**Date:** 2026-05-04

## Decision

Magic link (email-based, no passwords) + JWT sessions. API keys are workspace-scoped with role.

Roles: owner > editor > viewer

## Non-goals

- No OAuth at this stage (can add Google/GitHub OAuth later as provider)
- No SSO/SAML
- No fine-grained resource-level permissions (only workspace-level)
