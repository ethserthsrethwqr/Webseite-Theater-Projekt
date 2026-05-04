# StagePass Theater Ticketing

StagePass is a production-ready ticket reservation and admission system for school and theater performances. It combines a public ticket booking page, QR-code ticket emails, class-specific admin accounts, owner analytics, guest lists, cancellation handling, and VIP passes in one local Node.js application.

The project is built for a theater project where different classes or groups can manage their own performances without interfering with each other.

## Features

- Public ticket booking with adult and child ticket categories
- QR-code tickets sent by email through GMX SMTP
- Ticket cancellation flow with email confirmation
- Automatic seat accounting, including restored capacity after cancellation
- Owner dashboard with account switching across groups/classes
- Separate group admin accounts for individual classes
- Password hashing with `scrypt`
- SQLite database with WAL mode
- Rate limiting on sensitive routes
- Admin analytics for bookings, scans, login activity, and group usage
- Guest list view with print-optimized A4 output
- VIP passes scoped to a group or a specific performance
- Printable VIP cards in standard card size
- QR scanner for admission control
- LAN access for testing from mobile devices on the same network

## Tech Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Express
- SQLite via `better-sqlite3`
- Nodemailer
- QR code generation and scanning

## Project Structure

```text
.
├── src/                 # React frontend
├── public/              # Public static assets
├── server.ts            # Express API, SQLite setup, email and admin routes
├── index.html           # Vite entry document
├── package.json         # Scripts and dependencies
├── .env.example         # Safe configuration template
└── vite.config.ts       # Vite configuration
```

Runtime files such as `.env`, `tickets.db`, SQLite WAL files, build output, logs, and uploads are intentionally excluded from Git.

## Configuration

Create a local `.env` file from the template:

```bash
cp .env.example .env
```

On Windows PowerShell you can use:

```powershell
Copy-Item .env.example .env
```

Then configure your local values:

```env
GMX_EMAIL=your-mailbox@gmx.de
GMX_PASSWORD=your-gmx-app-password

PUBLIC_PORT=3100
ADMIN_PORT=3101
VITE_HMR_PORT=24780

PUBLIC_DOMAIN=theaterprojektklasse8.store
```

Important: never commit `.env`. The real GMX credentials must stay local.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Default local URLs:

- Public booking page: `http://localhost:3100`
- Admin dashboard: `http://localhost:3101`

The server binds to `0.0.0.0`, so it can also be reached from another device in the same network through the computer's local IP address, for example:

```text
http://192.168.x.x:3100
http://192.168.x.x:3101
```

Camera access for scanning may require HTTPS depending on the mobile browser.

## Build and Type Check

```bash
npm run lint
npm run build
```

`npm run lint` runs TypeScript checks with `tsc --noEmit`.

## Admin Model

StagePass supports multiple account levels:

- Owner/Admin: manages groups, accounts, analytics, email configuration, and can switch into a group context.
- Group Admin: manages the performances and tickets of one assigned class/group.
- Scanner: dedicated admission-control role.

Group admins cannot see or modify other groups.

## Email Delivery

Ticket confirmations, cancellation codes, and cancellation confirmations are sent through GMX SMTP. The credentials are read from `.env` or saved local settings and are not part of the repository.

The ticket email includes:

- booking confirmation
- group/class label
- ticket type
- QR code
- cancellation link
- payment note for cash payment at the entrance

## Database

The app uses SQLite locally. The database is created automatically on first start:

```text
tickets.db
tickets.db-shm
tickets.db-wal
```

These files are ignored by Git because they contain runtime and potentially personal booking data.

## Security Notes

- Passwords are stored as salted `scrypt` hashes.
- `.env` is ignored and must never be committed.
- The SQLite database is ignored because it can contain personal ticket data.
- Admin and purchase routes use basic rate limiting.
- Group-scoped routes enforce access checks on the server.

## Deployment Notes

For a real public deployment, run the Node server behind a reverse proxy such as Nginx or Caddy and use HTTPS. For scanner use on phones, HTTPS is strongly recommended because browsers may block camera access on plain HTTP.

## License

Private project for a school/theater ticketing workflow. Add a license before publishing as open source.
