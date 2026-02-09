# M.M. Construction — Billing & Ledger System

A complete billing, ledger, and payment tracking system built for **M.M. Construction**, an iron fabrication factory manufacturing grills, shutters, railings, windows, gates, and custom items.

---

## 🏗️ Architecture

```
M.M.Construction/
├── backend/                  # Express + MongoDB REST API
│   ├── src/
│   │   ├── config/           # DB connection & env config
│   │   ├── controllers/      # Route handlers (auth, customer, bill, payment, etc.)
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── models/            # Mongoose schemas (8 models)
│   │   ├── routes/            # Express route definitions
│   │   ├── seeders/           # Database seeder
│   │   ├── utils/             # Activity logger
│   │   └── server.js          # Entry point
│   ├── .env
│   └── package.json
│
├── frontend/                 # React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Auth context (JWT state)
│   │   ├── pages/            # All page views
│   │   ├── services/         # Axios API instance
│   │   ├── utils/            # Formatters & helpers
│   │   ├── App.jsx           # Router & protected routes
│   │   └── main.jsx          # React root
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## ✨ Features

| Module | Highlights |
|---|---|
| **Authentication** | JWT login, role-based (Owner / Staff), protected routes |
| **Dashboard** | Today's & monthly stats, staff-wise billing, overdue promises |
| **Customers** | CRUD, search, phone index, automatic ledger recalculation |
| **Customer Ledger** | Full history — bills, payments, summary cards, print-ready |
| **Products** | Category-based catalog (Grill, Shutter, Railing, etc.), rate & fitting charges |
| **Bills** | Auto bill number `MM-YYYY-XXXX`, line items with weight/qty, discount, advance, live totals |
| **Payments** | Multi-mode (Cash/UPI/Bank/Cheque), atomic MongoDB transactions |
| **Promises** | Track payment promises, auto-mark overdue, fulfill/broken actions |
| **Reports** | Bills report, due report, payment collection summary with mode breakdown |
| **Activity Logs** | Full audit trail — every create/update/payment logged with actor |
| **User Management** | Owner can create staff, activate/deactivate accounts |

---

## 🛠️ Tech Stack

**Backend:** Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, express-validator  
**Frontend:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios, react-hot-toast, react-icons  
**Theme:** Dark UI with custom Tailwind theme

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ — [Download](https://nodejs.org)
- **MongoDB** v6+ running locally or Atlas URI — [Download](https://www.mongodb.com/try/download/community)

### 1. Clone the project

```bash
cd "M.M.Construction"
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create/edit the `.env` file (already pre-configured):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/mm_construction
JWT_SECRET=mm_construction_super_secret_key_2024
JWT_EXPIRE=7d
NODE_ENV=development
```

Seed the database with default users and products:

```bash
npm run seed
```

Start the backend server:

```bash
npm run dev
```

Backend runs at **http://localhost:5000**

### 3. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

### 4. Login

Use the seeded credentials:

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@mmconstruction.com | owner123 |
| Staff | staff@mmconstruction.com | staff123 |

---

## 📦 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register (owner only) |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/users` | List all users (owner) |
| PUT | `/api/auth/users/:id/status` | Activate/deactivate user |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/customers` | Create customer |
| GET | `/api/customers` | List customers (search, paginate) |
| GET | `/api/customers/:id` | Get customer |
| PUT | `/api/customers/:id` | Update customer |
| GET | `/api/customers/:id/ledger` | Full customer ledger |
| GET | `/api/customers/due/list` | All customers with dues |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/products` | Create product |
| GET | `/api/products` | List products (filter by category) |
| GET | `/api/products/:id` | Get product |
| PUT | `/api/products/:id` | Update product |

### Bills
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bills` | Create bill |
| GET | `/api/bills` | List bills (search, filter, paginate) |
| GET | `/api/bills/:id` | Get bill with payments |
| PUT | `/api/bills/:id` | Update bill |
| GET | `/api/bills/stats/overview` | Dashboard stats |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments` | Record payment (transactional) |
| GET | `/api/payments` | List all payments |
| GET | `/api/payments/bill/:billId` | Payments for a bill |
| GET | `/api/payments/customer/:customerId` | Customer payments |

### Promises
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/promises` | Create promise |
| GET | `/api/promises` | List promises (filter by status) |
| GET | `/api/promises/overdue` | Get overdue promises |
| PUT | `/api/promises/:id` | Update promise |
| GET | `/api/promises/customer/:customerId` | Customer promises |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/bills` | Bills report (date range) |
| GET | `/api/reports/dues` | Outstanding dues |
| GET | `/api/reports/payments` | Payment collection report |
| GET | `/api/reports/customer-ledger` | Customer-wise ledger |

### Activity Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activity-logs` | Audit logs (owner only) |

---

## 📱 UI Pages

| Page | Route | Access |
|------|-------|--------|
| Login | `/login` | Public |
| Dashboard | `/` | All |
| Customers | `/customers` | All |
| Customer Ledger | `/customers/:id/ledger` | All |
| Products | `/products` | All |
| Bills | `/bills` | All |
| Create Bill | `/bills/create` | All |
| Bill Detail | `/bills/:id` | All |
| Payments | `/payments` | All |
| Promises | `/promises` | All |
| Reports | `/reports` | All |
| Activity Logs | `/activity-logs` | Owner |
| Users | `/users` | Owner |

---

## 🔑 Key Design Decisions

1. **Bill Number Format** — `MM-YYYY-XXXX` generated atomically using a `Counter` collection with `$inc`.
2. **Denormalized Ledger** — `Customer.totalBilled`, `totalPaid`, `currentDue` stored directly for fast reads, recalculated from `Bill.aggregate()` after every mutation.
3. **Atomic Payments** — Payment recording uses MongoDB sessions/transactions to update both `Payment` and `Bill` documents atomically.
4. **Product Snapshots** — Bill line items store `productName`, `rate`, `unit` at creation time so historical bills remain accurate even if product details change.
5. **Activity Logging** — Fire-and-forget audit logging captures every significant action without blocking the primary operation.

---

## 🧪 Seed Data

Running `npm run seed` creates:

- **Owner account** — owner@mmconstruction.com / owner123
- **Staff account** — staff@mmconstruction.com / staff123
- **9 products** — MS Grill, SS Railing, Rolling Shutter, Aluminium Window, Iron Gate, MS Railing, SS Gate, Collapsible Gate, Custom Fabrication

---

## 📄 License

Private — M.M. Construction internal use.
