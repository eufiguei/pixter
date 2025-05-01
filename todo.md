# Pixter Website Modifications Todo List

This list outlines the tasks required to implement the requested changes for the Pixter website.

## Phase 1: Frontend Adjustments & Basic Setup

- [X] **Task 1.1:** Clone repository
- [X] **Task 1.2:** Analyze codebase structure
- [X] **Task 1.3 (Public Payment Page):** Change number input keyboard format to use comma (`,`) as decimal separator.
- [X] **Task 1.4 (Public Payment Page):** Change payment button text to "Pagar".
- [X] **Task 1.5 (Public Payment Page):** Update top navigation bar links to "Entrar" / "Criar Conta" (client).
- [X] **Task 1.6 (Homepage):** Update top navigation bar links to "Entrar" / "Criar Conta" / "Motoristas".
- [X] **Task 1.7 (Verification Page):** Implement OTP-style input for verification code.
- [X] **Task 1.8 (General UI):** Ensure a single, consistent Pixter logo is used in the top bar across all pages.
- [X] **Task 1.9 (General UI):** Remove duplicate logos from pages (as indicated in `IMG_0351 (1).jpeg`).
- [X] **Task 1.10 (General UI):** Make the top navigation bar fixed (sticky).
- [X] **Task 1.11 (General UI):** Move driver dashboard navigation links (Visão Geral, Meus Dados, Sair, etc.) into the fixed top bar.

## Phase 2: Driver Dashboard & Stripe Integration

- [X] **Task 2.1 (Driver Dashboard - Routing):** Refactor dashboard sections (Visão Geral, Meus Pagamentos, Meus Dados) into separate routes for independent navigation and browser history.
- [X] **Task 2.2 (Driver Dashboard - My Data):** Fetch and display correct Stripe account status (Verified/Pending/Needs Attention) with corresponding icons (Green/Yellow/Red).
- [X] **Task 2.3 (Driver Dashboard - My Data):** Add a link to the driver's Stripe dashboard.
- [X] **Task 2.4 (Driver Dashboard - My Data):** Implement avatar change functionality.
- [X] **Task 2.5 (Driver Dashboard - My Payment Page):** Hide Stripe connection info if already connected.
- [X] **Task 2.6 (Driver Dashboard - My Payment Page):** Fix the QR code functionality.
- [X] **Task 2.7 (Driver Dashboard - My Payments):** Integrate Stripe to fetch and list the driver's received payments (Data, Valor, Método, Recibo link).
- [X] **Task 2.8 (Driver Dashboard - My Payments):** Implement date filtering for the payments list.
- [X] **Task 2.9 (Driver Dashboard - Overview):** Implement the overview page layout based on `FD243785-58C5-4C7C-AE59-8ED95871F913 (1).png`, including:
    - [X] Weekly/Monthly earnings graph.
    - [X] Current month's earnings display.
    - [X] Summary/list of recent payments (potentially linking to the full list).

## Phase 3: PDF Receipts & Advanced Features
- [X] **Task 3.1 (PDF Receipts):** Create PDF receipt template for clients (showing only amount paid, using "Nome Completo" and masked CPF).
- [X] **Task 3.2 (Receipts):** Create a PDF receipt template for drivers (including Pixter fee - 3%, using masked CPF if applicable).
- [X] **Task 3.3 (Receipts):** Add download links for receipts in the driver's "Meus Pagamentos" list.

## Phase 4: Testing & Deployment

- [X] **Task 4.1:** Thoroughly test all implemented changes locally.
- [X] **Task 4.2:** Build the Next.js application for production. *(Build successful locally after fixes; assumes Vercel has correct ENV VARS)*
- [ ] **Task 4.3:** Ask user for confirmation before deployment.
- [ ] **Task 4.4:** Deploy the updated application.
- [ ] **Task 4.5:** Final report to the user.

---

**Skipped Tasks:**

- [X] **Post-Payment Flow (Task 3.5):** Implemented temporary storage (15 min) of Charge ID linked to client IP address after payment, with logic to associate it upon signup.
- **Client Google Login (Task 3.6):** Fixing the "Access Denied" error likely requires checking OAuth credentials and redirect URIs in the Google Cloud Console and Supabase authentication settings, which I cannot access.
