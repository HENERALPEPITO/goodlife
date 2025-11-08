# 🏗️ System Architecture - Invoice & Catalog Features

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│                         (Next.js + React)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Artist     │  │    Admin     │  │   Enhanced   │          │
│  │  Invoices    │  │  Invoice     │  │   Catalog    │          │
│  │    View      │  │    List      │  │   (Search)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                       │
├───────────────────────────┼───────────────────────────────────┤
│                           │                                       │
│                    ┌──────▼───────┐                             │
│                    │ Supabase JS  │                             │
│                    │   Client     │                             │
│                    └──────┬───────┘                             │
│                           │                                       │
├───────────────────────────┼───────────────────────────────────┤
│                    DATABASE LAYER                                │
│                    (PostgreSQL + RLS)                            │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  invoices   │  │   tracks    │  │  royalties  │            │
│  │   table     │  │   table     │  │    table    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                   │
│  ┌─────────────────────────────────────────────────┐            │
│  │         Row Level Security Policies              │            │
│  │  - Artists see own data only                    │            │
│  │  - Admins see all data                          │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Invoice Creation Flow

```
┌──────────┐
│  Artist  │
└────┬─────┘
     │ 1. Clicks "Request Payment"
     ▼
┌──────────────────────┐
│  ArtistInvoices.tsx  │
└────┬─────────────────┘
     │ 2. Calculates available balance
     │ 3. Shows form
     ▼
┌────────────────┐
│  Artist fills: │
│  - Amount      │
│  - Pay Mode    │
│  - Remarks     │
└────┬───────────┘
     │ 4. Submit
     ▼
┌──────────────────────┐
│   Validation         │
│   amount ≤ balance   │
└────┬─────────────────┘
     │ 5. Valid
     ▼
┌──────────────────────────┐
│  generate_invoice_number()│ ← Database function
└────┬─────────────────────┘
     │ 6. Returns "INV-2025-001"
     ▼
┌──────────────────────┐
│  INSERT into invoices│
│  status = 'pending'  │
└────┬─────────────────┘
     │ 7. Success
     ▼
┌──────────────────────┐
│  Toast notification  │
│  Refresh invoice list│
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│  Admin sees it in    │
│  pending queue       │
└──────────────────────┘
```

### Admin Approval Flow

```
┌──────────┐
│  Admin   │
└────┬─────┘
     │ 1. Opens Invoices page
     ▼
┌──────────────────────┐
│ AdminInvoiceList.tsx │
└────┬─────────────────┘
     │ 2. Loads all invoices
     │    with artist emails
     ▼
┌──────────────────────┐
│  Search/Filter UI    │
│  - By status         │
│  - By artist         │
│  - By invoice #      │
└────┬─────────────────┘
     │ 3. Finds pending invoice
     ▼
┌──────────────────────┐
│  Clicks "Approve" ✓  │
└────┬─────────────────┘
     │ 4. Confirmation dialog
     ▼
┌──────────────────────┐
│  Admin confirms      │
└────┬─────────────────┘
     │ 5. UPDATE invoices
     │    SET status = 'approved'
     ▼
┌──────────────────────┐
│  Status updated      │
│  Artist sees change  │
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│  Later: Mark as Paid │
│  status = 'paid'     │
└──────────────────────┘
```

### Catalog Search Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Types in search bar
     ▼
┌──────────────────────┐
│  onChange event      │
│  setSearchTerm(value)│
└────┬─────────────────┘
     │ 2. State updates
     ▼
┌──────────────────────┐
│  useEffect hook      │
│  watches searchTerm  │
└────┬─────────────────┘
     │ 3. Triggers filterTracks()
     ▼
┌────────────────────────────┐
│  Filter logic:             │
│  - Check title             │
│  - Check ISWC              │
│  - Check composers         │
│  - Check platform          │
│  - Check territory         │
└────┬───────────────────────┘
     │ 4. Matching tracks
     ▼
┌──────────────────────┐
│  setFilteredTracks() │
│  State updates       │
└────┬─────────────────┘
     │ 5. Re-render
     ▼
┌──────────────────────┐
│  Display filtered    │
│  results instantly   │
└──────────────────────┘
```

---

## 🗄️ Database Schema

### invoices Table

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  artist_id UUID → auth.users(id),
  amount NUMERIC(12,2),
  mode_of_payment TEXT,
  invoice_number TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Relationships

```
┌──────────────┐
│  auth.users  │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐        ┌──────────────┐
│   invoices   │        │  royalties   │
└──────────────┘        └──────┬───────┘
                               │
                               │ N:1
                               ▼
                        ┌──────────────┐
                        │    tracks    │
                        └──────────────┘
```

### Row Level Security

```
┌─────────────────────────────────────────────────────┐
│                    RLS Policies                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Artist Policies:                                   │
│  ✓ SELECT WHERE artist_id = auth.uid()             │
│  ✓ INSERT WHERE artist_id = auth.uid()             │
│  ✗ UPDATE (cannot change status)                   │
│  ✗ DELETE                                           │
│                                                      │
│  Admin Policies:                                    │
│  ✓ SELECT (all records)                            │
│  ✓ UPDATE (all records)                            │
│  ✓ INSERT (all records)                            │
│  ✓ DELETE (all records)                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🧩 Component Architecture

### Component Hierarchy

```
App Layout
├── Sidebar (with Invoices link)
├── Topbar
└── Page Content
    │
    ├── /invoices
    │   ├── page.tsx (Route handler)
    │   │   ├── ArtistInvoices.tsx (if role = artist)
    │   │   │   ├── Invoice list table
    │   │   │   ├── Available balance card
    │   │   │   └── Request payment dialog
    │   │   │
    │   │   └── AdminInvoiceList.tsx (if role = admin)
    │   │       ├── Statistics cards
    │   │       ├── Search bar
    │   │       ├── Filter dropdown
    │   │       ├── Invoice table
    │   │       └── Action dialogs
    │   │
    │   └── /catalog
    │       └── page.tsx (Enhanced)
    │           ├── Search bar
    │           ├── Delete All button (admin)
    │           ├── Track table (filtered)
    │           └── Confirmation dialogs
```

### State Management

```
┌─────────────────────────────────────┐
│      Component State                │
├─────────────────────────────────────┤
│                                      │
│  const [invoices, setInvoices]      │
│  const [loading, setLoading]        │
│  const [searchTerm, setSearchTerm]  │
│  const [statusFilter, setFilter]    │
│  const [selectedInvoice, setSelected]│
│                                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         useEffect Hooks             │
├─────────────────────────────────────┤
│                                      │
│  useEffect(() => {                  │
│    fetchInvoices()                  │
│  }, [user])                         │
│                                      │
│  useEffect(() => {                  │
│    filterInvoices()                 │
│  }, [searchTerm, statusFilter])     │
│                                      │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Supabase Queries               │
├─────────────────────────────────────┤
│                                      │
│  supabase.from('invoices')          │
│    .select('*, user_profiles(email)')│
│    .eq('status', 'pending')         │
│                                      │
└─────────────────────────────────────┘
```

---

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ Login
     ▼
┌──────────────────┐
│  Supabase Auth   │
└────┬─────────────┘
     │ Returns JWT
     ▼
┌──────────────────┐
│  useAuth() hook  │
│  Fetches profile │
└────┬─────────────┘
     │ Sets user state
     ▼
┌──────────────────┐
│  AuthContext     │
│  {id, email, role}│
└────┬─────────────┘
     │ Provides to components
     ▼
┌──────────────────┐
│  Components      │
│  Check user.role │
└──────────────────┘
```

### Authorization Layers

```
Layer 1: Frontend Role Check
┌─────────────────────────────┐
│  if (user.role === 'admin') │
│    show admin features      │
└─────────────────────────────┘

Layer 2: Route Protection
┌─────────────────────────────┐
│  useEffect(() => {          │
│    if (!user) redirect      │
│  })                         │
└─────────────────────────────┘

Layer 3: Database RLS
┌─────────────────────────────┐
│  PostgreSQL enforces access │
│  Cannot be bypassed         │
└─────────────────────────────┘
```

---

## 📊 Performance Optimization

### Database Indexes

```
invoices table:
├── idx_invoices_artist_id     (lookup by artist)
├── idx_invoices_status        (filter by status)
├── idx_invoices_invoice_number (unique lookups)
└── idx_invoices_created_at    (date sorting)

tracks table:
├── idx_tracks_artist_id       (artist filtering)
└── idx_tracks_created_at      (date sorting)
```

### Query Optimization

```
✓ Use specific SELECT fields
  .select('id, amount, status')

✓ Use indexes in WHERE clauses
  .eq('status', 'pending')  ← Uses idx_invoices_status

✓ Join efficiently
  .select('*, user_profiles(email)')

✓ Limit results when possible
  .limit(100)

✓ Order by indexed columns
  .order('created_at', { ascending: false })
```

### Frontend Optimization

```
✓ React.memo for expensive components
✓ useCallback for stable functions
✓ Debounced search (implicit via state)
✓ Conditional rendering
✓ Lazy loading for large lists
```

---

## 🔄 State Flow

### Invoice Status State Machine

```
┌─────────┐
│ CREATE  │
└────┬────┘
     │
     ▼
┌─────────┐      ┌──────────┐
│ PENDING │─────→│ APPROVED │
└────┬────┘      └────┬─────┘
     │                │
     │                ▼
     │           ┌────────┐
     │           │  PAID  │
     │           └────────┘
     │
     ▼
┌──────────┐
│ REJECTED │
└──────────┘

Rules:
- pending → approved (admin)
- pending → rejected (admin)
- approved → paid (admin)
- paid/rejected → FINAL (cannot change)
```

### Search State Flow

```
User Input
    ↓
searchTerm state updates
    ↓
useEffect triggers
    ↓
filterTracks() runs
    ↓
filteredTracks state updates
    ↓
Component re-renders
    ↓
New filtered results display
```

---

## 🎯 API Endpoints (Supabase)

### Invoice Operations

```typescript
// Create invoice
POST /rest/v1/invoices
Body: { artist_id, amount, mode_of_payment, invoice_number, status }

// Get invoices
GET /rest/v1/invoices
Query: ?select=*,user_profiles(email)&artist_id=eq.{id}

// Update invoice status
PATCH /rest/v1/invoices?id=eq.{id}
Body: { status: 'approved' }

// Generate invoice number
POST /rest/v1/rpc/generate_invoice_number
Returns: "INV-2025-001"
```

### Track Operations

```typescript
// Search tracks
GET /rest/v1/tracks
Query: ?or=(title.ilike.*sunset*,iswc.ilike.*sunset*)

// Delete all tracks
DELETE /rest/v1/tracks
Query: ?id=neq.00000000-0000-0000-0000-000000000000
```

---

## 🌐 Navigation Flow

```
User clicks "Invoices" in sidebar
           ↓
App Router loads /invoices/page.tsx
           ↓
Page checks authentication
           ↓
    ┌──────┴───────┐
    ▼              ▼
Artist role    Admin role
    │              │
    ▼              ▼
ArtistInvoices AdminInvoiceList
    │              │
    └──────┬───────┘
           ▼
    Renders UI
```

---

## 🎨 UI Component Tree

```
InvoicesPage
├── if (role === 'artist')
│   └── ArtistInvoices
│       ├── Header
│       ├── Balance Card
│       ├── Invoices Table
│       │   ├── Table Header
│       │   ├── Table Rows
│       │   │   ├── Invoice Number
│       │   │   ├── Amount
│       │   │   ├── Status Badge
│       │   │   └── Dates
│       │   └── Empty State
│       └── Request Dialog
│           ├── Form Fields
│           ├── Validation
│           └── Submit Button
│
└── if (role === 'admin')
    └── AdminInvoiceList
        ├── Header
        ├── Statistics Cards
        ├── Search/Filter Bar
        ├── Invoices Table
        │   ├── Table Header
        │   ├── Table Rows
        │   │   ├── Invoice Number
        │   │   ├── Artist Email
        │   │   ├── Amount
        │   │   ├── Status Badge
        │   │   └── Action Buttons
        │   └── Empty State
        └── Action Dialogs
            ├── Approve Dialog
            ├── Reject Dialog
            └── Mark Paid Dialog
```

---

## 🔌 Integration Points

### With Existing System

```
New Features          Existing System
┌──────────────┐      ┌──────────────┐
│  Invoices    │◄────►│  Royalties   │
└──────────────┘      └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│   Sidebar    │◄────►│    Auth      │
└──────────────┘      └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│  Catalog+    │◄────►│   Tracks     │
└──────────────┘      └──────────────┘
```

### Shared Services

- **Auth Context:** User authentication and role
- **Toast System:** Notifications
- **Supabase Client:** Database access
- **UI Components:** Button, Dialog, Input
- **Types:** Shared TypeScript interfaces

---

## 📦 Build & Deployment

### Build Process

```
Source Files
    ↓
TypeScript Compilation
    ↓
Next.js Build
    ↓
Static Generation (where possible)
    ↓
Server Components
    ↓
Client Components
    ↓
Optimized Bundle
    ↓
Deploy to Vercel/Hosting
```

### Environment Setup

```
Development:
- Local Next.js server (npm run dev)
- Supabase project (cloud or local)
- Environment variables in .env.local

Production:
- Vercel/hosting provider
- Production Supabase project
- Environment variables in hosting dashboard
- HTTPS enabled
- CDN for assets
```

---

## 🎯 Success Metrics

### Performance Targets

```
┌────────────────────┬──────────┐
│ Metric             │ Target   │
├────────────────────┼──────────┤
│ Page Load Time     │ < 2s     │
│ Search Response    │ < 100ms  │
│ DB Query Time      │ < 200ms  │
│ Action Feedback    │ < 500ms  │
│ Bundle Size        │ < 500KB  │
└────────────────────┴──────────┘
```

### Feature Adoption

```
Week 1: User training
Week 2: Monitor usage
Week 3: Gather feedback
Week 4: Iterate improvements
```

---

## 🔍 Monitoring & Logging

### What to Monitor

```
Database:
- Query performance
- RLS policy hits/misses
- Connection pool usage
- Error rates

Frontend:
- Page load times
- JavaScript errors
- User actions (analytics)
- Search usage

Business:
- Invoices created per day
- Average approval time
- Search usage patterns
- Delete operations
```

### Logging Points

```typescript
// Invoice creation
console.log('Invoice created:', invoiceNumber);

// Status changes
console.log('Status updated:', oldStatus, '->', newStatus);

// Search queries
console.log('Search query:', searchTerm, 'results:', count);

// Errors
console.error('Failed to create invoice:', error);
```

---

## 📋 Maintenance Guide

### Regular Tasks

```
Daily:
- Monitor error logs
- Check invoice queue

Weekly:
- Review database performance
- Check RLS policy effectiveness
- Analyze search patterns

Monthly:
- Update dependencies
- Review user feedback
- Optimize slow queries
- Archive old invoices (if needed)
```

### Backup Strategy

```
Database:
- Automatic backups by Supabase
- Point-in-time recovery available
- Export critical tables regularly

Code:
- Git version control
- Main branch protected
- Feature branches for changes
- CI/CD pipeline
```

---

**Architecture designed for scalability, security, and maintainability.**

*Last Updated: October 27, 2025*
















