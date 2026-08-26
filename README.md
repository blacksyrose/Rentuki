# Rentuki — Rental Management System

A web-based rental management system built with **React, Vite, and Supabase** to help manage tenants, units, rental payments, maintenance expenses, reports, and tenant portal access.

## 🌐 Live Demo

**[View Rentuki Live Demo](working...)**

---

## 📌 About the Project

Rentuki is a rental management application designed to centralize common rental property management tasks in one system.

The application provides tools for managing tenants and units, recording rental payments, tracking maintenance and expenses, generating monthly summaries and reports, managing receipts, and providing tenants with read-only portal access.

The project was developed as a practical full-stack web application to strengthen my experience with **React, database integration, application logic, testing, and troubleshooting**.

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

## 🏗️ Project Structure

```text
src/
├── components/        # Shared UI components
├── pages/             # Application pages
├── services/
│   └── db.js          # Supabase data access layer
├── lib/
│   └── supabase.js    # Supabase client
├── styles/
│   └── *.css          # Page-specific styles
└── styles.css         # Shared/global styles
```

---

## 🔐 Database & Application Logic

Rentuki uses Supabase for its backend and database integration.

Some of the application's important business rules include:

- Move-in date and payment due day are stored separately.
- ```tenancies.payment_due_day``` controls the recurring rent due date.
- Rent is stored on each tenancy to preserve historical rental rates.
- Monthly rent payments use billing records.
- Advance rent and security deposits are stored as separate payment records.
- Tenant transfers end the previous tenancy and create a new tenancy.
- Historical billing, payment, and receipt records are retained.
- Tenant portal access is private and read-only.
- Monthly summaries separate rent from advance rent and security deposits.

---

## 📸 Screenshots

Dashboard

Tenant Management

Payments

Monthly Summary

---

## 🚀 Getting Started

**Requirements**
- Node.js 20+
- npm
- Existing Supabase project with the required Rentuki database schema and RPCs

**1. Clone the repository**
```git clone YOUR_REPOSITORY_URL 
cd Rentuki```
