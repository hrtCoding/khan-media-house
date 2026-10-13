Khan Media House — Printing Press Management System
====================================================
Tech: HTML + Tailwind CSS + JavaScript + Firebase Authentication + Firestore
Interface: English. Currency symbol: ৳ (Taka). Date format: DD/MM/YYYY.
You can still type product names, customer names, notes etc. in Bangla.

Setup (one time)
----------------
1) Create a project at https://console.firebase.google.com
2) Build > Authentication > Get started > enable "Email/Password".
3) Build > Firestore Database > Create database (Production mode).
4) Firestore > Rules tab: paste the contents of firestore.rules and Publish.
5) Project settings > Your apps > add a Web app, copy the config into js/firebase-config.js
   (also write your shop address and phone number there — printed on the cash memo).
6) Create the first admin (there is no sign-up page, for security):
   - Authentication > Users > Add user:
       Email:    admin@khanmedia.local   ("admin" can be any User ID you like)
       Password: your password (min 6 characters)
   - Copy that user's UID.
   - Firestore > Start collection > Collection ID: users > Document ID: (the copied UID)
       name   (string)  : your name
       userId (string)  : admin
       role   (string)  : admin
       active (boolean) : true
7) Open index.html (or upload to Firebase Hosting / Netlify) and log in with User ID "admin".

Modules
-------
Dashboard, New Order (multiple items), Orders, Cash Memo (view / print / PDF),
Customers & due ledger, Products & Services (with variations), Daily Accounts,
Full History, Reports (income/expense, profit/loss), Staff Management,
Salary Management (monthly salary, advances, carry-forward, salary slip).

How pricing works
-----------------
- Products & Services: set a Default Price per product (and optionally a price per variation with the tag icon).
- New Order: choosing a product fills the Rate automatically; Amount = Quantity x Rate.
  You can change the Rate, or type the Amount by hand.
- Size is an optional field on every order item.
- Existing customers can be selected from a list; their Previous Due is added to the bill.
  Money paid above the order total reduces the previous due.

Dashboard & History
-------------------
- Dashboard shows the last 30 days. Full History shows lifetime / a month / custom range,
  as one list per category (orders, sales, expenses, payments, dues, salary) - untick to hide.

Notes
-----
- After updating, re-publish firestore.rules in the Firebase console (a rule changed).
- A staff User ID is stored internally as "id@khanmedia.local".
- Staff passwords are visible only to the admin (staff_credentials collection, admin-only rules).
- Deleting a staff account stops their login immediately; their old orders are kept.
- PDF: use "Save PDF" on the memo, or "Save as PDF" in the print dialog.
