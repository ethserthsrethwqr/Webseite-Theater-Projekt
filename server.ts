import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import crypto from "crypto";
import os from "os";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("tickets.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

type Role = "admin" | "group_admin" | "scanner";
type AuthContext = { role: Role; userId?: number; username?: string; groupId?: number; groupName?: string };

const PASSWORD_PREFIX = "scrypt";

function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(secret, salt, 64).toString("hex");
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

function isHashedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PASSWORD_PREFIX}$`);
}

function verifySecret(secret: string, stored: string): boolean {
  if (!stored) return false;
  if (!isHashedSecret(stored)) return secret === stored;

  const [, salt, hashHex] = stored.split("$");
  if (!salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(secret, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    total_seats INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    image_url TEXT,
    location_name TEXT DEFAULT '',
    location_address TEXT DEFAULT '',
    entry_offset INTEGER DEFAULT 30,
    sales_lock_after_start INTEGER DEFAULT 0,
    section_key TEXT DEFAULT 'left',
    section_title TEXT DEFAULT 'Theaterstück der 8B',
    group_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'valid', -- valid, used, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (show_id) REFERENCES shows(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    group_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section_key TEXT DEFAULT 'left',
    section_title TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    role TEXT,
    group_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vip_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    show_id INTEGER,
    label TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migrations
try { db.prepare("ALTER TABLE shows ADD COLUMN image_url TEXT").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN price_child REAL DEFAULT 5.00").run(); } catch {}
try { db.prepare("ALTER TABLE tickets ADD COLUMN storno_code TEXT").run(); } catch {}
try { db.prepare("ALTER TABLE tickets ADD COLUMN storno_expires INTEGER").run(); } catch {}
try { db.prepare("ALTER TABLE tickets ADD COLUMN canceled_at DATETIME").run(); } catch {}
try { db.prepare("ALTER TABLE tickets ADD COLUMN scanned_at DATETIME").run(); } catch {}
try { db.prepare("ALTER TABLE tickets ADD COLUMN ticket_type TEXT DEFAULT 'adult'").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN location_name TEXT DEFAULT ''").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN location_address TEXT DEFAULT ''").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN entry_offset INTEGER DEFAULT 30").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN sales_lock_after_start INTEGER DEFAULT 0").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN section_key TEXT DEFAULT 'left'").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN section_title TEXT DEFAULT 'Theaterstück der 8B'").run(); } catch {}
try { db.prepare("ALTER TABLE shows ADD COLUMN group_id INTEGER").run(); } catch {}
try { db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'").run(); } catch {}
try { db.prepare("ALTER TABLE users ADD COLUMN group_id INTEGER").run(); } catch {}

function logActivity(req: express.Request, auth: AuthContext | null, action: string, targetType = "", targetId: string | number | null = null, metadata: Record<string, unknown> = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, role, group_id, action, target_type, target_id, metadata, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auth?.userId || null,
      auth?.username || null,
      auth?.role || null,
      auth?.groupId || null,
      action,
      targetType || null,
      targetId == null ? null : String(targetId),
      JSON.stringify(metadata || {}),
      req.ip || req.socket.remoteAddress || null,
      req.get("user-agent") || null
    );
  } catch (err) {
    console.error("[audit] failed:", err);
  }
}

function generateVipCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "VIP-";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getLanUrls(port: number): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((addr): addr is os.NetworkInterfaceInfo => !!addr && addr.family === "IPv4" && !addr.internal)
    .map(addr => `http://${addr.address}:${port}`);
}

function ensureGroup(name: string, sectionKey: "left" | "right", sectionTitle: string): number {
  const existing = db.prepare("SELECT id FROM groups WHERE name = ?").get(name) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db.prepare("INSERT INTO groups (name, section_key, section_title) VALUES (?, ?, ?)").run(name, sectionKey, sectionTitle);
  return Number(result.lastInsertRowid);
}

const group8BId = ensureGroup("8B", "left", "Tickets für das Theaterstück der 8B");
const group8CId = ensureGroup("8C", "right", "Tickets für das Theaterstück der 8C");

function groupPresentation(groupId?: number | null, fallbackName = ""): { sectionKey: "left" | "right"; sectionTitle: string; groupName: string } {
  const group = groupId ? db.prepare("SELECT name FROM groups WHERE id = ?").get(groupId) as any : null;
  const groupName = cleanText(group?.name || fallbackName, 100);
  const normalized = groupName.toUpperCase().replace(/\s+/g, "");
  const sectionKey: "left" | "right" = normalized.endsWith("C") || normalized.includes("8C") ? "right" : "left";
  const sectionTitle = groupName ? `Theaterstück der Klasse ${groupName}` : (sectionKey === "right" ? "Theaterstück der Klasse 8C" : "Theaterstück der Klasse 8B");
  return { sectionKey, sectionTitle, groupName };
}

function showHasStarted(show: { date: string; time: string }): boolean {
  const startsAt = new Date(`${show.date}T${show.time || "00:00"}:00`);
  return Number.isFinite(startsAt.getTime()) && Date.now() >= startsAt.getTime();
}

db.prepare("UPDATE groups SET section_key = 'left', section_title = 'Theaterstück der Klasse 8B' WHERE UPPER(REPLACE(name, ' ', '')) LIKE '%8B'").run();
db.prepare("UPDATE groups SET section_key = 'right', section_title = 'Theaterstück der Klasse 8C' WHERE UPPER(REPLACE(name, ' ', '')) LIKE '%8C'").run();
db.prepare("UPDATE shows SET section_key = 'left', section_title = 'Theaterstück der Klasse 8B' WHERE group_id = ?").run(group8BId);
db.prepare("UPDATE shows SET section_key = 'right', section_title = 'Theaterstück der Klasse 8C' WHERE group_id = ?").run(group8CId);

// Migrate existing shows: copy global venue settings to any shows with empty location fields
{
  const globalVenueName = (db.prepare("SELECT value FROM settings WHERE key = 'venue_name'").get() as any)?.value || "";
  const globalVenueAddr = (db.prepare("SELECT value FROM settings WHERE key = 'venue_address'").get() as any)?.value || "";
  if (globalVenueName || globalVenueAddr) {
    db.prepare("UPDATE shows SET location_name = ? WHERE location_name IS NULL OR location_name = ''").run(globalVenueName);
    db.prepare("UPDATE shows SET location_address = ? WHERE location_address IS NULL OR location_address = ''").run(globalVenueAddr);
    console.log(`OK: migrated global venue to ${db.prepare("SELECT changes() as c").get() ? 'existing' : '0'} show(s)`);
  }
}

// Fix: recalculate available_seats for ALL shows based on actual active tickets
// This ensures DB consistency even if total_seats was changed without recalculation before
{
  const allShows = db.prepare("SELECT id, total_seats FROM shows").all() as { id: number; total_seats: number }[];
  for (const s of allShows) {
    const active = (db.prepare("SELECT COUNT(*) as count FROM tickets WHERE show_id = ? AND status != 'cancelled'").get(s.id) as any).count;
    const correctAvailable = Math.max(0, s.total_seats - active);
    db.prepare("UPDATE shows SET available_seats = ? WHERE id = ?").run(correctAvailable, s.id);
  }
  console.log(`OK: available_seats recalculated for ${allShows.length} show(s)`);
}

// Seed initial data if empty
const showCount = db.prepare("SELECT COUNT(*) as count FROM shows").get() as { count: number };
if (showCount.count === 0) {
  const insertShow = db.prepare("INSERT INTO shows (title, date, time, description, price, price_child, total_seats, available_seats, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertShow.run(
    "Die achte Klasse präsentiert: Der Sturm",
    "2026-03-25",
    "19:00",
    "Eine moderne Interpretation von Shakespeares Klassiker - erlebt von Schülerinnen und Schülern der achten Klasse.",
    10.00,
    5.00,
    200,
    200,
    null
  );
  insertShow.run(
    "Die achte Klasse präsentiert: Der Sturm",
    "2026-03-25",
    "14:00",
    "Eine moderne Interpretation von Shakespeares Klassiker - erlebt von Schülerinnen und Schülern der achten Klasse.",
    10.00,
    5.00,
    200,
    200,
    null
  );
}

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')").run("admin", hashSecret("theater2026"));
}

function ensureGroupUser(username: string, password: string, groupId: number) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE users SET role = 'group_admin', group_id = ? WHERE id = ?").run(groupId, existing.id);
    return;
  }
  db.prepare("INSERT INTO users (username, password, role, group_id) VALUES (?, ?, 'group_admin', ?)").run(username, hashSecret(password), groupId);
}

ensureGroupUser("klasse8b", "Buehne-8B-47!", group8BId);
ensureGroupUser("klasse8c", "Buehne-8C-83!", group8CId);

function migrateStoredSecrets() {
  const users = db.prepare("SELECT id, password FROM users").all() as { id: number; password: string }[];
  const updateUser = db.prepare("UPDATE users SET password = ? WHERE id = ?");
  for (const user of users) {
    if (user.password && !isHashedSecret(user.password)) {
      updateUser.run(hashSecret(user.password), user.id);
    }
  }

  const scanner = db.prepare("SELECT value FROM settings WHERE key = 'scanner_password'").get() as { value: string } | undefined;
  if (scanner?.value && !isHashedSecret(scanner.value)) {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'scanner_password'").run(hashSecret(scanner.value));
  }
}

migrateStoredSecrets();

// Email Helper - supports multiple tickets in one email
async function sendTicketEmail(tickets: any[]) {
  if (!tickets || tickets.length === 0) return;
  const firstTicket = tickets[0];

  console.log(`[email] sending booking confirmation (${tickets.length} ticket(s))`);

  const emailUser = db.prepare("SELECT value FROM settings WHERE key = 'email_user'").get() as { value: string } | undefined;
  const emailPass = db.prepare("SELECT value FROM settings WHERE key = 'email_pass'").get() as { value: string } | undefined;
  // Use per-show location instead of global settings
  const venueNameVal = firstTicket.location_name || "";
  const venueAddressVal = firstTicket.location_address || "";

  const user = emailUser?.value || process.env.GMX_EMAIL;
  const pass = emailPass?.value || process.env.GMX_PASSWORD;
  
  const show = db.prepare("SELECT * FROM shows WHERE id = ?").get(firstTicket.show_id) as any;
  const entryOffset = show?.entry_offset ?? 30;
  const groupLabel = firstTicket.group_name || firstTicket.section_title || show?.section_title || "Theatergruppe";
  
  function calculateEntryTime(showTime: string, offsetMin: number): string {
    const [h, m] = showTime.split(':').map(Number);
    const d = new Date(0, 0, 0, h, m);
    d.setMinutes(d.getMinutes() - (offsetMin || 0));
    return d.toTimeString().slice(0, 5);
  }
  const entryTime = calculateEntryTime(firstTicket.show_time, entryOffset);

  if (!user || !pass) {
    console.error("[email] skipped: email credentials are not configured");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "mail.gmx.net",
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  const formattedDate = new Date(firstTicket.show_date).toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // Generate QR buffers for each ticket
  const qrBuffers: (Buffer | null)[] = [];
  for (const t of tickets) {
    try {
      const buf = await QRCode.toBuffer(t.code, {
        width: 600, 
        margin: 2,
        color: { dark: "#09090b", light: "#ffffff" },
      });
      qrBuffers.push(buf);
      console.log(`[email] QR code generated for ${t.code}`);
    } catch (e) {
      qrBuffers.push(null);
      console.error(`[email] QR code failed for ${t.code}`, e);
    }
  }

  // Build per-ticket HTML blocks
  const ticketSections = tickets.map((t, i) => {
    const cid = `qrcode-${i + 1}@stagepass`;
    const qrImg = qrBuffers[i]
      ? `<img src="cid:${cid}" width="220" height="220" alt="QR-Code" style="display:block;border:0;width:220px;height:220px;" />`
      : `<div style="width:220px;height:220px;background:#f4f4f5;text-align:center;line-height:220px;color:#a1a1aa;font-size:12px;">QR-Code</div>`;

    return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;margin:0 auto 32px auto;">
      <tr><td>

        <!-- Ticket header -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#18181b;border:1px solid #27272a;border-bottom:0;border-radius:16px 16px 0 0;">
          <tr><td style="padding:24px 24px 0 24px;">
            <!-- STAGEPASS + Kategorie -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;">
              <tr>
                <td valign="middle">
                  <span style="font-size:16px;font-weight:900;letter-spacing:4px;color:#ffffff;text-transform:uppercase;font-family:Arial,sans-serif;">STAGE</span><span style="font-size:16px;font-weight:900;letter-spacing:4px;color:#52525b;text-transform:uppercase;font-family:Arial,sans-serif;">PASS</span>
                </td>
                <td align="right" valign="middle">
                  <span style="font-size:8px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:block;margin-bottom:4px;">Kategorie</span>
                  <span style="font-size:9px;font-weight:700;color:#d4d4d8;background:#2c2c2e;border:1px solid #3f3f46;padding:4px 10px;border-radius:5px;text-transform:uppercase;letter-spacing:1px;">${t.ticket_type === 'child' ? 'Kind' : 'Erwachsen'}</span>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="padding:0 24px;">
            <div style="color:#ffffff;font-size:22px;font-weight:900;line-height:1.25;letter-spacing:-0.5px;margin-bottom:6px;font-family:Arial,sans-serif;">${t.show_title}</div>
            ${entryOffset > 0 ? `<div style="color:#71717a;font-size:13px;font-weight:500;margin-bottom:20px;font-family:Arial,sans-serif;">Einlass ab ${entryTime} Uhr</div>` : `<div style="height:16px;"></div>`}
          </td></tr>

          <tr><td style="padding:0 24px;">
            <div style="height:1px;background:#27272a;"></div>
          </td></tr>

          <!-- Data grid -->
          <tr><td style="padding:20px 24px 24px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="50%" valign="top" style="padding-bottom:16px;">
                  <div style="font-size:8px;color:#52525b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;font-family:Arial,sans-serif;">Datum</div>
                  <div style="font-size:14px;color:#f4f4f5;font-weight:600;font-family:Arial,sans-serif;">${formattedDate}</div>
                </td>
                <td width="50%" valign="top" style="padding-bottom:16px;">
                  <div style="font-size:8px;color:#52525b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;font-family:Arial,sans-serif;">Uhrzeit</div>
                  <div style="font-size:14px;color:#f4f4f5;font-weight:600;font-family:Arial,sans-serif;">${t.show_time} Uhr</div>
                </td>
              </tr>
              <tr>
                <td width="50%" valign="top">
                  <div style="font-size:8px;color:#52525b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;font-family:Arial,sans-serif;">Name</div>
                  <div style="font-size:14px;color:#f4f4f5;font-weight:600;font-family:Arial,sans-serif;">${t.customer_name}</div>
                </td>
                <td width="50%" valign="top">
                  <div style="font-size:8px;color:#52525b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;font-family:Arial,sans-serif;">Zahlung</div>
                  <div style="font-size:14px;color:#f4f4f5;font-weight:600;font-family:Arial,sans-serif;">${Number(t.show_price).toFixed(2).replace('.', ',')} &euro; BAR</div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- Perforated tear -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border-left:1px solid #27272a;border-right:1px solid #27272a;">
          <tr>
            <td width="20" height="32" style="background:#09090b;border-radius:0 16px 16px 0;border-top:1px solid #27272a;border-bottom:1px solid #27272a;border-right:1px solid #27272a;mso-line-height-rule:exactly;line-height:32px;"></td>
            <td style="border-top:2px dashed #d4d4d8;mso-line-height-rule:exactly;line-height:30px;">&nbsp;</td>
            <td width="20" height="32" style="background:#09090b;border-radius:16px 0 0 16px;border-top:1px solid #27272a;border-bottom:1px solid #27272a;border-left:1px solid #27272a;mso-line-height-rule:exactly;line-height:32px;"></td>
          </tr>
        </table>

        <!-- QR section -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:1px solid #e4e4e7;border-top:0;border-radius:0 0 16px 16px;">
          <tr><td style="padding:20px 24px 28px;text-align:center;">
            <div style="font-size:8px;color:#a1a1aa;text-transform:uppercase;letter-spacing:3px;font-weight:700;margin-bottom:20px;font-family:Arial,sans-serif;">Am Einlass vorzeigen</div>

            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px auto;">
              <tr><td style="padding:12px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
                ${qrImg}
              </td></tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;">
              <tr><td style="padding:14px;text-align:center;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:900;color:#18181b;letter-spacing:10px;">${t.code}</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:9px;color:#a1a1aa;letter-spacing:2px;margin-top:5px;font-weight:600;text-transform:uppercase;">ID: ${t.id.toString().padStart(6, '0')}</div>
              </td></tr>
            </table>
          </td></tr>
        </table>

      </td></tr>
    </table>`;
  }).join("");

  const totalPrice = tickets.reduce((sum: number, t: any) => sum + (t.show_price || 0), 0).toFixed(2).replace(".", ",");

  const publicDomain = process.env.PUBLIC_DOMAIN || "theaterprojektklasse8.store";
  const stornoUrl = `https://${publicDomain}/stornieren`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <title>Buchungsbestätigung - StagePass</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#09090b;">
  <tr><td align="center" style="padding:40px 16px 48px 16px;">

    <!-- max-width wrapper -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;">
      <tr><td>

        <!-- StagePass logo -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:36px;">
          <tr><td align="center">
            <div style="display:inline-block;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:10px 16px;margin-bottom:12px;">
              <span style="font-size:20px;line-height:1;">SP</span>
            </div>
            <div style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:6px;text-transform:uppercase;font-family:Arial,sans-serif;">StagePass</div>
          </td></tr>
        </table>

        <!-- Success header -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:36px;">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td width="52" height="52" align="center" style="background:#27272a;border:1px solid #3f3f46;border-radius:50%;width:52px;height:52px;line-height:52px;text-align:center;">
                <span style="color:#ffffff;font-size:22px;line-height:52px;">OK</span>
              </td></tr>
            </table>
            <div style="color:#ffffff;font-size:28px;font-weight:900;margin-bottom:8px;letter-spacing:-0.5px;font-family:Arial,sans-serif;">Buchung erfolgreich</div>
            <div style="display:inline-block;background:#ffffff;color:#09090b;border-radius:999px;padding:8px 16px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;font-family:Arial,sans-serif;">${groupLabel}</div>
            <div style="color:#71717a;font-size:14px;font-family:Arial,sans-serif;">Dein Platz ist gesichert.</div>
          </td></tr>
        </table>

        <!-- Ticket cards -->
        ${ticketSections}

        <!-- Info box -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#18181b;border:1px solid #27272a;border-radius:16px;margin-bottom:28px;">
          <tr><td style="padding:24px;">
            <div style="font-size:9px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:3px;margin-bottom:20px;font-family:Arial,sans-serif;">Wichtig f&uuml;r den Einlass</div>
            <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
              <div style="font-size:8px;color:#52525b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;font-family:Arial,sans-serif;">Gebucht f&uuml;r</div>
              <div style="color:#f4f4f5;font-size:18px;font-weight:900;font-family:Arial,sans-serif;">${groupLabel}</div>
            </div>

            <!-- Screenshot -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
              <tr>
                <td width="36" valign="top" style="padding-top:2px;"><span style="font-size:12px;color:#a1a1aa;font-weight:bold;">1</span></td>
                <td style="padding-left:10px;">
                  <div style="color:#e4e4e7;font-size:13px;font-weight:700;margin-bottom:3px;font-family:Arial,sans-serif;">Mache jetzt einen Screenshot</div>
                  <div style="color:#71717a;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">So hast du das Ticket auf dem Handy parat, auch ohne Internet.</div>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:#27272a;margin-bottom:20px;"></div>

            <!-- Backup -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
              <tr>
                <td width="36" valign="top" style="padding-top:2px;"><span style="font-size:12px;color:#a1a1aa;font-weight:bold;">2</span></td>
                <td style="padding-left:10px;">
                  <div style="color:#e4e4e7;font-size:13px;font-weight:700;margin-bottom:3px;font-family:Arial,sans-serif;">Ticket-Backup im Postfach</div>
                  <div style="color:#71717a;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">Diese Kopie wurde an <strong style="color:#a1a1aa;">${firstTicket.customer_email}</strong> gesendet.</div>
                </td>
              </tr>
            </table>

            ${venueNameVal ? `
            <div style="height:1px;background:#27272a;margin-bottom:20px;"></div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="36" valign="top" style="padding-top:2px;"><span style="font-size:12px;color:#a1a1aa;font-weight:bold;">Ort</span></td>
                <td style="padding-left:10px;">
                  <div style="color:#e4e4e7;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">${venueNameVal}</div>
                </td>
              </tr>
            </table>` : ''}
          </td></tr>
        </table>

        <!-- Storno button -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:40px;">
          <tr><td align="center">
            <a href="${stornoUrl}?code=${tickets[0].code}" target="_blank" style="display:inline-block;background:transparent;border:1px solid #27272a;color:#71717a;font-size:10px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;">Ticket stornieren</a>
          </td></tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td align="center" style="padding-top:28px;border-top:1px solid #1c1c1e;">
            <div style="color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:6px;font-family:Arial,sans-serif;">StagePass &middot; Hannes Schuler</div>
            <div style="color:#71717a;font-size:11px;line-height:1.7;font-family:Arial,sans-serif;max-width:420px;margin:0 auto;">
              Wenn dir diese Ticket-Webseite gef&auml;llt und du selbst einmal eine Webseite, ein Ticketsystem oder etwas Digitales brauchst, melde dich gern.
            </div>
            <div style="color:#52525b;font-size:10px;line-height:1.7;font-family:Arial,sans-serif;margin-top:6px;">Kontakt: <a href="mailto:han2612@gmx.de" style="color:#a1a1aa;text-decoration:none;">han2612@gmx.de</a></div>
            <div style="color:#3f3f46;font-size:9px;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;margin-top:8px;">&copy; ${new Date().getFullYear()} Hannes Schuler</div>
          </td></tr>
        </table>

      </td></tr>
    </table>

  </td></tr>
</table>
</body></html>`;

  const venueBlock = venueNameVal ? `\nOrt: ${venueNameVal}${venueAddressVal ? `, ${venueAddressVal}` : ""}${venueAddressVal ? `\nWegbeschreibung: ${(venueAddressVal || '').trim().startsWith('http') ? (venueAddressVal).trim() : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueAddressVal)}`}` : ""}` : "";
  const plainText = `STAGEPASS - BUCHUNGSBESTÄTIGUNG\n\nVielen Dank für deine Bestellung!\n\nGebucht für: ${groupLabel}\nVorstellung: ${firstTicket.show_title}\nDatum: ${formattedDate}, ${firstTicket.show_time} Uhr${venueBlock}\n\n${tickets.map((t: any, i: number) => `Ticket ${i + 1}: ${t.customer_name} | Code: ${t.code} | ${t.ticket_type === 'child' ? 'Kind' : 'Erwachsen'}`).join("\n")}\n\nGesamtbetrag: ${totalPrice} EUR (Barzahlung an der Abendkasse)\n\nTicket stornieren: ${stornoUrl}\n\n---\nStagePass - Hannes Schuler\nWenn dir diese Ticket-Webseite gefällt und du selbst einmal eine Webseite, ein Ticketsystem oder etwas Digitales brauchst, melde dich gern: han2612@gmx.de`;

  const attachments = qrBuffers
    .map((buf, i) => buf ? {
      filename: `ticket-${i + 1}-${tickets[i].code}.png`,
      content: buf,
      cid: `qrcode-${i + 1}@stagepass`,
      contentDisposition: "inline" as const,
      contentType: "image/png",
    } : null)
    .filter(Boolean);

  const subject = tickets.length === 1
    ? `Deine Buchungsbestätigung - ${firstTicket.show_title} (${firstTicket.code})`
    : `Deine ${tickets.length} Tickets - ${firstTicket.show_title}`;

  const mailOptions: any = {
    from: `"StagePass Theater" <${user}>`,
    to: firstTicket.customer_email,
    replyTo: user,
    subject,
    text: plainText,
    html,
    headers: { "X-Mailer": "StagePass Ticketing", "Precedence": "bulk", "X-Auto-Response-Suppress": "OOF" },
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[email] sent to ${firstTicket.customer_email} | ${info.messageId}`);
  } catch (error: any) {
    console.error(`[email] failed: ${error.message}`);
    if (error.code === "EAUTH") console.error("[email] GMX auth failed. Check SMTP/POP3/IMAP settings and credentials.");
  }
}

async function sendStornoCodeEmail(ticket: any, code: string) {
  const emailUser = (db.prepare("SELECT value FROM settings WHERE key = 'email_user'").get() as any)?.value || process.env.GMX_EMAIL;
  const emailPass = (db.prepare("SELECT value FROM settings WHERE key = 'email_pass'").get() as any)?.value || process.env.GMX_PASSWORD;
  if (!emailUser || !emailPass) return;
  const transporter = nodemailer.createTransport({ host: "mail.gmx.net", port: 587, secure: false, auth: { user: emailUser, pass: emailPass } });
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;padding:40px 10px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:400px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:32px 24px;text-align:center;border-bottom:1px solid #27272a;">
    <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:4px;">STAGE<span style="color:#71717a;">PASS</span></div>
    <div style="margin-top:12px;display:inline-block;background:#27272a;color:#d4d4d8;font-size:10px;font-weight:bold;letter-spacing:2px;padding:6px 14px;border-radius:4px;">STORNIERUNGSANFRAGE</div>
  </td></tr>
  <tr><td style="padding:32px 24px;">
    <p style="color:#e4e4e7;font-size:15px;line-height:1.7;margin:0 0 16px;">Du hast eine Stornierung für das Ticket von <strong>${ticket.customer_name}</strong> (${ticket.show_title}) angefragt.</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 12px;">Dein Bestätigungscode:</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:#ffffff;border-radius:12px;padding:16px 24px;">
        <div style="font-family:'Courier New',monospace;font-size:28px;font-weight:bold;letter-spacing:8px;color:#09090b;">${code.split("").join(" ")}</div>
      </div>
    </div>
    <p style="color:#71717a;font-size:12px;margin:0;text-align:center;">Dieser Code ist 15 Minuten gültig.</p>
  </td></tr>
</table>
<div style="color:#a1a1aa;font-size:11px;margin-top:24px;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;">StagePass &middot; Hannes Schuler</div>
<div style="color:#71717a;font-size:10px;line-height:1.6;margin:6px auto 0;text-align:center;max-width:360px;">Wenn dir diese Ticket-Webseite gef&auml;llt und du selbst etwas Digitales brauchst, melde dich gern: <a href="mailto:han2612@gmx.de" style="color:#a1a1aa;text-decoration:none;">han2612@gmx.de</a></div>
</td></tr></table></body></html>`;
  try {
    await transporter.sendMail({ from: `"StagePass" <${emailUser}>`, to: ticket.customer_email, subject: `Stornierungscode für Ticket ${ticket.code}`, html });
    console.log(`[email] cancellation code sent to ${ticket.customer_email}`);
  } catch (e: any) { console.error(`[email] cancellation code failed: ${e.message}`); }
}

async function sendStornoConfirmEmail(ticket: any) {
  const emailUser = (db.prepare("SELECT value FROM settings WHERE key = 'email_user'").get() as any)?.value || process.env.GMX_EMAIL;
  const emailPass = (db.prepare("SELECT value FROM settings WHERE key = 'email_pass'").get() as any)?.value || process.env.GMX_PASSWORD;
  if (!emailUser || !emailPass) return;
  const transporter = nodemailer.createTransport({ host: "mail.gmx.net", port: 587, secure: false, auth: { user: emailUser, pass: emailPass } });
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;padding:40px 10px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:400px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:32px 24px;text-align:center;border-bottom:1px solid #27272a;">
    <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:4px;">STAGE<span style="color:#71717a;">PASS</span></div>
    <div style="margin-top:12px;display:inline-block;background:#7f1d1d;color:#fca5a5;font-size:10px;font-weight:bold;letter-spacing:2px;padding:6px 14px;border-radius:4px;">TICKET STORNIERT</div>
  </td></tr>
  <tr><td style="padding:32px 24px;text-align:center;">
    <p style="color:#e4e4e7;font-size:15px;line-height:1.7;margin:0 0 12px;">Das Ticket <strong>${ticket.code}</strong> f&uuml;r <strong>${ticket.customer_name}</strong> (${ticket.show_title}) wurde erfolgreich storniert.</p>
    <p style="color:#a1a1aa;font-size:14px;margin:0;">Der Platz ist wieder freigegeben.</p>
  </td></tr>
</table>
<div style="color:#a1a1aa;font-size:11px;margin-top:24px;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;">StagePass &middot; Hannes Schuler</div>
<div style="color:#71717a;font-size:10px;line-height:1.6;margin:6px auto 0;text-align:center;max-width:360px;">Wenn dir diese Ticket-Webseite gef&auml;llt und du selbst etwas Digitales brauchst, melde dich gern: <a href="mailto:han2612@gmx.de" style="color:#a1a1aa;text-decoration:none;">han2612@gmx.de</a></div>
</td></tr></table></body></html>`;
  try {
    await transporter.sendMail({ from: `"StagePass" <${emailUser}>`, to: ticket.customer_email, subject: `Ticket ${ticket.code} wurde storniert`, html });
  } catch (e: any) { console.error(`[email] cancellation confirmation failed: ${e.message}`); }
}

// Auth helper: returns "admin", "scanner", or null
const getAuth = (username: string, password: string): AuthContext | null => {
  const cleanUsername = cleanText(username, 80);
  const cleanPassword = String(password || "");
  if (!cleanPassword) return null;

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(cleanUsername) as any;
  if (user && verifySecret(cleanPassword, user.password)) {
    const role: Role = user.role === "group_admin" ? "group_admin" : "admin";
    const group = user.group_id ? db.prepare("SELECT * FROM groups WHERE id = ?").get(user.group_id) as any : null;
    return { role, userId: user.id, username: user.username, groupId: user.group_id || undefined, groupName: group?.name };
  }

  const scannerPw = db.prepare("SELECT value FROM settings WHERE key = 'scanner_password'").get() as any;
  if (scannerPw?.value && verifySecret(cleanPassword, scannerPw.value)) return { role: "scanner" };
  return null;
};

const getRole = (username: string, password: string): Role | null => getAuth(username, password)?.role || null;

function requireAuth(req: express.Request, res: express.Response, allowGroupAdmin = false): AuthContext | null {
  const auth = getAuth(req.body.username, req.body.password);
  if (!auth || (auth.role !== "admin" && !(allowGroupAdmin && auth.role === "group_admin"))) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return auth;
}

function showScopeWhere(auth: AuthContext, alias = "s", contextGroupId?: unknown): string {
  const scopedGroupId = auth.role === "group_admin" ? auth.groupId : Number(contextGroupId || 0);
  return scopedGroupId ? ` AND ${alias}.group_id = ${Number(scopedGroupId)}` : "";
}

function canAccessShow(auth: AuthContext, showId: number): boolean {
  if (auth.role === "admin") return true;
  if (!auth.groupId) return false;
  const row = db.prepare("SELECT id FROM shows WHERE id = ? AND group_id = ?").get(showId, auth.groupId);
  return !!row;
}

function requireAdmin(req: express.Request, res: express.Response): boolean {
  const { username, password } = req.body || {};
  if (getRole(username, password) !== "admin") {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function requireStaff(req: express.Request, res: express.Response): boolean {
  const { username, password } = req.body || {};
  if (!getRole(username, password)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

const rateLimitStores = new Map<string, { count: number; resetAt: number }>();

function rateLimit(options: { windowMs: number; max: number; key?: (req: express.Request) => string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const baseKey = options.key?.(req) || req.ip || req.socket.remoteAddress || "unknown";
    const key = `${req.path}:${baseKey}`;
    const current = rateLimitStores.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStores.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: "Zu viele Versuche. Bitte warte kurz und probiere es erneut." });
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  // Keeps the in-memory limiter from growing forever on long-running servers.
  for (const [key, value] of rateLimitStores) {
    if (value.resetAt <= now) rateLimitStores.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

function setupUploads(app: express.Express, uploadsDir: string) {
  app.use("/uploads", express.static(uploadsDir));
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `show-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Nur JPEG, PNG, WebP und GIF erlaubt."));
      }
    },
  });
}

function mountPublicRoutes(app: express.Express) {
  // Public: show listing + ticket purchase
  app.get("/api/shows", (_req, res) => {
    const shows = db.prepare(`
      SELECT s.*, g.name as group_name
      FROM shows s
      LEFT JOIN groups g ON s.group_id = g.id
      ORDER BY s.section_key ASC, s.date ASC, s.time ASC, s.id ASC
    `).all();
    res.json(shows);
  });

  app.post("/api/tickets/purchase", rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }), async (req: express.Request, res: express.Response) => {
    const showId = Number(req.body.showId);
    const email = normalizeEmail(req.body.email);
    // tickets: [{ name, type }] where type = 'adult' | 'child'
    const ticketEntries: { name: string; type: 'adult' | 'child' }[] = req.body.tickets
      ? req.body.tickets.map((t: any) => ({
          name: cleanText(t.name, 120),
          type: t.type === "child" ? "child" : "adult",
        }))
      : req.body.name ? [{ name: cleanText(req.body.name, 120), type: 'adult' }] : [];

    if (!Number.isInteger(showId) || showId <= 0 || !email || ticketEntries.length === 0) {
      return res.status(400).json({ error: "Fehlende Felder: showId, email und tickets erforderlich." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." });
    }
    if (ticketEntries.some(t => !t.name || !["adult", "child"].includes(t.type))) {
      return res.status(400).json({ error: "Bitte gib für jedes Ticket einen Namen und eine gültige Kategorie an." });
    }
    const maxPerOrder = 5;
    if (ticketEntries.length > maxPerOrder) {
      return res.status(400).json({ error: `Maximal ${maxPerOrder} Tickets pro Bestellung erlaubt.` });
    }
    const show = db.prepare("SELECT * FROM shows WHERE id = ?").get(showId) as any;
    if (!show) return res.status(404).json({ error: "Vorstellung nicht gefunden." });
    if (show.sales_lock_after_start && showHasStarted(show)) {
      return res.status(400).json({ error: "Diese Vorstellung läuft bereits. Tickets können nicht mehr gebucht werden." });
    }
    if (show.available_seats < ticketEntries.length) {
      return res.status(400).json({ error: `Nur noch ${show.available_seats} Plätze verfügbar.` });
    }
    const limitSetting = db.prepare("SELECT value FROM settings WHERE key = 'ticket_limit_per_email'").get() as any;
    if (limitSetting?.value) {
      const limit = parseInt(limitSetting.value, 10);
      if (!isNaN(limit) && limit > 0) {
        const existing = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE customer_email = ? AND show_id = ? AND status != 'cancelled'").get(email, showId) as any;
        if (existing.count + ticketEntries.length > limit) {
          return res.status(400).json({ error: `Diese E-Mail-Adresse hat bereits ${existing.count} Ticket(s) für diese Vorstellung. Limit: ${limit}.` });
        }
      }
    }
    const generateCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let r = "";
      for (let i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
      return r;
    };
    try {
      const codes: string[] = [];
      for (const _ of ticketEntries) {
        let code = generateCode();
        while (db.prepare("SELECT id FROM tickets WHERE code = ?").get(code)) code = generateCode();
        codes.push(code);
      }
      let transactionError: string | null = null;
      const transaction = db.transaction(() => {
        // Re-check availability inside the transaction to prevent race conditions
        const freshShow = db.prepare("SELECT available_seats FROM shows WHERE id = ?").get(showId) as any;
        if (!freshShow || freshShow.available_seats < ticketEntries.length) {
          transactionError = `Nur noch ${freshShow?.available_seats ?? 0} Plätze verfügbar.`;
          return;
        }
        for (let i = 0; i < ticketEntries.length; i++) {
          db.prepare("INSERT INTO tickets (show_id, customer_name, customer_email, code, ticket_type) VALUES (?, ?, ?, ?, ?)").run(
            showId, ticketEntries[i].name, email, codes[i], ticketEntries[i].type
          );
        }
        db.prepare("UPDATE shows SET available_seats = available_seats - ? WHERE id = ?").run(ticketEntries.length, showId);
      });
      transaction();
      if (transactionError) return res.status(400).json({ error: transactionError });
      const ticketQuery = db.prepare(`
        SELECT t.*, s.title as show_title, s.date as show_date, s.time as show_time,
               s.price as show_price_adult, s.price_child as show_price_child,
               CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END as show_price,
               s.image_url, s.location_name, s.location_address, s.entry_offset,
               s.section_title, g.name as group_name
        FROM tickets t
        JOIN shows s ON t.show_id = s.id
        LEFT JOIN groups g ON s.group_id = g.id
        WHERE t.code = ?
      `);
      const purchasedTickets = codes.map(c => ticketQuery.get(c));
      sendTicketEmail(purchasedTickets).catch(err => console.error("[email] booking confirmation failed:", err));
      res.json({ tickets: purchasedTickets });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Kauf fehlgeschlagen" });
    }
  });

  app.get("/api/tickets/:code", rateLimit({ windowMs: 10 * 60 * 1000, max: 60 }), (req, res) => {
    const code = cleanText(req.params.code, 16).toUpperCase();
    const ticket = db.prepare(`
      SELECT t.id, t.code, t.customer_name, t.status, t.ticket_type,
             s.title as show_title, s.date as show_date, s.time as show_time, s.entry_offset,
             CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END as show_price
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.code = ? AND t.status != 'cancelled'
    `).get(code);
    if (!ticket) return res.status(404).json({ error: "Ticket nicht gefunden" });
    res.json(ticket);
  });

  // Stornierung: Schritt 1 - Code anfordern
  app.post("/api/tickets/cancel/request", rateLimit({ windowMs: 15 * 60 * 1000, max: 8 }), async (req: express.Request, res: express.Response) => {
    const code = cleanText(req.body.code, 16).toUpperCase();
    const email = normalizeEmail(req.body.email);
    if (!code || !email) return res.status(400).json({ error: "Code und E-Mail erforderlich." });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." });
    const ticket = db.prepare(`
      SELECT t.*, s.title as show_title FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.code = ?
    `).get(code) as any;
    if (!ticket) return res.status(404).json({ error: "Ticket nicht gefunden." });
    if (ticket.customer_email.toLowerCase() !== email.toLowerCase()) return res.status(403).json({ error: "E-Mail stimmt nicht überein." });
    if (ticket.status === "cancelled") return res.status(400).json({ error: "Dieses Ticket wurde bereits storniert." });
    if (ticket.status === "used") return res.status(400).json({ error: "Bereits eingescannte Tickets können nicht storniert werden." });
    const stornoCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000;
    db.prepare("UPDATE tickets SET storno_code = ?, storno_expires = ? WHERE code = ?").run(stornoCode, expires, ticket.code);
    await sendStornoCodeEmail(ticket, stornoCode);
    res.json({ success: true, name: ticket.customer_name });
  });

  // Stornierung: Schritt 2 - Bestätigen
  app.post("/api/tickets/cancel/confirm", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req: express.Request, res: express.Response) => {
    const code = cleanText(req.body.code, 16).toUpperCase();
    const stornoCode = cleanText(req.body.stornoCode, 12);
    if (!code || !stornoCode) return res.status(400).json({ error: "Fehlende Felder." });
    const ticket = db.prepare(`
      SELECT t.*, s.title as show_title FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.code = ?
    `).get(code) as any;
    if (!ticket) return res.status(404).json({ error: "Ticket nicht gefunden." });
    if (ticket.storno_code !== stornoCode) return res.status(400).json({ error: "Ungültiger Code." });
    if (!ticket.storno_expires || Date.now() > ticket.storno_expires) return res.status(400).json({ error: "Code abgelaufen. Bitte neu anfordern." });
    db.transaction(() => {
      db.prepare("UPDATE shows SET available_seats = MIN(total_seats, available_seats + 1) WHERE id = ?").run(ticket.show_id);
      db.prepare("DELETE FROM tickets WHERE code = ?").run(ticket.code);
    })();
    await sendStornoConfirmEmail(ticket);
    res.json({ success: true });
  });
}

function mountAdminRoutes(app: express.Express, upload: multer.Multer) {
  app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req: express.Request, res: express.Response) => {
    const { username, password } = req.body;
    const auth = getAuth(username, password);
    if (auth) {
      logActivity(req, auth, "login", "user", auth.userId || null);
      res.json({ success: true, role: auth.role, groupId: auth.groupId || null, groupName: auth.groupName || null });
    } else {
      logActivity(req, null, "login_failed", "user", username || null);
      res.status(401).json({ error: "Ungültige Anmeldedaten" });
    }
  });

  // Dashboard Stats
  app.post("/api/admin/stats", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const scope = showScopeWhere(auth, "s", req.body.contextGroupId);

    const totalTickets = db.prepare(`SELECT COUNT(*) as count FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.status != 'cancelled'${scope}`).get() as any;
    const usedTickets = db.prepare(`SELECT COUNT(*) as count FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.status = 'used'${scope}`).get() as any;
    const revenue = db.prepare(`
      SELECT SUM(CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END) as total
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.status = 'used'${scope}
    `).get() as any;
    
    const salesByDay = db.prepare(`
      SELECT date(t.created_at) as day, COUNT(*) as count 
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE 1=1${scope}
      GROUP BY day 
      ORDER BY day DESC 
      LIMIT 7
    `).all();

    const showStats = db.prepare(`
      SELECT s.id, s.title, s.total_seats, s.available_seats, 
             COUNT(CASE WHEN t.status != 'cancelled' THEN t.id END) as sold
      FROM shows s
      LEFT JOIN tickets t ON s.id = t.show_id
      WHERE 1=1${scope}
      GROUP BY s.id
    `).all();

    res.json({
      totalTickets: totalTickets.count,
      usedTickets: usedTickets.count,
      revenue: revenue.total || 0,
      salesByDay,
      showStats
    });
  });

  // Update Show
  app.post("/api/admin/shows/update", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { showId, title, description, price, price_child, time, date, total_seats, location_name, location_address, group_id, contextGroupId } = req.body;

    const show = db.prepare("SELECT * FROM shows WHERE id = ?").get(showId) as any;
    if (!show) return res.status(404).json({ error: "Vorstellung nicht gefunden." });
    if (!canAccessShow(auth, show.id)) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });

    const newTotalSeats = parseInt(total_seats, 10);
    const cleanTitle = cleanText(title, 180);
    const cleanDescription = cleanText(description, 1200);
    const adultPrice = Number(price);
    const childPrice = Number(price_child ?? 5.00);
    const entryOffset = Number(req.body.entry_offset ?? 30);
    const salesLockAfterStart = req.body.sales_lock_after_start ? 1 : 0;
    if (!cleanTitle || !isValidDate(date) || !isValidTime(time) || !Number.isInteger(newTotalSeats) || newTotalSeats < 0 || !Number.isFinite(adultPrice) || adultPrice < 0 || !Number.isFinite(childPrice) || childPrice < 0) {
      return res.status(400).json({ error: "Bitte prüfe Titel, Datum, Uhrzeit, Preise und Platzanzahl." });
    }
    // Recalculate available_seats: new_total minus however many active (non-cancelled) tickets exist
    const activeTickets = (db.prepare("SELECT COUNT(*) as count FROM tickets WHERE show_id = ? AND status != 'cancelled'").get(showId) as any).count;
    if (newTotalSeats < activeTickets) {
      return res.status(400).json({ error: `Es gibt bereits ${activeTickets} aktive Tickets. Die Platzanzahl kann nicht darunter liegen.` });
    }
    const newAvailableSeats = Math.max(0, newTotalSeats - activeTickets);

    const sanitizedLocationName = String(location_name || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
    const sanitizedLocationAddr = String(location_address || '').replace(/<[^>]*>/g, '').trim().slice(0, 300);
    const targetGroupId = auth.role === "admin" ? (Number(group_id) || Number(contextGroupId) || show.group_id || null) : auth.groupId;
    const presentation = groupPresentation(targetGroupId, targetGroupId ? "" : show.group_name);

    db.prepare(`
      UPDATE shows
      SET title = ?, description = ?, price = ?, price_child = ?, time = ?, date = ?, total_seats = ?, available_seats = ?, location_name = ?, location_address = ?, entry_offset = ?, sales_lock_after_start = ?, section_key = ?, section_title = ?, group_id = ?
      WHERE id = ?
    `).run(cleanTitle, cleanDescription, adultPrice, childPrice, time, date, newTotalSeats, newAvailableSeats, sanitizedLocationName, sanitizedLocationAddr, Number.isFinite(entryOffset) ? entryOffset : 30, salesLockAfterStart, presentation.sectionKey, presentation.sectionTitle, targetGroupId, showId);

    logActivity(req, auth, "show_update", "show", showId, { groupId: targetGroupId, title: cleanTitle });
    res.json({ success: true });
  });

  // Upload Image (kept for backward compat, not used by editor)
  app.post("/api/admin/upload", upload.single("image"), (req, res) => {
    const { username, password } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen" });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  });

  // Create Show
  app.post("/api/admin/shows/create", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { title, description, date, time, price, price_child, total_seats, location_name, location_address, group_id, contextGroupId } = req.body;
    try {
      const cleanTitle = cleanText(title, 180);
      const cleanDescription = cleanText(description, 1200);
      const totalSeats = parseInt(total_seats, 10);
      const adultPrice = Number(price);
      const childPrice = Number(price_child ?? 5.00);
      const entryOffset = Number(req.body.entry_offset ?? 30);
      const salesLockAfterStart = req.body.sales_lock_after_start ? 1 : 0;
      if (!cleanTitle || !isValidDate(date) || !isValidTime(time) || !Number.isInteger(totalSeats) || totalSeats < 1 || !Number.isFinite(adultPrice) || adultPrice < 0 || !Number.isFinite(childPrice) || childPrice < 0) {
        return res.status(400).json({ error: "Bitte prüfe Titel, Datum, Uhrzeit, Preise und Platzanzahl." });
      }
      const sanitizedLocationName = String(location_name || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
      const sanitizedLocationAddr = String(location_address || '').replace(/<[^>]*>/g, '').trim().slice(0, 300);
      const targetGroupId = auth.role === "admin" ? (Number(group_id) || Number(contextGroupId) || null) : auth.groupId;
      const presentation = groupPresentation(targetGroupId);
      const result = db.prepare(
        `INSERT INTO shows (title, date, time, description, price, price_child, total_seats, available_seats, image_url, location_name, location_address, entry_offset, sales_lock_after_start, section_key, section_title, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(cleanTitle, date, time, cleanDescription, adultPrice, childPrice, totalSeats, totalSeats, null, sanitizedLocationName, sanitizedLocationAddr, Number.isFinite(entryOffset) ? entryOffset : 30, salesLockAfterStart, presentation.sectionKey, presentation.sectionTitle, targetGroupId);
      logActivity(req, auth, "show_create", "show", result.lastInsertRowid, { groupId: targetGroupId, title: cleanTitle });
      res.json({ success: true, showId: result.lastInsertRowid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erstellen fehlgeschlagen" });
    }
  });

  // Delete Show
  app.post("/api/admin/shows/delete", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { showId } = req.body;
    if (!canAccessShow(auth, Number(showId))) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });
    const ticketCount = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE show_id = ?").get(showId) as any;
    if (ticketCount.count > 0) {
      return res.status(400).json({ error: `Diese Vorstellung hat ${ticketCount.count} verkaufte Tickets und kann nicht gelöscht werden.` });
    }
    db.prepare("DELETE FROM shows WHERE id = ?").run(showId);
    logActivity(req, auth, "show_delete", "show", showId);
    res.json({ success: true });
  });

  app.post("/api/admin/groups", (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const groups = db.prepare(`
      SELECT g.*, u.username,
             COUNT(DISTINCT s.id) as show_count,
             COUNT(CASE WHEN t.status != 'cancelled' THEN t.id END) as ticket_count
      FROM groups g
      LEFT JOIN users u ON u.group_id = g.id AND u.role = 'group_admin'
      LEFT JOIN shows s ON s.group_id = g.id
      LEFT JOIN tickets t ON t.show_id = s.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `).all();
    res.json(groups);
  });

  app.post("/api/admin/groups/save", (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const groupId = Number(req.body.groupId || 0);
    const name = cleanText(req.body.name, 100);
    const username = cleanText(req.body.groupUsername, 80);
    const password = String(req.body.groupPassword || "");
    if (!name || !username) return res.status(400).json({ error: "Name und Benutzername erforderlich." });
    if (!groupId && password.length < 10) return res.status(400).json({ error: "Neues Gruppenpasswort muss mindestens 10 Zeichen haben." });
    const presentation = groupPresentation(null, name);

    const savedGroupId = groupId
      ? groupId
      : Number(db.prepare("INSERT INTO groups (name, section_key, section_title) VALUES (?, ?, ?)").run(name, presentation.sectionKey, presentation.sectionTitle).lastInsertRowid);
    db.prepare("UPDATE groups SET name = ?, section_key = ?, section_title = ? WHERE id = ?").run(name, presentation.sectionKey, presentation.sectionTitle, savedGroupId);
    db.prepare("UPDATE shows SET section_key = ?, section_title = ? WHERE group_id = ?").run(presentation.sectionKey, presentation.sectionTitle, savedGroupId);

    const existingUser = db.prepare("SELECT id FROM users WHERE group_id = ? AND role = 'group_admin'").get(savedGroupId) as any;
    if (existingUser) {
      if (password) db.prepare("UPDATE users SET username = ?, password = ? WHERE id = ?").run(username, hashSecret(password), existingUser.id);
      else db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, existingUser.id);
    } else {
      db.prepare("INSERT INTO users (username, password, role, group_id) VALUES (?, ?, 'group_admin', ?)").run(username, hashSecret(password), savedGroupId);
    }

    logActivity(req, auth, groupId ? "group_update" : "group_create", "group", savedGroupId, { name, username });
    res.json({ success: true, groupId: savedGroupId });
  });

  app.post("/api/admin/users", (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.group_id, g.name as group_name
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
      ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.username ASC
    `).all();
    res.json(users);
  });

  app.post("/api/admin/users/save", (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const userId = Number(req.body.userId || 0);
    const username = cleanText(req.body.editUsername, 80);
    const password = String(req.body.editPassword || "");
    const role = req.body.editRole === "admin" ? "admin" : "group_admin";
    const groupId = role === "group_admin" ? Number(req.body.editGroupId || 0) : null;
    if (!username) return res.status(400).json({ error: "Benutzername erforderlich." });
    if (role === "group_admin" && !groupId) return res.status(400).json({ error: "Gruppen-User brauchen eine Gruppe." });
    if (!userId && password.length < 10) return res.status(400).json({ error: "Neues Passwort muss mindestens 10 Zeichen haben." });
    if (userId) {
      if (password) db.prepare("UPDATE users SET username = ?, password = ?, role = ?, group_id = ? WHERE id = ?").run(username, hashSecret(password), role, groupId, userId);
      else db.prepare("UPDATE users SET username = ?, role = ?, group_id = ? WHERE id = ?").run(username, role, groupId, userId);
    } else {
      db.prepare("INSERT INTO users (username, password, role, group_id) VALUES (?, ?, ?, ?)").run(username, hashSecret(password), role, groupId);
    }
    logActivity(req, auth, userId ? "user_update" : "user_create", "user", userId || username, { role, groupId });
    res.json({ success: true });
  });

  app.post("/api/admin/owner/analytics", (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const loginTimeline = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM audit_logs
      WHERE action = 'login'
      GROUP BY day
      ORDER BY day ASC
      LIMIT 30
    `).all();
    const userActivity = db.prepare(`
      SELECT username, role, group_id,
             COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
             COUNT(*) as actions,
             MAX(created_at) as last_seen
      FROM audit_logs
      WHERE username IS NOT NULL
      GROUP BY username, role, group_id
      ORDER BY last_seen DESC
    `).all();
    const actionBreakdown = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
      LIMIT 20
    `).all();
    const recentActivity = db.prepare(`
      SELECT a.*, g.name as group_name
      FROM audit_logs a
      LEFT JOIN groups g ON a.group_id = g.id
      ORDER BY a.created_at DESC
      LIMIT 60
    `).all();
    const groupActivity = db.prepare(`
      SELECT g.id, g.name,
             COUNT(CASE WHEN a.action = 'login' THEN 1 END) as logins,
             COUNT(a.id) as actions,
             MAX(a.created_at) as last_seen
      FROM groups g
      LEFT JOIN audit_logs a ON a.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `).all();
    const groupLoginTimeline = db.prepare(`
      SELECT date(a.created_at) as day, g.name as group_name, COUNT(*) as count
      FROM audit_logs a
      LEFT JOIN groups g ON a.group_id = g.id
      WHERE a.action = 'login' AND a.group_id IS NOT NULL
      GROUP BY day, a.group_id
      ORDER BY day ASC
    `).all();
    const groupBookingTimeline = db.prepare(`
      SELECT date(t.created_at) as day, g.name as group_name, COUNT(*) as count
      FROM tickets t
      JOIN shows s ON t.show_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE t.status != 'cancelled'
      GROUP BY day, s.group_id
      ORDER BY day ASC
    `).all();
    const ticketBuyerActivity = db.prepare(`
      SELECT t.customer_email, COUNT(*) as tickets, MAX(t.created_at) as last_booking,
             GROUP_CONCAT(DISTINCT COALESCE(g.name, 'Ohne Gruppe')) as groups
      FROM tickets t
      JOIN shows s ON t.show_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE t.status != 'cancelled'
      GROUP BY t.customer_email
      ORDER BY tickets DESC, last_booking DESC
      LIMIT 30
    `).all();
    res.json({ loginTimeline, userActivity, actionBreakdown, recentActivity, groupActivity, groupLoginTimeline, groupBookingTimeline, ticketBuyerActivity });
  });

  app.post("/api/admin/vip/list", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const contextGroupId = auth.role === "admin" ? Number(req.body.contextGroupId || 0) : auth.groupId;
    const rows = db.prepare(`
      SELECT v.*, g.name as group_name, s.title as show_title, s.date as show_date, s.time as show_time
      FROM vip_tickets v
      LEFT JOIN groups g ON v.group_id = g.id
      LEFT JOIN shows s ON v.show_id = s.id
      WHERE (? = 0 OR v.group_id = ?)
      ORDER BY v.created_at DESC
    `).all(contextGroupId || 0, contextGroupId || 0);
    res.json({ vipTickets: rows });
  });

  app.post("/api/admin/vip/generate", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const contextGroupId = auth.role === "admin" ? Number(req.body.contextGroupId || 0) : auth.groupId;
    if (!contextGroupId) return res.status(400).json({ error: "Bitte zuerst eine Gruppe auswählen." });
    const showId = Number(req.body.showId || 0) || null;
    if (showId && !canAccessShow({ ...auth, role: auth.role === "admin" ? "admin" : auth.role, groupId: contextGroupId }, showId)) {
      return res.status(403).json({ error: "Kein Zugriff auf diese Vorstellung." });
    }
    const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(contextGroupId) as any;
    const label = cleanText(req.body.label, 120) || `VIP ${group?.name || ""}`.trim();
    let code = generateVipCode();
    while (db.prepare("SELECT id FROM vip_tickets WHERE code = ?").get(code) || db.prepare("SELECT id FROM tickets WHERE code = ?").get(code)) code = generateVipCode();
    const result = db.prepare("INSERT INTO vip_tickets (group_id, show_id, label, code, created_by) VALUES (?, ?, ?, ?, ?)").run(contextGroupId, showId, label, code, auth.userId || null);
    logActivity(req, auth, "vip_generate", "vip_ticket", result.lastInsertRowid, { groupId: contextGroupId, showId, code });
    res.json({ success: true, vip: { id: result.lastInsertRowid, group_id: contextGroupId, show_id: showId, label, code, active: 1 } });
  });

  app.post("/api/admin/vip/delete", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const vipId = Number(req.body.vipId || 0);
    const contextGroupId = auth.role === "admin" ? Number(req.body.contextGroupId || 0) : auth.groupId;
    const vip = db.prepare("SELECT * FROM vip_tickets WHERE id = ?").get(vipId) as any;
    if (!vip) return res.status(404).json({ error: "VIP-Ticket nicht gefunden." });
    if (auth.role === "group_admin" && vip.group_id !== auth.groupId) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });
    if (auth.role === "admin" && contextGroupId && vip.group_id !== contextGroupId) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });
    db.prepare("DELETE FROM vip_tickets WHERE id = ?").run(vipId);
    logActivity(req, auth, "vip_delete", "vip_ticket", vipId, { groupId: vip.group_id, code: vip.code });
    res.json({ success: true });
  });

  // Email Settings
  app.post("/api/admin/email-settings", (req, res) => {
    const { username, password, emailUser, emailPass } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('email_user', ?)").run(emailUser);
    if (emailPass) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('email_pass', ?)").run(emailPass);
    }

    res.json({ success: true });
  });

  app.post("/api/admin/email-settings/get", (req, res) => {
    const { username, password } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });

    const emailUser = db.prepare("SELECT value FROM settings WHERE key = 'email_user'").get() as any;
    
    res.json({ 
      emailUser: emailUser?.value || "",
      hasPassword: !!db.prepare("SELECT value FROM settings WHERE key = 'email_pass'").get()
    });
  });

  app.post("/api/admin/scan", rateLimit({ windowMs: 60 * 1000, max: 180 }), (req, res) => {
    const { username, password } = req.body;
    const code = cleanText(req.body.code, 32).toUpperCase();
    const auth = getAuth(username, password);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    const vip = db.prepare(`
      SELECT v.*, g.name as group_name, s.title as show_title, s.date as show_date, s.time as show_time
      FROM vip_tickets v
      LEFT JOIN groups g ON v.group_id = g.id
      LEFT JOIN shows s ON v.show_id = s.id
      WHERE v.code = ? AND v.active = 1
    `).get(code) as any;
    if (vip) {
      if (auth.role === "group_admin" && vip.group_id !== auth.groupId) {
        return res.status(403).json({ status: "error", error: "Dieses VIP-Ticket gehört zu einer anderen Gruppe." });
      }
      logActivity(req, auth, "vip_scan", "vip_ticket", vip.id, { groupId: vip.group_id, code: vip.code });
      return res.json({
        status: "success",
        ticket: {
          id: `VIP-${vip.id}`,
          code: vip.code,
          customer_name: vip.label,
          show_title: vip.show_title || `VIP ${vip.group_name || ""}`,
          show_date: vip.show_date || new Date().toISOString(),
          show_time: vip.show_time || "VIP",
          ticket_type: "VIP",
          show_price: 0,
        }
      });
    }

    // Universal Management Ticket Check
    const universalCodes = ["STAGEPASS-VIP", "MANAGEMENT-UNIVERSAL", "VIP-PASS", "VIP-ASS"];
    if (universalCodes.includes(code)) {
      return res.json({
        status: "success",
        ticket: {
          id: "VIP",
          code,
          customer_name: "MANAGEMENT (Universal Access)",
          show_title: "ALL ACCESS / FREE ENTRY",
          show_date: new Date().toISOString(),
          show_time: "ANY",
          ticket_type: "VIP",
          show_price: 0
        }
      });
    }

    const ticket = db.prepare(`
      SELECT t.*, s.title as show_title, s.date as show_date, s.time as show_time, s.entry_offset,
             s.group_id,
             CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END as show_price
      FROM tickets t
      JOIN shows s ON t.show_id = s.id
      WHERE t.code = ?
    `).get(code) as any;

    if (!ticket) {
      return res.status(404).json({ error: "Ticket nicht gefunden" });
    }
    if (auth.role === "group_admin" && ticket.group_id !== auth.groupId) {
      return res.status(403).json({ status: "error", error: "Dieses Ticket gehört zu einer anderen Gruppe." });
    }

    if (ticket.status === "cancelled") {
      return res.json({ status: "error", error: "Ticket wurde storniert und ist ungültig." });
    }

    if (ticket.status === "used") {
      // 30-second grace period: re-scan within 30s, then treat as valid (double-scan protection)
      if (ticket.scanned_at) {
        const scannedAtMs = new Date(ticket.scanned_at + 'Z').getTime(); // SQLite stores UTC without Z
        const secondsAgo = Math.floor((Date.now() - scannedAtMs) / 1000);
        if (secondsAgo <= 30) {
          return res.json({ status: 'recently_used', secondsAgo, ticket });
        }
      }
      return res.json({ status: "already_used", ticket });
    }

    db.prepare("UPDATE tickets SET status = 'used', scanned_at = datetime('now') WHERE code = ?").run(code);
    res.json({ status: "success", ticket: { ...ticket, status: "used" } });
  });

  // Change Admin Credentials
  app.post("/api/admin/change-credentials", rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), (req, res) => {
    const { username, password, newUsername, newPassword } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });
    const nextUsername = cleanText(newUsername, 80);
    const nextPassword = String(newPassword || "");
    if (!nextUsername || nextPassword.length < 10) return res.status(400).json({ error: "Neuer Benutzername und Passwort mit mindestens 10 Zeichen erforderlich." });
    try {
      db.prepare("UPDATE users SET username = ?, password = ? WHERE username = ?").run(nextUsername, hashSecret(nextPassword), username);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: alle Tickets auflisten
  app.post("/api/admin/tickets", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { showId, status, search, contextGroupId } = req.body;
    let query = `
      SELECT t.id, t.code, t.customer_name, t.customer_email, t.status, t.created_at, t.canceled_at, t.ticket_type, t.scanned_at,
             s.title as show_title, s.date as show_date, s.time as show_time, s.entry_offset, s.group_id,
             CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END as show_price, s.id as show_id
      FROM tickets t JOIN shows s ON t.show_id = s.id WHERE 1=1`;
    const params: any[] = [];
    if (showId) { query += " AND s.id = ?"; params.push(showId); }
    if (auth.role === "group_admin") { query += " AND s.group_id = ?"; params.push(auth.groupId); }
    else if (contextGroupId) { query += " AND s.group_id = ?"; params.push(Number(contextGroupId)); }
    if (status && status !== 'all') { query += " AND t.status = ?"; params.push(status); }
    if (search) { query += " AND (t.customer_name LIKE ? OR t.customer_email LIKE ? OR t.code LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += " ORDER BY t.created_at DESC";
    res.json(db.prepare(query).all(...params));
  });

  // Admin: einzelnes Ticket löschen
  app.post("/api/admin/tickets/delete", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { ticketId } = req.body;
    const ticket = db.prepare("SELECT t.*, s.group_id FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.id = ?").get(ticketId) as any;
    if (!ticket) return res.status(404).json({ error: "Nicht gefunden." });
    if (auth.role === "group_admin" && ticket.group_id !== auth.groupId) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });
    db.transaction(() => {
      if (ticket.status !== 'cancelled') {
        db.prepare("UPDATE shows SET available_seats = MIN(total_seats, available_seats + 1) WHERE id = ?").run(ticket.show_id);
      }
      db.prepare("DELETE FROM tickets WHERE id = ?").run(ticketId);
    })();
    logActivity(req, auth, "ticket_delete", "ticket", ticketId, { groupId: ticket.group_id });
    res.json({ success: true });
  });

  // Admin: Ticket-Status ändern (z.B. Stornierung rückgängig)
  app.post("/api/admin/tickets/status", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { ticketId, status } = req.body;
    if (!['valid', 'used', 'cancelled'].includes(status)) return res.status(400).json({ error: "Ungültiger Status." });
    const ticket = db.prepare("SELECT t.*, s.group_id FROM tickets t JOIN shows s ON t.show_id = s.id WHERE t.id = ?").get(ticketId) as any;
    if (!ticket) return res.status(404).json({ error: "Nicht gefunden." });
    if (auth.role === "group_admin" && ticket.group_id !== auth.groupId) return res.status(403).json({ error: "Kein Zugriff auf diese Gruppe." });
    try {
      db.transaction(() => {
      // Seat adjustment: cancelled tickets don't hold a seat; valid/used do
      const wasHoldingSeat = ticket.status !== 'cancelled';
      const willHoldSeat = status !== 'cancelled';
      if (wasHoldingSeat && !willHoldSeat) {
        db.prepare("UPDATE shows SET available_seats = available_seats + 1 WHERE id = ?").run(ticket.show_id);
      } else if (!wasHoldingSeat && willHoldSeat) {
        const show = db.prepare("SELECT available_seats FROM shows WHERE id = ?").get(ticket.show_id) as any;
        if (!show || show.available_seats <= 0) {
          throw new Error("Keine freien Plätze verfügbar.");
        }
        db.prepare("UPDATE shows SET available_seats = available_seats - 1 WHERE id = ?").run(ticket.show_id);
      }
        db.prepare("UPDATE tickets SET status = ?, canceled_at = ? WHERE id = ?").run(status, status === 'cancelled' ? new Date().toISOString() : null, ticketId);
      })();
      logActivity(req, auth, "ticket_status", "ticket", ticketId, { status, groupId: ticket.group_id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Statusänderung fehlgeschlagen." });
    }
  });

  // Enhanced stats (full analytics)
  app.post("/api/admin/stats/enhanced", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const scope = showScopeWhere(auth, "s", req.body.contextGroupId);

    // Per-show breakdown
    const perShow = db.prepare(`
      SELECT s.id, s.title, s.date, s.time, s.total_seats, s.available_seats,
        COUNT(t.id) as total_sold,
        SUM(CASE WHEN t.status = 'valid'     THEN 1 ELSE 0 END) as valid_count,
        SUM(CASE WHEN t.status = 'used'      THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN t.status = 'used' THEN (CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END) ELSE 0 END) as revenue
      FROM shows s LEFT JOIN tickets t ON s.id = t.show_id
      WHERE 1=1${scope}
      GROUP BY s.id ORDER BY s.date ASC
    `).all();

    // Recent bookings (last 30)
    const recentBookings = db.prepare(`
      SELECT t.id, t.code, t.customer_name, t.customer_email, t.status, t.created_at, t.ticket_type,
             s.title as show_title, s.date as show_date,
             CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END as show_price
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE 1=1${scope}
      ORDER BY t.created_at DESC LIMIT 30
    `).all();

    // Scan events - who was scanned and when
    const scanEvents = db.prepare(`
      SELECT t.id, t.code, t.customer_name, t.customer_email, t.scanned_at,
             s.title as show_title, s.date as show_date
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.status = 'used' AND t.scanned_at IS NOT NULL${scope}
      ORDER BY t.scanned_at DESC
    `).all();

    // Scan timeline: grouped by 15-minute slots for chart
    const scanTimeline = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:%M', scanned_at) as slot,
             COUNT(*) as count
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.status = 'used' AND t.scanned_at IS NOT NULL${scope}
      GROUP BY strftime('%Y-%m-%dT%H:%M', scanned_at)
      ORDER BY slot ASC
    `).all();

    // Booking timeline: grouped by hour
    const bookingTimeline = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:00', created_at) as slot,
             COUNT(*) as count
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE 1=1${scope}
      GROUP BY strftime('%Y-%m-%dT%H:00', created_at)
      ORDER BY slot ASC
    `).all();

    // Top email domains
    const emailDomains = db.prepare(`
      SELECT SUBSTR(customer_email, INSTR(customer_email, '@') + 1) as domain,
             COUNT(*) as count
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE 1=1${scope}
      GROUP BY domain
      ORDER BY count DESC LIMIT 10
    `).all();

    // Cancellations with timestamps
    const cancellations = db.prepare(`
      SELECT t.id, t.code, t.customer_name, t.customer_email, t.canceled_at, t.created_at,
             s.title as show_title
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.status = 'cancelled'${scope} ORDER BY t.canceled_at DESC
    `).all();

    // Aggregate totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN t.status = 'valid'     THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN t.status = 'used'      THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN t.status != 'cancelled' THEN (CASE WHEN t.ticket_type = 'child' THEN s.price_child ELSE s.price END) ELSE 0 END) as revenue_potential
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE 1=1${scope}
    `).get() as any;

    res.json({ 
      perShow, 
      recentBookings, 
      scanEvents, 
      scanTimeline, 
      bookingTimeline, 
      emailDomains, 
      cancellations, 
      totals,
      revenuePotential: totals.revenue_potential
    });
  });

  // Guest list for printing
  app.post("/api/admin/guestlist", (req, res) => {
    const auth = requireAuth(req, res, true);
    if (!auth) return;
    const { showId, contextGroupId } = req.body;
    let query = `
      SELECT t.id, t.code, t.customer_name, t.customer_email, t.status, t.created_at, t.scanned_at, t.ticket_type,
             s.title as show_title, s.date as show_date, s.time as show_time
      FROM tickets t JOIN shows s ON t.show_id = s.id
      WHERE t.status != 'cancelled'`;
    const params: any[] = [];
    if (showId) { query += " AND s.id = ?"; params.push(showId); }
    if (auth.role === "group_admin") { query += " AND s.group_id = ?"; params.push(auth.groupId); }
    else if (contextGroupId) { query += " AND s.group_id = ?"; params.push(Number(contextGroupId)); }
    query += " ORDER BY t.customer_name ASC";
    res.json(db.prepare(query).all(...params));
  });

  // Get general settings
  app.post("/api/admin/settings/get", (req, res) => {
    const { username, password } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });
    const scannerPw = db.prepare("SELECT value FROM settings WHERE key = 'scanner_password'").get() as any;
    const ticketLimit = db.prepare("SELECT value FROM settings WHERE key = 'ticket_limit_per_email'").get() as any;
    res.json({
      hasScannerPassword: !!scannerPw?.value,
      ticketLimitPerEmail: ticketLimit?.value || "",
    });
  });

  // Save general settings
  app.post("/api/admin/settings/save", (req, res) => {
    const { username, password, scannerPassword, ticketLimitPerEmail } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });
    if (scannerPassword !== undefined) {
      const nextScannerPassword = String(scannerPassword || "");
      if (nextScannerPassword && nextScannerPassword.length < 8) {
        return res.status(400).json({ error: "Scanner-Passwort muss mindestens 8 Zeichen haben." });
      }
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('scanner_password', ?)").run(nextScannerPassword ? hashSecret(nextScannerPassword) : "");
    }
    if (ticketLimitPerEmail !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ticket_limit_per_email', ?)").run(ticketLimitPerEmail);
    }
    res.json({ success: true });
  });

  // Admin: Reset all ticket data (delete all tickets, restore available_seats)
  app.post("/api/admin/reset-tickets", (req, res) => {
    const { username, password, confirmCode } = req.body;
    if (getRole(username, password) !== "admin") return res.status(401).json({ error: "Unauthorized" });
    if (confirmCode !== "RESET") return res.status(400).json({ error: "Bestätigungscode 'RESET' erforderlich." });
    db.transaction(() => {
      db.prepare("DELETE FROM tickets").run();
      // Restore available_seats = total_seats for all shows
      db.prepare("UPDATE shows SET available_seats = total_seats").run();
    })();
    console.log("[admin] all tickets deleted; available_seats restored");
    res.json({ success: true });
  });

}

let viteHmrPort = parseInt(process.env.VITE_HMR_PORT || "24678", 10);

async function attachSPA(app: express.Express) {
  if (process.env.NODE_ENV !== "production") {
    const hmrPort = viteHmrPort++;
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: hmrPort } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

async function startServers() {
  const uploadsDir = path.join(__dirname, "public", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Public server
  const publicApp = express();
  publicApp.set("trust proxy", 1);
  publicApp.use(express.json({ limit: "64kb" }));
  publicApp.get("/api/mode", (_req, res) => res.json({ admin: false }));
  setupUploads(publicApp, uploadsDir);
  mountPublicRoutes(publicApp);
  await attachSPA(publicApp);

  const PUBLIC_PORT = parseInt(process.env.PUBLIC_PORT || "3000", 10);
  publicApp.listen(PUBLIC_PORT, "0.0.0.0", () => {
    console.log(`\n[server] public: http://localhost:${PUBLIC_PORT}`);
    getLanUrls(PUBLIC_PORT).forEach(url => console.log(`[server] public LAN: ${url}`));
  });

  // Admin server
  const adminApp = express();
  adminApp.set("trust proxy", 1);
  adminApp.use(express.json({ limit: "64kb" }));
  adminApp.get("/api/mode", (_req, res) => res.json({ admin: true }));
  const upload = setupUploads(adminApp, uploadsDir);
  mountPublicRoutes(adminApp);
  mountAdminRoutes(adminApp, upload);
  await attachSPA(adminApp);

  const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || "3001", 10);
  adminApp.listen(ADMIN_PORT, "0.0.0.0", async () => {
    console.log(`[server] admin:  http://localhost:${ADMIN_PORT}`);
    getLanUrls(ADMIN_PORT).forEach(url => console.log(`[server] admin LAN:  ${url}`));
    console.log(`[server] admin domain can point to port ${ADMIN_PORT}\n`);

    // SMTP-Check
    const emailUser = process.env.GMX_EMAIL;
    const emailPass = process.env.GMX_PASSWORD;
    if (emailUser && emailPass) {
      try {
        const t = nodemailer.createTransport({ host: "mail.gmx.net", port: 587, secure: false, auth: { user: emailUser, pass: emailPass } });
        await t.verify();
        console.log(`[email] GMX SMTP OK (${emailUser})\n`);
      } catch (err: any) {
        console.error(`[email] GMX SMTP failed: ${err.message}\n`);
      }
    } else {
      console.warn("[email] no GMX credentials in .env; email disabled.\n");
    }
  });
}

startServers();
