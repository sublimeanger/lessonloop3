# LessonLoop System Audit Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2026-01-20  
> **Classification**: Internal / Auditor Use

---

## Overview

LessonLoop is a UK-centric music lesson scheduling, invoicing, and portal management platform designed for solo teachers, studios, academies, and agencies. This documentation suite provides complete technical visibility into the system architecture, security model, data flows, and compliance measures.

---

## Document Index

| Document | Purpose | Audience |
|----------|---------|----------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | High-level architecture and technology stack | All auditors |
| [DATA_MODEL.md](./DATA_MODEL.md) | Complete database schema and relationships | Database auditors |
| [SECURITY_MODEL.md](./SECURITY_MODEL.md) | Authentication, authorization, and RLS policies | Security auditors |
| [API_REFERENCE.md](./API_REFERENCE.md) | Edge functions and API endpoints | API auditors |
| [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) | Audit trail implementation | Compliance auditors |
| [GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md) | Data protection and privacy measures | Privacy auditors |
| [AI_SUBSYSTEM.md](./AI_SUBSYSTEM.md) | LoopAssist AI copilot architecture | AI/ML auditors |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | UI structure and navigation | Frontend auditors |
| [PERFORMANCE.md](./PERFORMANCE.md) | Optimization and indexing strategy | Performance auditors |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Infrastructure and environment configuration | DevOps auditors |

---

## Quick Facts

| Metric | Value |
|--------|-------|
| **Database Tables** | 26 |
| **RLS Policies** | 90+ |
| **Database Indexes** | 30+ |
| **Edge Functions** | 8 |
| **Frontend Routes** | 20+ |
| **User Roles** | 5 (owner, admin, teacher, finance, parent) |
| **Primary Currency** | GBP |
| **Primary Timezone** | Europe/London |
| **Date Format** | DD/MM/YYYY |

---

## System Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React 18 + TypeScript]
        Router[React Router v6]
        Query[TanStack Query]
    end
    
    subgraph "Context Layer"
        Auth[AuthContext]
        Org[OrgContext]
        AI[LoopAssistContext]
    end
    
    subgraph "Edge Functions"
        Chat[looopassist-chat]
        Exec[looopassist-execute]
        Import[csv-import-*]
        GDPR[gdpr-*]
        Msg[send-*]
    end
    
    subgraph "Database Layer"
        PG[(PostgreSQL)]
        RLS[Row-Level Security]
        Triggers[Audit Triggers]
        Functions[DB Functions]
    end
    
    subgraph "External Services"
        Resend[Resend Email]
        LovableAI[Lovable AI Models]
    end
    
    UI --> Router
    Router --> Query
    Query --> Auth
    Query --> Org
    Query --> AI
    
    Auth --> Chat
    Auth --> Exec
    Auth --> Import
    Auth --> GDPR
    Auth --> Msg
    
    Chat --> LovableAI
    Exec --> PG
    Import --> PG
    GDPR --> PG
    Msg --> Resend
    
    PG --> RLS
    PG --> Triggers
    PG --> Functions
```

---

## Key Contacts

| Role | Responsibility |
|------|----------------|
| Platform Owner | Overall system governance |
| Security Lead | RLS policies and access control |
| Data Protection Officer | GDPR compliance |
| DevOps Lead | Infrastructure and deployment |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-20 | System | Initial documentation |

---

## Navigation

→ Start with [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) for executive summary  
→ Continue to [SECURITY_MODEL.md](./SECURITY_MODEL.md) for access control details  
→ Review [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for compliance trail
