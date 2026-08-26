# Rentuki — Rental Management System

A web-based rental management system built with **React, Vite, and Supabase** to help manage tenants, rental units, payments, maintenance expenses, reports, and tenant portal access.

## 🌐 Live Demo

🚀 **[View Rentuki Live Demo](https://rentuki-live-demo.vercel.app)**

**Demo Account**

```text
Email: demo@rentuki.com
Password: !Demo123
```

---

## 📌 About the Project

Rentuki is a rental management application designed to centralize common rental property management tasks in one system.

The application provides tools for managing tenants and units, recording rental payments, tracking maintenance and expenses, generating monthly summaries and reports, managing receipts, and providing tenants with read-only portal access.

The project was developed as a practical full-stack web application to strengthen my experience with **React, database integration, application logic, testing, troubleshooting, technical problem-solving.**.

---

## ✨ Features

### Dashboard
- Overview of rental management information
- Access to major system functions

### Tenant Management
- Manage tenant information
- Track tenant tenancy records
- Support tenant transfers

### Unit Management
- Manage rental units
- Organize units by unit number
- Track unit availability

### Payments
- Record monthly rent payments
- Record advance rent
- Record security deposits
- Preserve historical payment records

### Maintenance & Expenses
- Track maintenance-related expenses
- Manage property expenses

### Monthly Summary
- Generate monthly rental summaries
- Separate rent from advance rent and security deposits
- Display units in ascending unit-number order

### Receipts & Reports
- Manage rental receipts
- Generate rental-related reports

### Submeter Calculator
- Calculate submeter-related values for rental units

### Tenant Portal
- Private tenant access using an access key
- Read-only access to relevant tenant information

### Settings
- Manage application settings

---

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend / Database
- Supabase
- PostgreSQL

### Development Tools
- Git
- GitHub
- npm
- VS Code

---

## 💡 Core Skills Demonstrated

- React.js application development
- Supabase/PostgreSQL database integration
- CRUD operations
- Authentication and authorization
- Application and business logic
- Form handling and validation
- Data management
- Troubleshooting and debugging
- Software testing
- Responsive UI development
- Technical documentation

---

## 🏗️ Project Structure

```text
src/
├── components/        # Shared UI components
├── lib/
│   └── supabase.js    # Supabase client
├── pages/             # Application pages
├── services/
│   └── db.js          # Supabase data access layer
├── styles/
│   └── *.css          # Page-specific styles
└── styles.css         # Shared/global styles
```

---

## 🔐 Database & Application Logic

Rentuki uses Supabase for its backend and database integration.

Some of the application's important business rules include:

- Move-in date and payment due day are stored separately.
- `tenancies.payment_due_day` controls the recurring rent due date.
- Rent is stored on each tenancy to preserve historical rental rates.
- Monthly rent payments use billing records.
- Advance rent and security deposits are stored as separate payment records.
- Tenant transfers end the previous tenancy and create a new tenancy.
- Historical billing, payment, and receipt records are retained.
- Tenant portal access is private and read-only.
- Monthly summaries separate rent from advance rent and security deposits.

---

## 📸 Screenshots

View screenshots of the application:

- [📊 Dashboard](screenshots/dashboard.png)
- [👥 Tenant Management](screenshots/tenants.png)
- [💳 Payments](screenshots/payments.png)
- [📈 Monthly Summary](screenshots/summary.png)

---

## 🚀 Getting Started

**Requirements**
- Node.js 20+
- npm
- Existing Supabase project with the required Rentuki database schema and RPCs

**1. Clone the repository**
```
git clone YOUR_REPOSITORY_URL 
cd Rentuki
```

**2. Configure environment variables**

Copy `.env.example` to `.env`:
```
cp .env.example .env
```
Add your Supabase credentials:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**3. Install dependencies**
```
npm install
```

**4. Start the development server**
```
npm run dev
```

---

## 📦 Production Build

Create a production build:
```
npm run build
```
Preview the production build locally:
```
npm run preview
```
The generated production files are placed in:
```
dist/
```
The application can be deployed to services such as Vercel, Netlify, or Cloudflare Pages.

For production deployment, configure:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## 🧪 Testing & Validation

The application was smoke-tested against the existing Supabase project.
- Dashboard
- Tenant Management
- Unit Management
- Payment Recording
- Maintenance & Expenses
- Monthly Summaries
- Receipts
- Submeter Calculator
- Settings
- Tenant Portal

Testing included functionality verification, troubleshooting, and database-related validation.

---

## 🔒 Security

- Supabase credentials are stored using environment variables.
- The Supabase service-role key must never be exposed in frontend environment variables.
- Production credentials should not be committed to the repository.
- `.env` should remain excluded from version control.

---

## 🔮 Future Improvements

Potential future improvements include:

- Additional reporting features
- Improved tenant communication features
- Enhanced authentication and authorization
- Additional rental management workflows
- Further UI/UX improvements

## 👩‍💻 Developer

**Erika B. Ferolino**

BSIT Graduate

Quezon City, Philippines

[Portfolio](working...)

---

⭐ If you find the project interesting, feel free to explore the source code and live demo.
