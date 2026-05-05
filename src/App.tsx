import React, { useState, useEffect } from 'react';
import { QRCode } from 'react-qrcode-logo';
import { Ticket, Show } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Ticket as TicketIcon,
  Calendar,
  Clock,
  User,
  Mail,
  Download,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  LayoutDashboard,
  LogOut,
  X,
  Settings,
  BarChart3,
  TrendingUp,
  Users,
  Euro,
  Edit3,
  Image as ImageIcon,
  Save,
  Plus,
  Trash2,
  Upload,
  Search,
  XCircle,
  ListChecks,
  Camera,
  Check,
  MapPin,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

// --- Components ---

const formatPrice = (value: number | null | undefined) => `${Number(value ?? 0).toFixed(2)} \u20ac`;
const backText = '\u2190 Zurück';
const isInitialAdminMode = () => (
  typeof window !== 'undefined' && ['3101', '8080'].includes(window.location.port)
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const variants: any = {
    primary: 'bg-white text-black hover:bg-white/90',
    secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/10',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'bg-transparent text-white/50 hover:text-white hover:bg-white/5',
  };
  return (
    <button 
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-6 py-3 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">{label}</label>
    <input 
      {...props}
      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors"
    />
  </div>
);

const TextArea = ({ label, ...props }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">{label}</label>
    <textarea 
      {...props}
      rows={4}
      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors resize-none"
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'booking' | 'ticket' | 'admin-login' | 'admin-dash' | 'cancel'>(() => isInitialAdminMode() ? 'admin-login' : 'home');
  const [adminTab, setAdminTab] = useState<'accounts' | 'scanner' | 'stats' | 'tickets' | 'editor' | 'email' | 'settings'>('scanner');
  const [adminRole, setAdminRole] = useState<'admin' | 'group_admin' | 'scanner' | null>(null);
  const [adminGroupId, setAdminGroupId] = useState<number | null>(null);
  const [ownerGroupId, setOwnerGroupId] = useState<number | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminUser, setAdminUser] = useState({ username: '', password: '' });
  const [scanResult, setScanResult] = useState<{ status: string; ticket?: any } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const isScanningRef = React.useRef(false);
  const [stats, setStats] = useState<any>(null);
  const [emailSettings, setEmailSettings] = useState({ emailUser: '', emailPass: '', hasPassword: false });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({ hasScannerPassword: false, ticketLimitPerEmail: '' });
  // Booking state
  const [bookingStep, setBookingStep] = useState(1);
  const [adultCount, setAdultCount] = useState(0);
  const [childCount, setChildCount] = useState(0);
  const [adultNames, setAdultNames] = useState<string[]>([]);
  const [childNames, setChildNames] = useState<string[]>([]);
  const [bookingEmail, setBookingEmail] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(() => isInitialAdminMode());
  // Storno state
  const [cancelStep, setCancelStep] = useState<1 | 2 | 3>(1);
  const [cancelCode, setCancelCode] = useState('');
  const [cancelEmail, setCancelEmail] = useState('');
  const [cancelStornoInput, setCancelStornoInput] = useState('');
  const [cancelTicketName, setCancelTicketName] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelExpiresAt, setCancelExpiresAt] = useState<number | null>(null);
  const [cancelTimeLeft, setCancelTimeLeft] = useState<number>(0);
  // Admin tickets tab state
  const [adminTickets, setAdminTickets] = useState<any[]>([]);
  const [adminTicketSearch, setAdminTicketSearch] = useState('');
  const [adminTicketFilter, setAdminTicketFilter] = useState<'all' | 'valid' | 'used' | 'cancelled'>('all');
  // Enhanced analytics state
  const [enhancedStats, setEnhancedStats] = useState<any>(null);
  // Guest list state
  const [guestList, setGuestList] = useState<any[] | null>(null);
  const [guestListShowId, setGuestListShowId] = useState<string>('');
  const [guestListLoading, setGuestListLoading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [quickAccount, setQuickAccount] = useState({ name: '', username: '', password: '' });
  const [quickAccountMsg, setQuickAccountMsg] = useState('');
  const [ownerAnalytics, setOwnerAnalytics] = useState<any>(null);
  const [vipTickets, setVipTickets] = useState<any[]>([]);
  const [vipForm, setVipForm] = useState({ label: '', showId: '' });
  const [vipMsg, setVipMsg] = useState('');

  // Helper for admission time
  const calculateAdmissionTime = (time: string, offset: number = 30) => {
    if (!time) return '--:--';
    const [h, m] = time.split(':').map(Number);
    const d = new Date(0, 0, 0, h, m);
    d.setMinutes(d.getMinutes() - offset);
    return d.toTimeString().slice(0, 5);
  };
  useEffect(() => {
    // Check URL path for /stornieren deep link with optional ?code=XXXX pre-fill
    const path = window.location.pathname.toLowerCase();
    if (path === '/stornieren' || path === '/stornieren/') {
      setView('cancel');
      const params = new URLSearchParams(window.location.search);
      const prefillCode = params.get('code');
      if (prefillCode) {
        setCancelCode(prefillCode.toUpperCase().slice(0, 4));
      }
      window.history.replaceState(null, '', '/');
    }

    fetch('/api/mode')
      .then(r => r.json())
      .then(data => {
        if (data.admin) {
          setIsAdminMode(true);
          setView('admin-login');
        }
      })
      .catch(() => {});
    fetchShows();
  }, []);

  const fetchShows = () => {
    fetch('/api/shows')
      .then(res => res.json())
      .then(setShows)
      .catch(err => console.error("fetchShows failed:", err));
  };

  const adminPayload = () => ({
    ...adminUser,
    contextGroupId: adminRole === 'admin' && ownerGroupId ? ownerGroupId : undefined,
  });

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser),
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const fetchEmailSettings = async () => {
    try {
      const res = await fetch('/api/admin/email-settings/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser),
      });
      const data = await res.json();
      setEmailSettings({ ...data, emailPass: '' });
    } catch (err) {
      console.error("Failed to fetch email settings", err);
    }
  };

  const fetchGeneralSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser),
      });
      if (res.ok) setGeneralSettings(await res.json());
    } catch (err) { console.error("fetchGeneralSettings failed:", err); }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminPayload()),
      });
      if (res.ok) setGroups(await res.json());
    } catch (err) { console.error("fetchGroups failed:", err); }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminPayload()),
      });
      if (res.ok) setAdminUsers(await res.json());
    } catch (err) { console.error("fetchAdminUsers failed:", err); }
  };

  const fetchOwnerAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/owner/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser),
      });
      if (res.ok) setOwnerAnalytics(await res.json());
    } catch (err) { console.error("fetchOwnerAnalytics failed:", err); }
  };

  const fetchVipTickets = async () => {
    try {
      const res = await fetch('/api/admin/vip/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminPayload()),
      });
      if (res.ok) {
        const data = await res.json();
        setVipTickets(Array.isArray(data) ? data : (data.vipTickets || []));
      }
    } catch (err) { console.error("fetchVipTickets failed:", err); }
  };

  const fetchAdminTickets = async (search = '', status = '') => {
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), search: search || undefined, status: status || undefined }),
      });
      if (res.ok) setAdminTickets(await res.json());
    } catch (err) { console.error("fetchAdminTickets failed:", err); }
  };

  const fetchEnhancedStats = async () => {
    try {
      const res = await fetch('/api/admin/stats/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminPayload()),
      });
      if (res.ok) setEnhancedStats(await res.json());
    } catch (err) { console.error("fetchEnhancedStats failed:", err); }
  };

  const fetchGuestList = async (showId = '') => {
    setGuestListLoading(true);
    try {
      const res = await fetch('/api/admin/guestlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), showId: showId || undefined }),
      });
      if (res.ok) setGuestList(await res.json());
    } catch (err) { console.error("fetchGuestList failed:", err); }
    setGuestListLoading(false);
  };

  useEffect(() => {
    if (view === 'admin-dash') {
      if (adminTab === 'accounts') { fetchGroups(); fetchAdminUsers(); fetchOwnerAnalytics(); }
      if (adminTab === 'stats') { fetchStats(); fetchEnhancedStats(); }
      if (adminTab === 'email') fetchEmailSettings();
      if (adminTab === 'settings') { fetchGeneralSettings(); fetchGroups(); fetchAdminUsers(); }
      if (adminTab === 'editor' && adminRole === 'admin') fetchGroups();
      if (adminTab === 'tickets') { fetchAdminTickets(); fetchVipTickets(); }
    }
  }, [view, adminTab, adminRole, ownerGroupId]);

  // Storno countdown timer - ticks every second while code is active
  useEffect(() => {
    if (!cancelExpiresAt || cancelStep !== 2) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((cancelExpiresAt - Date.now()) / 1000));
      setCancelTimeLeft(remaining);
      if (remaining <= 0) {
        setCancelError('Der Bestätigungscode ist abgelaufen. Bitte fordere einen neuen an.');
        setCancelStep(1);
        setCancelStornoInput('');
        setCancelExpiresAt(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cancelExpiresAt, cancelStep]);

  // Auto-dismiss scan result after 10 seconds
  const [scanAutoDismiss, setScanAutoDismiss] = useState<number>(0);
  useEffect(() => {
    if (!scanResult) { setScanAutoDismiss(0); return; }
    setScanAutoDismiss(10);
    const interval = setInterval(() => {
      setScanAutoDismiss(prev => {
        if (prev <= 1) { resetScanner(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scanResult !== null]);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adminUser,
          emailUser: emailSettings.emailUser,
          emailPass: emailSettings.emailPass
        }),
      });
      if (res.ok) {
        alert('E-Mail-Einstellungen gespeichert');
        fetchEmailSettings();
      }
    } catch (err) {
      alert('Speichern fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminRole(data.role);
        setAdminGroupId(data.groupId || null);
        setOwnerGroupId(null);
        if (data.role === 'admin') {
          setAdminTab('accounts');
          fetchGroups();
          fetchAdminUsers();
        } else if (data.role === 'scanner') {
          setAdminTab('scanner');
        } else {
          setAdminTab('stats');
        }
        setView('admin-dash');
      } else {
        alert('Ungültige Anmeldedaten');
      }
    } catch (err) {
      alert('Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShow = async (showData: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), ...showData }),
      });
      if (res.ok) {
        fetchShows();
        alert('Vorstellung erfolgreich aktualisiert');
      }
    } catch (err) {
      alert('Update fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShow = async (showData: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), ...showData }),
      });
      if (res.ok) {
        fetchShows();
        alert('Vorstellung erfolgreich erstellt');
      } else {
        const err = await res.json();
        alert(err.error || 'Erstellen fehlgeschlagen');
      }
    } catch (err) {
      alert('Erstellen fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShow = async (showId: number) => {
    if (!confirm('Möchtest du diese Vorstellung wirklich löschen?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shows/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), showId }),
      });
      if (res.ok) {
        fetchShows();
      } else {
        const err = await res.json();
        alert(err.error || 'Löschen fehlgeschlagen');
      }
    } catch (err) {
      alert('Löschen fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('username', adminUser.username);
    formData.append('password', adminUser.password);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (err) {
      console.error('Upload failed', err);
    }
    return null;
  };

  const handlePurchase = async () => {
    if (!selectedShow || adultCount + childCount < 1 || !bookingEmail || adultNames.length !== adultCount || childNames.length !== childCount || adultNames.some(n => !n.trim()) || childNames.some(n => !n.trim())) {
      alert('Bitte alle Felder ausfüllen.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShow.id,
          email: bookingEmail,
          tickets: [
            ...adultNames.map(n => ({ name: n.trim(), type: 'adult' as const })),
            ...childNames.map(n => ({ name: n.trim(), type: 'child' as const })),
          ],
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setTickets(result.tickets);
        setView('ticket');
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Kauf fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (code: string) => {
    if (isScanningRef.current || scanResult) return;
    if (!code || code.trim().length === 0) return;

    isScanningRef.current = true;
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), ...adminUser }),
      });
      const result = await res.json();
      setScanResult(result);
      setManualCode('');
    } catch (err) {
      console.error(err);
    } finally {
      isScanningRef.current = false;
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    isScanningRef.current = false;
  };

  const handleCancelRequest = async () => {
    if (!cancelCode.trim() || !cancelEmail.trim()) { setCancelError('Bitte alle Felder ausfüllen.'); return; }
    setCancelLoading(true); setCancelError('');
    try {
      const res = await fetch('/api/tickets/cancel/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cancelCode.trim().toUpperCase(), email: cancelEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCancelTicketName(data.name);
        setCancelStep(2);
        setCancelExpiresAt(Date.now() + 15 * 60 * 1000); // 15 min matching server expiry
      }
      else setCancelError(data.error);
    } catch { setCancelError('Netzwerkfehler.'); }
    finally { setCancelLoading(false); }
  };

  const handleCancelConfirm = async () => {
    if (!cancelStornoInput.trim()) { setCancelError('Bitte den Code eingeben.'); return; }
    setCancelLoading(true); setCancelError('');
    try {
      const res = await fetch('/api/tickets/cancel/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cancelCode.trim().toUpperCase(), stornoCode: cancelStornoInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setCancelStep(3); fetchShows(); }
      else setCancelError(data.error);
    } catch { setCancelError('Netzwerkfehler.'); }
    finally { setCancelLoading(false); }
  };

  const resetCancel = () => {
    setCancelStep(1); setCancelCode(''); setCancelEmail('');
    setCancelStornoInput(''); setCancelTicketName(''); setCancelError('');
    setCancelExpiresAt(null); setCancelTimeLeft(0);
  };

  const handleDeleteAdminTicket = async (ticketId: number) => {
    if (!confirm('Ticket wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      const res = await fetch('/api/admin/tickets/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), ticketId }),
      });
      if (res.ok) {
        fetchAdminTickets(adminTicketSearch, adminTicketFilter === 'all' ? '' : adminTicketFilter);
        fetchShows();
      }
    } catch (err) { console.error("handleDeleteAdminTicket failed:", err); }
  };

  const handleChangeTicketStatus = async (ticketId: number, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/tickets/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), ticketId, status: newStatus }),
      });
      if (res.ok) fetchAdminTickets(adminTicketSearch, adminTicketFilter === 'all' ? '' : adminTicketFilter);
    } catch (err) { console.error("handleChangeTicketStatus failed:", err); }
  };

  const handleQuickAccountCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAccountMsg('');
    try {
      const sectionTitle = quickAccount.name ? `Tickets für das Theaterstück der ${quickAccount.name}` : '';
      const res = await fetch('/api/admin/groups/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adminUser,
          name: quickAccount.name,
          groupUsername: quickAccount.username,
          groupPassword: quickAccount.password,
          section_title: sectionTitle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuickAccountMsg('Account erstellt.');
        setQuickAccount({ name: '', username: '', password: '' });
        fetchGroups();
        fetchAdminUsers();
      } else {
        setQuickAccountMsg(data.error || 'Account konnte nicht erstellt werden.');
      }
    } catch {
      setQuickAccountMsg('Netzwerkfehler.');
    }
  };

  const handleGenerateVip = async (e: React.FormEvent) => {
    e.preventDefault();
    setVipMsg('');
    try {
      const res = await fetch('/api/admin/vip/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), label: vipForm.label, showId: vipForm.showId || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setVipMsg(`VIP-Code erstellt: ${data.vip.code}`);
        setVipForm({ label: '', showId: '' });
        fetchVipTickets();
      } else {
        setVipMsg(data.error || 'VIP-Code konnte nicht erstellt werden.');
      }
    } catch {
      setVipMsg('Netzwerkfehler.');
    }
  };

  const handleDeleteVip = async (vip: any) => {
    if (!confirm(`VIP-Ticket "${vip.label}" wirklich löschen? Der QR-Code funktioniert danach nicht mehr.`)) return;
    setVipMsg('');
    try {
      const res = await fetch('/api/admin/vip/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminPayload(), vipId: vip.id }),
      });
      const data = await res.json();
      if (data.success) {
        setVipMsg('VIP-Ticket gelöscht.');
        fetchVipTickets();
      } else {
        setVipMsg(data.error || 'VIP-Ticket konnte nicht gelöscht werden.');
      }
    } catch {
      setVipMsg('Netzwerkfehler.');
    }
  };

  const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char));

  const openPrintWindow = (title: string, html: string) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Popup wurde blockiert. Bitte Popups für diese Seite erlauben.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const printGuestList = () => {
    if (!guestList) return;
    const rows = guestList.map((t: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(t.customer_name)}</strong><small>${escapeHtml(t.customer_email)}</small></td>
        <td class="code">${escapeHtml(t.code)}</td>
        <td>${escapeHtml(t.ticket_type === 'child' ? 'Kind' : 'Erwachsen')}</td>
        <td>${escapeHtml(t.show_title)}<small>${new Date(t.show_date).toLocaleDateString('de-DE')} · ${escapeHtml(t.show_time)} Uhr</small></td>
        <td>${t.status === 'used' ? 'Entwertet' : 'Gültig'}</td>
        <td class="check"></td>
      </tr>
    `).join('');
    openPrintWindow('Gästeliste', `<!doctype html><html lang="de"><head><meta charset="utf-8" />
      <title>Gästeliste</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: Arial, sans-serif; }
        header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
        h1 { margin: 0; font-size: 24px; letter-spacing: -0.02em; }
        .meta { color: #555; font-size: 12px; line-height: 1.5; text-align: right; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .12em; color: #555; border-bottom: 1px solid #111; padding: 7px 6px; }
        td { border-bottom: 1px solid #ddd; padding: 7px 6px; vertical-align: top; }
        tr:nth-child(even) { background: #f7f7f7; }
        small { display: block; color: #666; font-size: 9px; margin-top: 2px; }
        .code { font-family: "Courier New", monospace; font-weight: 700; letter-spacing: .18em; white-space: nowrap; }
        .check { width: 22px; height: 22px; border: 1px solid #999; }
      </style></head><body>
        <header>
          <div><h1>Gästeliste</h1><div class="meta" style="text-align:left;">StagePass · Einlasskontrolle</div></div>
          <div class="meta">Gedruckt am ${new Date().toLocaleString('de-DE')}<br />${guestList.length} Einträge</div>
        </header>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Typ</th><th>Vorstellung</th><th>Status</th><th>✓</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7">Keine Einträge</td></tr>'}</tbody>
        </table>
      </body></html>`);
  };

  const printVipCard = (vip: any) => {
    const canvas = document.querySelector(`[data-vip-card="${vip.id}"] canvas`) as HTMLCanvasElement | null;
    const qrData = canvas?.toDataURL('image/png') || '';
    const scope = vip.show_title ? `${vip.show_title} · ${vip.show_time || ''} Uhr` : (vip.group_name ? `Alle Vorstellungen · ${vip.group_name}` : 'Alle Vorstellungen');
    openPrintWindow('VIP-Karte', `<!doctype html><html lang="de"><head><meta charset="utf-8" />
      <title>VIP-Karte ${escapeHtml(vip.code)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: start center; color: #111; font-family: Arial, sans-serif; }
        .sheet-note { margin: 0 0 10mm; color: #666; font-size: 11px; text-align: center; }
        .card { width: 85.6mm; height: 54mm; border-radius: 4mm; overflow: hidden; border: 0.35mm solid #111; background: #111; color: white; page-break-inside: avoid; box-shadow: none; }
        .top { height: 31mm; padding: 5mm; background: linear-gradient(135deg, #151515, #2a210b); position: relative; }
        .brand { font-weight: 900; letter-spacing: .28em; font-size: 9px; text-transform: uppercase; color: #f5c451; }
        .badge { position: absolute; top: 5mm; right: 5mm; border: .25mm solid #f5c451; color: #f5c451; border-radius: 999px; padding: 1.5mm 2.5mm; font-size: 7px; font-weight: 900; letter-spacing: .12em; }
        h1 { margin: 8mm 0 1.5mm; font-size: 17px; line-height: 1; letter-spacing: -0.04em; }
        .scope { font-size: 8px; color: #d7c78f; line-height: 1.35; text-transform: uppercase; letter-spacing: .08em; }
        .bottom { height: 23mm; background: white; color: #111; display: grid; grid-template-columns: 21mm 1fr; gap: 3mm; padding: 3mm 5mm; align-items: center; }
        img { width: 19mm; height: 19mm; display: block; }
        .code { font-family: "Courier New", monospace; font-weight: 900; font-size: 13px; letter-spacing: .12em; }
        .hint { margin-top: 1.5mm; font-size: 7px; color: #555; text-transform: uppercase; letter-spacing: .1em; }
        @media print { .sheet-note { display: none; } body { display: block; } }
      </style></head><body>
        <p class="sheet-note">VIP-Karte im Standard-Kartenformat 85,6 × 54 mm. Beim Drucken auf “Tatsächliche Größe / 100%” stellen.</p>
        <section class="card">
          <div class="top">
            <div class="brand">StagePass</div>
            <div class="badge">VIP</div>
            <h1>${escapeHtml(vip.label || 'VIP-Karte')}</h1>
            <div class="scope">${escapeHtml(scope)}</div>
          </div>
          <div class="bottom">
            ${qrData ? `<img src="${qrData}" alt="QR" />` : '<div></div>'}
            <div><div class="code">${escapeHtml(vip.code)}</div><div class="hint">Nur für diese Gruppe gültig</div></div>
          </div>
        </section>
      </body></html>`);
  };

  const ticketSections = Array.from(
    shows.reduce((map, show) => {
      const key = show.group_id ? `group-${show.group_id}` : `side-${show.section_key === 'right' ? 'right' : 'left'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: show.group_name || (show.section_key === 'right' ? 'Rechte Sektion' : 'Linke Sektion'),
          title: show.section_title?.trim() || (show.group_name ? `Theaterstück der Klasse ${show.group_name}` : 'Theaterstück'),
          shows: [] as Show[],
        });
      }
      map.get(key)!.shows.push(show);
      return map;
    }, new Map<string, { key: string; label: string; title: string; shows: Show[] }>())
  ).map(([, section]) => section);
  const visibleTicketSections = ticketSections.filter(section => section.shows.length > 0);
  const singleTicketSection = visibleTicketSections.length === 1;
  const chartGroups = groups.slice(0, 6);
  const groupChartColors = ['#ffffff', '#f59e0b', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa'];
  const pivotTimeline = (rows: any[] = []) => {
    const byDay = new Map<string, any>();
    rows.forEach((row: any) => {
      const day = row.day;
      if (!byDay.has(day)) byDay.set(day, { day });
      byDay.get(day)[row.group_name || 'Ohne Gruppe'] = row.count || 0;
    });
    return Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  };
  const ownerLoginByGroupChart = pivotTimeline(ownerAnalytics?.groupLoginTimeline || []);
  const ownerBookingByGroupChart = pivotTimeline(ownerAnalytics?.groupBookingTimeline || []);

  const visibleAdminShows = adminRole === 'group_admin'
    ? shows.filter(show => show.group_id === adminGroupId)
    : adminRole === 'admin' && ownerGroupId
    ? shows.filter(show => show.group_id === ownerGroupId)
    : shows;

  const selectedOwnerGroup = ownerGroupId ? groups.find(group => group.id === ownerGroupId) : null;

  const renderShowCard = (show: Show) => {
    const soldOut = show.available_seats <= 0;
    const startsAt = new Date(`${show.date}T${show.time || '00:00'}:00`);
    const alreadyStarted = !!show.sales_lock_after_start && Number.isFinite(startsAt.getTime()) && Date.now() >= startsAt.getTime();
    const blocked = soldOut || alreadyStarted;
    return (
      <div
        key={show.id}
        className={`group border border-white/10 bg-white/[0.03] rounded-xl relative overflow-hidden transition-all ${blocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/[0.06] cursor-pointer'}`}
        onClick={() => { if (!blocked) { setSelectedShow(show); setView('booking'); } }}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_10.5rem] min-h-[140px]">
          <div className="min-w-0 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">Vorstellung</div>
              <div className="text-base sm:text-lg font-mono uppercase tracking-[0.1em] text-white/90 mt-2 leading-snug">{show.title}</div>
            </div>
            <div className="flex flex-wrap gap-6 mt-4">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">Datum</div>
                <div className="text-xs font-mono uppercase tracking-widest mt-1 text-white/60">
                  {new Date(show.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">Uhrzeit</div>
                <div className="text-xs font-mono uppercase tracking-widest mt-1 text-white/60">{show.time} Uhr</div>
              </div>
              {show.location_name && (
                <div className="hidden sm:block">
                  <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">Ort</div>
                  <div className="text-xs font-mono uppercase tracking-widest mt-1 text-white/60">{show.location_name}</div>
                </div>
              )}
            </div>
          </div>

          <div className="relative h-0 xl:h-auto xl:w-0 flex items-stretch">
            <div className="hidden xl:block border-l border-dashed border-white/15 my-4" />
            <div className="hidden xl:block absolute -top-[13px] left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#050505] border border-white/10 z-10" />
            <div className="hidden xl:block absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#050505] border border-white/10 z-10" />
          </div>

          <div className="border-t xl:border-t-0 xl:border-l border-white/10 p-5 sm:p-6 flex flex-row xl:flex-col justify-between gap-5">
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-5 xl:gap-0">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">Erwachsene</div>
                <div className="text-xl sm:text-2xl font-mono mt-1 text-white/90 font-bold whitespace-nowrap">{formatPrice(show.price)}</div>
              </div>
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30 xl:mt-2">Kinder</div>
                <div className="text-xl sm:text-2xl font-mono mt-1 text-white/90 font-bold whitespace-nowrap">{formatPrice(show.price_child ?? 5)}</div>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/30">{'Pl\u00e4tze'}</div>
              {blocked ? (
                <div className="text-xs font-mono uppercase tracking-widest mt-1 text-red-400 font-bold">{alreadyStarted ? 'Läuft bereits' : 'Ausverkauft'}</div>
              ) : (
                <div className="text-xs font-mono uppercase tracking-widest mt-1 text-white/60">{show.available_seats} frei</div>
              )}
            </div>
          </div>
        </div>

        {blocked ? (
          <div className="border-t border-white/5 px-5 sm:px-6 py-3 flex items-center justify-center">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400/60 text-center">{alreadyStarted ? 'Vorstellung läuft bereits' : 'Keine Plätze mehr verfügbar'}</span>
          </div>
        ) : (
          <div className="border-t border-white/5 px-5 sm:px-6 py-3 flex items-center justify-between xl:opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">Ticket reservieren</span>
            <ChevronRight size={14} className="text-white/40" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-white selection:text-black">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-8 py-6 sm:py-12 max-w-7xl mx-auto gap-4">
        <div
          className="flex items-center gap-3 sm:gap-6 cursor-pointer group"
          onClick={() => setView('home')}
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border border-white/10 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
            <TicketIcon size={20} className="text-white/50" strokeWidth={1.5} />
          </div>
          <div className="text-xl sm:text-3xl font-mono tracking-tight">StagePass</div>
        </div>
        <div className="flex gap-6 items-center w-full sm:w-auto">
          {view === 'admin-dash' ? (
            <div className="flex items-center gap-2 sm:gap-4 bg-white/5 p-1 rounded-full border border-white/10 overflow-x-auto w-full sm:w-auto">
              {([...(adminRole === 'admin' ? ['accounts'] : []), ...(adminRole === 'scanner' ? ['scanner'] : []), ...((adminRole === 'admin' || adminRole === 'group_admin') ? ['stats', 'tickets', 'editor'] : []), ...(adminRole === 'admin' ? ['email', 'settings'] : [])] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { if (tab === 'accounts') setOwnerGroupId(null); setAdminTab(tab as any); }}
                  className={`px-3 sm:px-4 py-2 rounded-full text-[9px] sm:text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${adminTab === tab ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                  {tab === 'accounts' ? 'Accounts' : tab === 'scanner' ? 'Scanner' : tab === 'stats' ? 'Statistik' : tab === 'tickets' ? 'Tickets' : tab === 'editor' ? 'Editor' : tab === 'email' ? 'E-Mail' : 'Einstellungen'}
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-1 sm:mx-2 shrink-0" />
              <button
                onClick={() => {
                  setAdminUser({ username: '', password: '' });
                  setAdminRole(null);
                  setAdminGroupId(null);
                  setOwnerGroupId(null);
                  setView(isAdminMode ? 'admin-login' : 'home');
                }}
                className="pr-2 sm:pr-4 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors flex items-center gap-2 font-bold shrink-0"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : null}
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pb-16 sm:pb-32">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              {/* Hero */}
              <div className="text-center space-y-5 pt-16 pb-20 md:pt-24 md:pb-28">
                <div className="flex justify-center mb-6">
                  <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center">
                    <TicketIcon size={22} className="text-white/30" strokeWidth={1} />
                  </div>
                </div>
                <h1 className="text-6xl sm:text-7xl md:text-8xl font-serif tracking-tight leading-[0.93]">
                  Reserviere<br />deinen Platz.
                </h1>
                <p className="text-white/40 text-lg sm:text-xl font-serif italic">Ein Abend, den du nicht vergisst.</p>
              </div>

              {/* Ticket-stub show sections */}
              <div className={`w-full grid grid-cols-1 gap-8 lg:gap-10 items-start ${singleTicketSection ? 'max-w-3xl mx-auto' : 'max-w-7xl lg:grid-cols-2'}`}>
                {visibleTicketSections.map((section) => (
                  <section key={section.key} className={`min-w-0 space-y-4 ${singleTicketSection ? 'w-full' : ''}`}>
                    <div className="px-1 space-y-2">
                      {!singleTicketSection && <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/25">{section.label}</div>}
                      <h2 className="text-2xl sm:text-3xl font-serif tracking-tight text-white/90 leading-tight">
                        {section.title}
                      </h2>
                    </div>
                    <div className="space-y-4">
                      {section.shows.map(renderShowCard)}
                    </div>
                  </section>
                ))}
              </div>

              {/* Storno button - only on public port */}
              {!isAdminMode && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => { resetCancel(); setView('cancel'); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/40 hover:text-white/70 transition-all text-xs font-mono uppercase tracking-widest"
                  >
                    <XCircle size={14} />
                    Ticket stornieren
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'cancel' && (
            <motion.div
              key="cancel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto pt-12"
            >
              <div className="glass p-6 sm:p-10 rounded-2xl space-y-8">
                <div className="space-y-3">
                  <Button variant="ghost" className="w-fit px-4 py-2 text-xs uppercase tracking-widest" onClick={() => { resetCancel(); setView('home'); }}>{backText}</Button>
                  <h2 className="text-3xl font-bold tracking-tight">Ticket stornieren</h2>
                  <p className="text-white/40 text-sm">{'Ein Best\u00e4tigungscode wird an deine E-Mail-Adresse gesendet.'}</p>
                </div>

                {cancelError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{cancelError}</div>
                )}

                <AnimatePresence mode="wait">
                  {cancelStep === 1 && (
                    <motion.div key="cs1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      <Input label="Ticket-Code (4 Zeichen)" value={cancelCode} onChange={(e: any) => setCancelCode(e.target.value.toUpperCase())} placeholder="z.B. AB3K" maxLength={4} />
                      <Input label="E-Mail der Buchung" type="email" value={cancelEmail} onChange={(e: any) => setCancelEmail(e.target.value)} placeholder="deine@email.de" />
                      <Button className="w-full py-4" disabled={cancelLoading} onClick={handleCancelRequest}>
                        {cancelLoading ? 'Wird geprüft...' : 'Bestätigungscode anfordern'}
                      </Button>
                    </motion.div>
                  )}
                  {cancelStep === 2 && (
                    <motion.div key="cs2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
                        Code an <strong className="text-white/80">{cancelEmail}</strong> gesendet.<br/>Ticket: <strong className="text-white/80">{cancelTicketName}</strong>
                      </div>
                      {cancelTimeLeft > 0 && (
                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                          <span className="text-xs text-white/40 uppercase tracking-widest font-bold">{'Code g\u00fcltig f\u00fcr'}</span>
                          <span className={`font-mono text-sm font-bold tracking-wider ${cancelTimeLeft < 120 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {Math.floor(cancelTimeLeft / 60)}:{(cancelTimeLeft % 60).toString().padStart(2, '0')} min
                          </span>
                        </div>
                      )}
                      <Input label="6-stelliger Bestätigungscode" value={cancelStornoInput} onChange={(e: any) => setCancelStornoInput(e.target.value)} placeholder="123456" maxLength={6} />
                      <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => { setCancelStep(1); setCancelError(''); setCancelExpiresAt(null); }}>{backText}</Button>
                        <Button className="flex-1 py-4" disabled={cancelLoading || cancelTimeLeft <= 0} onClick={handleCancelConfirm}>
                          {cancelLoading ? 'Verarbeite...' : 'Ticket stornieren'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                  {cancelStep === 3 && (
                    <motion.div key="cs3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Ticket storniert</h3>
                        <p className="text-white/40 text-sm mt-2">Eine Bestätigung wurde an deine E-Mail gesendet.</p>
                      </div>
                      <Button className="w-full py-4" onClick={() => { resetCancel(); setView('home'); }}>Zurück zur Startseite</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {view === 'booking' && selectedShow && (
            <motion.div
              key="booking"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-xl mx-auto pt-8 sm:pt-12"
            >
              <div className="glass p-5 sm:p-10 rounded-3xl space-y-8">
                <div className="space-y-3">
                  <Button variant="ghost" className="w-fit px-4 py-2 text-xs uppercase tracking-widest" onClick={() => { setView('home'); setBookingStep(1); setAdultCount(0); setChildCount(0); setAdultNames([]); setChildNames([]); setBookingEmail(''); }}>
                    {backText}
                  </Button>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{selectedShow.title}</h2>
                  <p className="text-white/40 text-sm">
                    {new Date(selectedShow.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })} · {selectedShow.time} Uhr · Erw. {formatPrice(selectedShow.price)} · Kind {formatPrice(selectedShow.price_child ?? 5)}
                  </p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${bookingStep >= 1 ? 'bg-white text-black' : 'bg-white/10 text-white/30'}`}>1</div>
                  <div className="flex-1 h-px bg-white/10" />
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${bookingStep >= 2 ? 'bg-white text-black' : 'bg-white/10 text-white/30'}`}>2</div>
                </div>

                <AnimatePresence mode="wait">
                  {bookingStep === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Tickets auswählen</div>

                        {/* Adult counter */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div>
                            <div className="text-sm font-bold">Erwachsene</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">ab 18 · {formatPrice(selectedShow.price)}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => { const n = Math.max(0, adultCount - 1); setAdultCount(n); setAdultNames(prev => prev.slice(0, n)); }}
                              disabled={adultCount === 0}
                              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-30"
                            >−</button>
                            <span className="text-2xl font-bold w-8 text-center">{adultCount}</span>
                            <button
                              onClick={() => { if (adultCount + childCount >= 5) return; const n = adultCount + 1; setAdultCount(n); setAdultNames(prev => [...prev, '']); }}
                              disabled={adultCount + childCount >= 5}
                              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>

                        {/* Child counter */}
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div>
                            <div className="text-sm font-bold">Kinder</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">unter 18 · {formatPrice(selectedShow.price_child ?? 5)}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => { const n = Math.max(0, childCount - 1); setChildCount(n); setChildNames(prev => prev.slice(0, n)); }}
                              disabled={childCount === 0}
                              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-30"
                            >−</button>
                            <span className="text-2xl font-bold w-8 text-center">{childCount}</span>
                            <button
                              onClick={() => { if (adultCount + childCount >= 5) return; const n = childCount + 1; setChildCount(n); setChildNames(prev => [...prev, '']); }}
                              disabled={adultCount + childCount >= 5}
                              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>

                        <p className="text-[10px] text-white/20 uppercase tracking-widest">max. 5 Tickets · Barzahlung am Einlass</p>
                      </div>
                      <Button className="w-full py-4" disabled={adultCount + childCount < 1} onClick={() => setBookingStep(2)}>
                        {adultCount + childCount < 1 ? 'Bitte Ticket auswählen' : 'Weiter → Namen eingeben'}
                      </Button>
                    </motion.div>
                  )}

                  {bookingStep === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="space-y-5">
                        {adultCount > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs uppercase tracking-widest text-white/40 font-bold">
                              Erwachsene · {formatPrice(selectedShow.price)} je
                            </div>
                            {Array.from({ length: adultCount }).map((_, i) => (
                              <div key={`a${i}`} className="flex gap-2 items-center">
                                <input
                                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors"
                                  value={adultNames[i] || ''}
                                  onChange={(e: any) => setAdultNames(prev => { const a = [...prev]; a[i] = e.target.value; return a; })}
                                  placeholder={adultCount > 1 ? `Erwachsene ${i + 1}` : 'Name des Gastes'}
                                />
                                <span className="text-sm font-mono text-white/40 shrink-0 w-20 text-right">{formatPrice(selectedShow.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {childCount > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs uppercase tracking-widest text-white/40 font-bold">
                              Kinder · {formatPrice(selectedShow.price_child ?? 5)} je
                            </div>
                            {Array.from({ length: childCount }).map((_, i) => (
                              <div key={`c${i}`} className="flex gap-2 items-center">
                                <input
                                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors"
                                  value={childNames[i] || ''}
                                  onChange={(e: any) => setChildNames(prev => { const a = [...prev]; a[i] = e.target.value; return a; })}
                                  placeholder={childCount > 1 ? `Kind ${i + 1}` : 'Name des Kindes'}
                                />
                                <span className="text-sm font-mono text-white/40 shrink-0 w-20 text-right">{formatPrice(selectedShow.price_child ?? 5)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <Input
                          label="E-Mail für Bestätigung (alle Tickets)"
                          type="email"
                          value={bookingEmail}
                          onChange={(e: any) => setBookingEmail(e.target.value)}
                          placeholder="johannes@web.de"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => setBookingStep(1)}>{backText}</Button>
                        <Button className="flex-1 py-4" disabled={loading} onClick={handlePurchase}>
                          {loading ? 'Verarbeite...' : `${adultCount + childCount} Ticket${adultCount + childCount > 1 ? 's' : ''} reservieren`}
                        </Button>
                      </div>
                      <p className="text-center text-[10px] uppercase tracking-widest text-white/20">
                        Gesamt {formatPrice(adultCount * selectedShow.price + childCount * (selectedShow.price_child ?? 5))} · Barzahlung am Einlass
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {view === 'ticket' && tickets.length > 0 && (
            <motion.div
              key="ticket"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              id="ticket-content"
              className="w-full max-w-sm mx-auto pt-10 pb-10 px-5 flex flex-col items-center"
            >
              {/* ?? Success Header ?? */}
              <div className="text-center w-full mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">Buchung erfolgreich</h1>
                <p className="text-zinc-400 text-sm">Dein Platz ist gesichert.</p>
              </div>

              {/* ?? Ticket Cards ?? */}
              <div className="w-full space-y-8 mb-8">
                {tickets.map((t: any, i: number) => (
                  <div key={t.id} className="w-full" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}>

                    {/* TOP: dark info section */}
                    <div className="rounded-t-2xl p-6 border border-zinc-800 border-b-0" style={{ background: '#18181b' }}>
                      {/* Logo + Category */}
                      <div className="flex justify-between items-start mb-7">
                        <div className="font-bold tracking-widest text-base text-white">
                          STAGE<span className="text-zinc-500">PASS</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Kategorie</span>
                          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider px-2 py-1 rounded border border-zinc-700">
                            {t.ticket_type === 'child' ? 'Kind' : 'Erwachsen'}
                          </span>
                        </div>
                      </div>

                      {/* Show title + subtitle */}
                      <h2 className="text-[22px] font-black leading-tight text-white mb-1 tracking-tight">{t.show_title}</h2>
                      <p className="text-zinc-400 text-sm mb-6">
                      {tickets.length > 1 ? `Ticket ${i + 1} von ${tickets.length}` : ''}
                      {(t.entry_offset ?? 30) > 0
                        ? `${tickets.length > 1 ? ' · ' : ''}Einlass ab ${calculateAdmissionTime(t.show_time, t.entry_offset ?? 30)} Uhr`
                        : ''}
                      </p>

                      {/* Divider */}
                      <div className="border-t border-zinc-800 mb-5" />

                      {/* 2?2 data grid */}
                      <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Datum</p>
                          <p className="font-semibold text-sm text-zinc-100">
                            {new Date(t.show_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Uhrzeit</p>
                          <p className="font-semibold text-sm text-zinc-100">{t.show_time} Uhr</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Name</p>
                          <p className="font-semibold text-sm text-zinc-100">{t.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Zahlung</p>
                    <p className="font-semibold text-sm text-zinc-100">{formatPrice(t.show_price)} BAR</p>
                        </div>
                      </div>
                    </div>

                    {/* ?? Perforated tear line ?? */}
                    {/* The half-circles poke OUT of the strip sides - they're bg-[#050505] to match the page */}
                    <div className="relative" style={{ height: '28px', background: '#fff' }}>
                      {/* left notch */}
                      <div className="absolute top-1/2 -translate-y-1/2 rounded-full z-10"
                        style={{ left: '-14px', width: '28px', height: '28px', background: '#050505' }} />
                      {/* dashed line */}
                      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 mx-5 border-t-2 border-dashed" style={{ borderColor: '#d4d4d8' }} />
                      {/* right notch */}
                      <div className="absolute top-1/2 -translate-y-1/2 rounded-full z-10"
                        style={{ right: '-14px', width: '28px', height: '28px', background: '#050505' }} />
                    </div>

                    {/* BOTTOM: white QR section */}
                    <div className="rounded-b-2xl p-6 pt-4 flex flex-col items-center" style={{ background: '#fff' }}>
                      <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mb-5">Am Einlass vorzeigen</p>

                      <div className="mb-5">
                        <QRCode
                          value={t.code}
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#09090b"
                          qrStyle="dots"
                          eyeRadius={8}
                          quietZone={8}
                        />
                      </div>

                      <div className="w-full text-center py-3 rounded-xl border" style={{ background: '#f4f4f5', borderColor: '#e4e4e7' }}>
                        <div className="font-mono text-2xl font-black text-zinc-900 tracking-[0.25em]">{t.code}</div>
                        <div className="font-mono text-[9px] text-zinc-400 tracking-widest mt-1 uppercase">ID: {t.id.toString().padStart(6, '0')}</div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* ?? Info box ?? */}
              <div className="w-full mb-6 rounded-2xl border border-zinc-800/80 p-5" style={{ background: '#18181b' }}>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Wichtig für den Einlass</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3 items-start">
                    <Camera className="w-5 h-5 mt-0.5 text-zinc-400 shrink-0" />
                    <div>
                      <span className="block text-sm font-medium text-zinc-200 mb-0.5">Mache jetzt einen Screenshot</span>
                      <span className="block text-xs text-zinc-500 leading-relaxed">
                        So hast du das Ticket auf dem Handy parat, auch ohne Internet.
                      </span>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start pt-4 border-t border-zinc-800/60">
                    <Mail className="w-5 h-5 mt-0.5 text-zinc-400 shrink-0" />
                    <div>
                      <span className="block text-sm font-medium text-zinc-200 mb-0.5">Backup im Postfach</span>
                      <span className="block text-xs text-zinc-500 leading-relaxed">
                  Bestätigung an <strong className="text-zinc-300">{tickets[0].customer_email}</strong> gesendet.
                      </span>
                    </div>
                  </li>
                  {(tickets[0] as any).location_name && (
                    <li className="flex gap-3 items-start pt-4 border-t border-zinc-800/60">
                      <MapPin className="w-5 h-5 mt-0.5 text-zinc-400 shrink-0" />
                      <span className="text-sm font-medium text-zinc-200">{(tickets[0] as any).location_name}</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* ?? Actions ?? */}
              <div className="w-full space-y-3">
                <button
                  onClick={() => { window.print(); setIsDownloaded(true); setTimeout(() => setIsDownloaded(false), 3000); }}
                  className="w-full font-semibold rounded-2xl py-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
                  style={{ background: isDownloaded ? '#27272a' : '#fff', color: isDownloaded ? '#fff' : '#09090b' }}
                >
                  {isDownloaded
                    ? <><Check className="w-5 h-5" /><span>PDF gespeichert</span></>
                    : <><Download className="w-5 h-5" /><span>Ticket als PDF speichern</span></>
                  }
                </button>
                <button
                        onClick={() => { setView('home'); setTickets([]); setBookingStep(1); setAdultCount(0); setChildCount(0); setAdultNames([]); setChildNames([]); setBookingEmail(''); }}
                  className="w-full font-semibold rounded-2xl py-4 text-zinc-400 border border-zinc-800 hover:bg-zinc-800/50 transition-colors active:scale-[0.98]"
                >
                  Zurück zur Startseite
                </button>
              </div>
            </motion.div>
          )}

          {view === 'admin-login' && (
            <motion.div 
              key="admin-login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm mx-auto pt-4 sm:pt-24 pb-16"
            >
              <div className="glass p-6 sm:p-12 rounded-3xl sm:rounded-[48px] space-y-8 sm:space-y-10">
                <div className="text-center space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Management</h2>
                  <p className="text-white/30 text-sm font-light">Anmeldung für Kontrolleure</p>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div className="space-y-4">
                    <Input 
                      label="Benutzername" 
                      value={adminUser.username}
                      onChange={(e: any) => setAdminUser({ ...adminUser, username: e.target.value })}
                      required
                    />
                    <Input 
                      type="password" 
                      label="Passwort" 
                      value={adminUser.password}
                      onChange={(e: any) => setAdminUser({ ...adminUser, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button disabled={loading} type="submit" className="w-full py-4">
                    {loading ? 'Anmelden...' : 'Login'}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'admin-dash' && (
            <motion.div 
              key="admin-dash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10 pt-8"
            >
              {adminTab === 'accounts' && adminRole === 'admin' && (
                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Owner-Konsole</div>
                      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Accounts auswählen</h2>
                      <p className="text-white/40 text-sm max-w-2xl">Wähle eine Klasse aus, um in deren Dashboard, Tickets und Editor zu wechseln. Ohne Auswahl bleibt der Owner in der Account-Verwaltung.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    {groups.map((group: any) => (
                      <button
                        key={group.id}
                        onClick={() => { setOwnerGroupId(group.id); setAdminTab('stats'); }}
                        className="glass p-7 rounded-[32px] text-left hover:bg-white/[0.06] transition-colors border border-white/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-2xl font-bold tracking-tight">{group.name}</div>
                            <div className="text-white/35 text-sm mt-1">{group.section_title || 'Keine Überschrift'}</div>
                          </div>
                          <ChevronRight size={20} className="text-white/30" />
                        </div>
                        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                          <div className="bg-white/5 rounded-2xl p-3">
                            <div className="text-xl font-bold">{group.show_count || 0}</div>
                            <div className="text-[9px] uppercase tracking-widest text-white/30">Shows</div>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-3">
                            <div className="text-xl font-bold">{group.ticket_count || 0}</div>
                            <div className="text-[9px] uppercase tracking-widest text-white/30">Tickets</div>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-3">
                            <div className="text-xs font-bold truncate">{group.username || '-'}</div>
                            <div className="text-[9px] uppercase tracking-widest text-white/30">Login</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleQuickAccountCreate} className="glass p-8 rounded-[36px] space-y-6 max-w-3xl">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight">Neuen Account anlegen</h3>
                      <p className="text-white/35 text-sm mt-1">Erstellt direkt eine Gruppe/Klasse plus Login.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Input label="Klasse/Gruppe" placeholder="z.B. 8D" value={quickAccount.name} onChange={(e: any) => setQuickAccount({ ...quickAccount, name: e.target.value })} required />
                      <Input label="Username" placeholder="z.B. klasse8d" value={quickAccount.username} onChange={(e: any) => setQuickAccount({ ...quickAccount, username: e.target.value })} required />
                      <Input label="Passwort" type="password" placeholder="Mindestens 10 Zeichen" value={quickAccount.password} onChange={(e: any) => setQuickAccount({ ...quickAccount, password: e.target.value })} required />
                      <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 flex items-center text-sm text-white/45">
                        Jede Gruppe bekommt auf der Landingpage ihren eigenen Ticket-Block.
                      </div>
                    </div>
                    {quickAccountMsg && <p className={`text-xs font-bold uppercase tracking-widest ${quickAccountMsg.includes('Fehler') || quickAccountMsg.includes('Netzwerk') || quickAccountMsg.includes('nicht') ? 'text-red-400' : 'text-emerald-400'}`}>{quickAccountMsg}</p>}
                    <Button type="submit" className="py-4"><Plus size={16} /> Account erstellen</Button>
                  </form>

                  <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Owner Analytics</div>
                        <h3 className="text-2xl font-bold tracking-tight mt-2">Logins & Nutzung</h3>
                      </div>
                      <div className="h-[220px]">
                        {ownerAnalytics?.loginTimeline?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ownerAnalytics.loginTimeline}>
                              <defs>
                                <linearGradient id="ownerLogins" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="day" stroke="#ffffff20" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} />
                              <YAxis stroke="#ffffff20" fontSize={9} width={24} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} />
                              <Area type="monotone" dataKey="count" name="Logins" stroke="#ffffff80" strokeWidth={2} fill="url(#ownerLogins)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/20 text-sm">Noch keine Login-Daten</div>
                        )}
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Aktionen</div>
                      <div className="space-y-3">
                        {ownerAnalytics?.actionBreakdown?.slice(0, 8).map((row: any) => (
                          <div key={row.action} className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-white/60">{row.action}</span>
                            <span className="font-mono text-white/90">{row.count}</span>
                          </div>
                        )) || <div className="text-white/20 text-sm">Noch keine Aktionen</div>}
                      </div>
                    </div>
                  </div>

                  <div className="grid xl:grid-cols-2 gap-6">
                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Klassen-Logins</div>
                        <h3 className="text-2xl font-bold tracking-tight mt-2">Login-Spikes pro Gruppe</h3>
                      </div>
                      <div className="h-[240px]">
                        {ownerLoginByGroupChart.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ownerLoginByGroupChart}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="day" stroke="#ffffff20" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} />
                              <YAxis stroke="#ffffff20" fontSize={9} width={24} allowDecimals={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} />
                              {chartGroups.map((group: any, index: number) => (
                                <Line key={group.id} type="monotone" dataKey={group.name} name={group.name} stroke={groupChartColors[index % groupChartColors.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/20 text-sm">Noch keine Gruppen-Logins</div>
                        )}
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Ticketkäufe</div>
                        <h3 className="text-2xl font-bold tracking-tight mt-2">Buchungen pro Tag</h3>
                      </div>
                      <div className="h-[240px]">
                        {ownerBookingByGroupChart.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ownerBookingByGroupChart}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="day" stroke="#ffffff20" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} />
                              <YAxis stroke="#ffffff20" fontSize={9} width={24} allowDecimals={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} />
                              {chartGroups.map((group: any, index: number) => (
                                <Line key={group.id} type="monotone" dataKey={group.name} name={group.name} stroke={groupChartColors[index % groupChartColors.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/20 text-sm">Noch keine Buchungen</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">User-Aktivität</div>
                      <div className="space-y-3">
                        {ownerAnalytics?.userActivity?.map((user: any) => (
                          <div key={`${user.username}-${user.role}`} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                            <div>
                              <div className="font-bold">{user.username}</div>
                              <div className="text-xs text-white/30">{user.role} · zuletzt {user.last_seen ? new Date(user.last_seen).toLocaleString('de-DE') : '-'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono">{user.logins || 0}</div>
                              <div className="text-[9px] uppercase tracking-widest text-white/25">Logins</div>
                            </div>
                          </div>
                        )) || <div className="text-white/20 text-sm">Noch keine User-Aktivität</div>}
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Top-Bucher</div>
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {ownerAnalytics?.ticketBuyerActivity?.map((buyer: any) => (
                          <div key={buyer.customer_email} className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                            <div className="min-w-0">
                              <div className="font-bold truncate">{buyer.customer_email}</div>
                              <div className="text-xs text-white/30">{buyer.groups || 'Ohne Gruppe'} · zuletzt {buyer.last_booking ? new Date(buyer.last_booking).toLocaleString('de-DE') : '-'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono">{buyer.tickets || 0}</div>
                              <div className="text-[9px] uppercase tracking-widest text-white/25">Tickets</div>
                            </div>
                          </div>
                        )) || <div className="text-white/20 text-sm">Noch keine Käuferdaten</div>}
                      </div>
                    </div>
                  </div>

                  <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Letzte Aktivitäten</div>
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {ownerAnalytics?.recentActivity?.slice(0, 20).map((event: any) => (
                          <div key={event.id} className="border-b border-white/5 pb-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-bold">{event.action}</div>
                              <div className="text-[10px] text-white/25">{new Date(event.created_at).toLocaleString('de-DE')}</div>
                            </div>
                            <div className="text-xs text-white/35 mt-1">{event.username || 'System'}{event.group_name ? ` · ${event.group_name}` : ''}</div>
                          </div>
                        )) || <div className="text-white/20 text-sm">Noch keine Aktivitäten</div>}
                      </div>
                  </div>
                </div>
              )}

              {adminRole === 'admin' && adminTab !== 'accounts' && selectedOwnerGroup && (
                <div className="glass rounded-[28px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Du arbeitest gerade als</div>
                    <div className="text-xl font-bold">{selectedOwnerGroup.name}</div>
                  </div>
                  <Button variant="secondary" onClick={() => { setOwnerGroupId(null); setAdminTab('accounts'); }}>
                    Accounts wechseln
                  </Button>
                </div>
              )}

              {adminRole === 'admin' && !ownerGroupId && ['stats', 'tickets', 'editor'].includes(adminTab) && (
                <div className="glass p-10 rounded-[40px] text-center space-y-4">
                  <div className="text-2xl font-bold">Wähle zuerst einen Account</div>
                  <p className="text-white/40 text-sm">Als Owner wechselst du zuerst in eine Klasse, bevor du Dashboard, Tickets oder Editor öffnest.</p>
                  <Button onClick={() => setAdminTab('accounts')}>Accounts öffnen</Button>
                </div>
              )}

              {adminTab === 'scanner' && (
                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Scanner & Kontrolle</div>
                      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Einlasskontrolle</h2>
                    </div>
                  </div>

                  <div className="max-w-xl mx-auto space-y-6">
                    {/* Scanner + Overlay */}
                    <div className="relative">
                      <div className="glass rounded-[16px] sm:rounded-[32px] overflow-hidden">
                        {!scanResult && <Scanner onScan={handleScan} />}
                      </div>

                      {/* Scan result overlay - covers scanner area */}
                      <AnimatePresence>
                        {scanResult && (
                          <motion.div
                            key="scan-overlay"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`rounded-[16px] sm:rounded-[32px] border-2 p-6 sm:p-8 ${
                              scanResult.status === 'success' || scanResult.status === 'recently_used' ? 'bg-[#071a0e] border-emerald-500/40' :
                              scanResult.status === 'already_used' ? 'bg-[#1a1508] border-amber-500/40' :
                              'bg-[#1a0808] border-red-500/40'
                            }`}
                          >
                            {/* Status header */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                {scanResult.status === 'success' || scanResult.status === 'recently_used' ? (
                                  <CheckCircle2 size={36} className="text-emerald-500" />
                                ) : scanResult.status === 'already_used' ? (
                                  <AlertCircle size={36} className="text-amber-500" />
                                ) : (
                                  <X size={36} className="text-red-500" />
                                )}
                                <div>
                                  <h3 className={`text-2xl sm:text-3xl font-black ${
                                    scanResult.status === 'success' || scanResult.status === 'recently_used' ? 'text-emerald-400' :
                                    scanResult.status === 'already_used' ? 'text-amber-400' : 'text-red-400'
                                  }`}>
                                    {scanResult.status === 'success' || scanResult.status === 'recently_used' ? 'Gültig' :
                                     scanResult.status === 'already_used' ? 'Bereits gescannt' : 'Ungültig'}
                                  </h3>
                                  <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
                                    scanResult.status === 'success' || scanResult.status === 'recently_used' ? 'text-emerald-500/70' :
                                    scanResult.status === 'already_used' ? 'text-amber-500/70' : 'text-red-500/70'
                                  }`}>
                                    {scanResult.status === 'success' ? 'Einlass gewährt' :
                                     scanResult.status === 'recently_used' ? `Bereits vor ${scanResult.secondsAgo}s entwertet` :
                                     scanResult.status === 'already_used' ? 'Ticket entwertet' :
                                     scanResult.error || 'Kein Datensatz'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-xs font-mono ${
                                  scanAutoDismiss <= 3 ? 'text-white/60' : 'text-white/25'
                                }`}>{scanAutoDismiss}s</div>
                              </div>
                            </div>

                            {/* Payment box (valid + recently re-scanned) */}
                            {(scanResult.status === 'success' || scanResult.status === 'recently_used') && scanResult.ticket && (
                              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-5 mb-5 text-center">
                                <div className="text-4xl sm:text-5xl font-black text-emerald-400">
                                  {scanResult.ticket.show_price != null ? formatPrice(scanResult.ticket.show_price).replace('.', ',') : '-'}
                                </div>
                                <div className="text-sm text-emerald-400/80 font-bold mt-1 uppercase tracking-widest">
                                  BAR KASSIEREN
                                </div>
                                <div className={`mt-4 inline-block px-4 py-2 rounded-xl border-2 font-black text-xs uppercase tracking-[0.2em] ${
                                  scanResult.ticket.ticket_type === 'child' 
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                                    : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                                }`}>
                                  {scanResult.ticket.ticket_type === 'child' ? 'KIND / SCHOOL' : 'ERWACHSEN / ADULT'}
                                </div>
                              </div>
                            )}

                            {/* Ticket details */}
                            {scanResult.ticket && (
                              <div className="space-y-4">
                                {/* Date & Time - LARGE and prominent */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                  <div className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Vorstellung am</div>
                                  <div className="text-2xl sm:text-3xl font-black tracking-tight">
                                    {scanResult.ticket.show_date ? new Date(scanResult.ticket.show_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }) : '-'}
                                    <span className="text-white/40 mx-2">·</span>
                                    {scanResult.ticket.show_time || '-'} Uhr
                                  </div>
                                </div>

                                {/* Name + Code row */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <div className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Besucher</div>
                                    <div className="text-lg sm:text-xl font-bold truncate">{scanResult.ticket.customer_name}</div>
                                  </div>
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <div className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold mb-1">Code</div>
                                    <div className="font-mono text-lg sm:text-xl font-bold tracking-[0.2em]">{scanResult.ticket.code}</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={resetScanner}
                              className={`w-full mt-5 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${
                                scanResult.status === 'success'
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400'
                                  : scanResult.status === 'already_used'
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400'
                                  : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400'
                              }`}
                            >
                              Nächstes Ticket scannen
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Manual code entry */}
                    {!scanResult && (
                      <div className="glass p-4 sm:p-6 rounded-[16px] sm:rounded-[32px] space-y-4">
                        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Manuelle Eingabe</div>
                        <div className="flex gap-3">
                          <input
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 font-mono text-xl sm:text-2xl tracking-[0.5em] uppercase focus:outline-none focus:border-white/30"
                            placeholder="CODE"
                            maxLength={4}
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter' && manualCode.length === 4) handleScan(manualCode); }}
                          />
                          <Button
                            className="px-6 sm:px-8"
                            onClick={() => handleScan(manualCode)}
                            disabled={manualCode.length !== 4}
                          >
                            Prüfen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'stats' && stats && (adminRole !== 'admin' || !!ownerGroupId) && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Analysen & Zahlen</div>
                      <h2 className="text-5xl font-bold tracking-tight">Dashboard</h2>
                    </div>
                    <Button variant="secondary" className="shrink-0" onClick={() => { fetchStats(); fetchEnhancedStats(); }}>
                      <TrendingUp size={16} /> Aktualisieren
                    </Button>
                  </div>

                  {/* Stats Grid - 6 cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="glass p-6 rounded-[32px] space-y-3">
                      <div className="bg-white/5 p-2.5 rounded-xl w-fit"><TicketIcon size={18} className="text-white/60" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter">{stats.totalTickets}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Gesamt</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] space-y-3">
                      <div className="bg-emerald-500/10 p-2.5 rounded-xl w-fit"><CheckCircle2 size={18} className="text-emerald-400" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-emerald-400">{enhancedStats?.totals?.valid ?? '-'}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Gültig</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] space-y-3">
                      <div className="bg-amber-500/10 p-2.5 rounded-xl w-fit"><Users size={18} className="text-amber-400" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-amber-400">{stats.usedTickets}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Eingecheckt</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] space-y-3">
                      <div className="bg-red-500/10 p-2.5 rounded-xl w-fit"><XCircle size={18} className="text-red-400" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-red-400">{enhancedStats?.totals?.cancelled ?? '-'}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Storniert</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] border border-emerald-500/20 space-y-3">
                      <div className="bg-emerald-500/10 p-2.5 rounded-xl w-fit"><Euro size={18} className="text-emerald-400" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-emerald-400">{formatPrice(stats.revenue).replace(',00', '').replace('.00', '')}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Einnahmen IST</div>
                        <div className="text-[8px] text-white/10 uppercase tracking-tighter font-bold">Nur entwertete Tickets</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] border border-white/5 space-y-3 opacity-60">
                      <div className="bg-white/5 p-2.5 rounded-xl w-fit"><Euro size={18} className="text-white/40" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter text-white/40">{enhancedStats?.revenuePotential ? formatPrice(enhancedStats.revenuePotential).replace(',00', '').replace('.00', '') : '-'}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/20 font-bold mt-0.5">Einnahmen Potentiell</div>
                        <div className="text-[8px] text-white/10 uppercase tracking-tighter font-bold">Alle Buchungen</div>
                      </div>
                    </div>
                    <div className="glass p-6 rounded-[32px] space-y-3">
                      <div className="bg-white/5 p-2.5 rounded-xl w-fit"><BarChart3 size={18} className="text-white/60" /></div>
                      <div>
                        <div className="text-3xl font-bold tracking-tighter">
                          {((stats.usedTickets / (stats.totalTickets || 1)) * 100).toFixed(0)}%
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Scan-Rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Charts row 1: booking timeline + scan timeline */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Buchungen (Zeitverlauf)</div>
                        <div className="text-xs text-white/20 mt-1">Wann haben Leute gebucht?</div>
                      </div>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.salesByDay.slice().reverse()}>
                            <defs>
                              <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="day" stroke="#ffffff20" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} />
                            <YAxis stroke="#ffffff20" fontSize={9} width={24} />
                            <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} labelFormatter={(v) => new Date(v).toLocaleDateString('de-DE')} />
                            <Area type="monotone" dataKey="count" name="Buchungen" stroke="#ffffff80" strokeWidth={2} fillOpacity={1} fill="url(#cg1)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Scan-Timeline</div>
                        <div className="text-xs text-white/20 mt-1">Wann wurden Tickets entwertet?</div>
                      </div>
                      <div className="h-[220px] w-full">
                        {enhancedStats?.scanTimeline?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={enhancedStats.scanTimeline}>
                              <defs>
                                <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="slot" stroke="#ffffff20" fontSize={9} tickFormatter={(v) => v.slice(11, 16)} />
                              <YAxis stroke="#ffffff20" fontSize={9} width={24} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} itemStyle={{ color: '#10b981' }} labelFormatter={(v) => v.replace('T', ' ')} />
                              <Area type="step" dataKey="count" name="Scans" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#cg2)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/15 text-xs uppercase tracking-widest">Noch keine Scan-Daten</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Charts row 2: per-show bars + email domains */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Auslastung pro Vorstellung</div>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.showStats} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                            <XAxis type="number" stroke="#ffffff20" fontSize={9} />
                            <YAxis type="category" dataKey="title" stroke="#ffffff20" fontSize={9} width={80} tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '?' : v} />
                            <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                            <Bar dataKey="sold" name="Verkauft" fill="#ffffff60" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">E-Mail-Domains</div>
                      <div className="h-[220px] w-full">
                        {enhancedStats?.emailDomains?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={enhancedStats.emailDomains} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                              <XAxis type="number" stroke="#ffffff20" fontSize={9} />
                              <YAxis type="category" dataKey="domain" stroke="#ffffff20" fontSize={9} width={90} />
                              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                              <Bar dataKey="count" name="Buchungen" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-white/15 text-xs uppercase tracking-widest">Keine Daten</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-show breakdown table */}
                  {enhancedStats?.perShow && (
                    <div className="glass p-8 rounded-[40px] space-y-6">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Detailliert pro Vorstellung</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                  {['Vorstellung', 'Datum', 'Plätze', 'Verkauft', 'Gültig', 'Entwertet', 'Storniert', 'Auslastung', 'Einnahmen'].map(h => (
                                <th key={h} className="text-left py-3 pr-4 text-[9px] uppercase tracking-widest text-white/30 font-bold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {enhancedStats.perShow.map((s: any) => {
                              const pct = ((s.used_count / (s.total_seats || 1)) * 100).toFixed(0);
                              return (
                                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                  <td className="py-3 pr-4 font-medium max-w-[150px] truncate">{s.title}</td>
                    <td className="py-3 pr-4 text-white/40 text-xs whitespace-nowrap">{new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} · {s.time}</td>
                                  <td className="py-3 pr-4 text-white/40 text-xs">{s.total_seats}</td>
                                  <td className="py-3 pr-4 font-bold">{s.total_sold}</td>
                                  <td className="py-3 pr-4 text-emerald-400">{s.valid_count}</td>
                                  <td className="py-3 pr-4 text-amber-400">{s.used_count}</td>
                                  <td className="py-3 pr-4 text-red-400">{s.cancelled_count}</td>
                                  <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-white/10 rounded-full h-1.5">
                                        <div className="bg-white rounded-full h-1.5" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-xs text-white/40">{pct}%</span>
                                    </div>
                                  </td>
                    <td className="py-3 text-white/70 font-mono text-xs">{formatPrice(s.revenue || 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recent activity feed + scan events side by side */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent bookings */}
                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Neueste Buchungen</div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {enhancedStats?.recentBookings?.length > 0 ? enhancedStats.recentBookings.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'cancelled' ? 'bg-red-500' : t.status === 'used' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{t.customer_name}</div>
                            <div className="text-[10px] text-white/25 truncate">{t.customer_email} · {t.show_title}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs text-white/40">{t.code}</div>
                              <div className="text-[10px] text-white/20">{new Date(t.created_at).toLocaleDateString('de-DE')} {new Date(t.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        )) : <div className="text-white/15 text-xs text-center py-8">Keine Buchungen</div>}
                      </div>
                    </div>

                    {/* Scan events */}
                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Scan-Protokoll (Einlass)</div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {enhancedStats?.scanEvents?.length > 0 ? enhancedStats.scanEvents.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{t.customer_name}</div>
                            <div className="text-[10px] text-white/25 truncate">{t.customer_email} · {t.show_title}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs text-white/40">{t.code}</div>
                              <div className="text-[10px] text-white/20">{new Date(t.scanned_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                            </div>
                          </div>
                        )) : <div className="text-white/15 text-xs text-center py-8">Noch niemand eingescannt</div>}
                      </div>
                    </div>
                  </div>

                  {/* Cancellations log */}
                  {enhancedStats?.cancellations?.length > 0 && (
                    <div className="glass p-8 rounded-[40px] space-y-5">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Stornierungen ({enhancedStats.cancellations.length})</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {enhancedStats.cancellations.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 opacity-60">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{t.customer_name}</div>
                            <div className="text-[10px] text-white/25 truncate">{t.customer_email} · {t.show_title}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs text-white/40">{t.code}</div>
                              <div className="text-[10px] text-white/20">
                                Storniert: {t.canceled_at ? new Date(t.canceled_at).toLocaleDateString('de-DE') + ' ' + new Date(t.canceled_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {adminTab === 'tickets' && (adminRole !== 'admin' || !!ownerGroupId) && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Buchungen & Stornierungen</div>
                      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Alle Tickets</h2>
                    </div>
                    <Button variant="secondary" className="shrink-0" onClick={() => { setGuestList(null); fetchGuestList(guestListShowId); }}>
                      <Download size={16} /> Gästeliste drucken
                    </Button>
                  </div>

                  <div className="glass p-6 sm:p-8 rounded-[32px] space-y-6 border border-white/10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">VIP-Tickets</div>
                        <h3 className="text-2xl font-bold tracking-tight mt-2">Dauerkarte für diese Gruppe</h3>
                        <p className="text-white/35 text-sm mt-1">Gilt nur für die ausgewählte Klasse/Gruppe und deren Vorstellungen.</p>
                      </div>
                      <form onSubmit={handleGenerateVip} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <input
                          className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30"
                          placeholder="Name, z.B. Lehrer-VIP"
                          value={vipForm.label}
                          onChange={(e) => setVipForm({ ...vipForm, label: e.target.value })}
                        />
                        <select
                          value={vipForm.showId}
                          onChange={(e) => setVipForm({ ...vipForm, showId: e.target.value })}
                          className="select-dark bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30"
                        >
                          <option value="">Alle Vorstellungen</option>
                          {visibleAdminShows.map((show) => (
                            <option key={show.id} value={show.id}>{show.title} · {show.time} Uhr</option>
                          ))}
                        </select>
                        <Button type="submit" className="py-3"><Plus size={16} /> Generieren</Button>
                      </form>
                    </div>
                    {vipMsg && <div className={`text-xs uppercase tracking-widest font-bold ${vipMsg.includes('konnte') || vipMsg.includes('Netzwerk') || vipMsg.includes('Bitte') ? 'text-red-400' : 'text-emerald-400'}`}>{vipMsg}</div>}
                    {vipTickets.length > 0 && (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {vipTickets.map((vip: any) => (
                          <div key={vip.id} data-vip-card={vip.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold">{vip.label}</div>
                                <div className="text-xs text-white/35">{vip.show_title || vip.group_name || 'Gruppen-VIP'}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">Aktiv</span>
                                <button onClick={() => handleDeleteVip(vip)} className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all" title="VIP-Ticket löschen">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="bg-white rounded-2xl p-3 w-fit">
                              <QRCode value={vip.code} size={96} bgColor="#ffffff" fgColor="#09090b" quietZone={4} />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-mono text-lg tracking-[0.2em]">{vip.code}</div>
                              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => printVipCard(vip)}>
                                <Download size={14} /> Karte
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Guest list print modal */}
                  {guestList !== null && (
                    <div className="glass rounded-3xl p-8 space-y-6 print:fixed print:inset-0 print:z-[999] print:bg-white print:text-black print:p-8 print:rounded-none" id="guestlist-print">
                      <div className="flex items-center justify-between print:hidden">
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold">Gästeliste</h3>
                          <div className="flex items-center gap-3">
                            <select
                              className="select-dark bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                              value={guestListShowId}
                              onChange={e => { setGuestListShowId(e.target.value); fetchGuestList(e.target.value); }}
                            >
                              <option value="">Alle Vorstellungen</option>
                              {visibleAdminShows.map(s => (
                                <option key={s.id} value={String(s.id)}>{s.title} – {new Date(s.date).toLocaleDateString('de-DE')}</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{guestList.length} Einträge</span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button variant="secondary" onClick={printGuestList}>
                            <Download size={16} /> Drucken
                          </Button>
                          <button onClick={() => setGuestList(null)} className="text-white/30 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                      </div>

                      {/* Print header (only visible when printing) */}
                      <div className="hidden print:block mb-8">
                        <h1 className="text-2xl font-bold text-black">Gästeliste – Einlasskontrolle</h1>
                        <p className="text-sm text-gray-500 mt-1">Gedruckt am {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        <div className="border-b-2 border-black mt-4" />
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 print:border-black">
                              <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold w-8">#</th>
                              <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold">Name</th>
                              <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold w-20">Code</th>
                              <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold hidden sm:table-cell">E-Mail</th>
                              <th className="text-left py-3 pr-4 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold hidden md:table-cell">Vorstellung</th>
                              <th className="text-left py-3 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold w-24">Status</th>
                              <th className="text-left py-3 text-[10px] uppercase tracking-widest text-white/40 print:text-black font-bold w-10 print:block">✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestList.map((t: any, i: number) => (
                              <tr key={t.id} className={`border-b border-white/5 print:border-gray-200 ${i % 2 === 0 ? 'print:bg-gray-50' : ''}`}>
                                <td className="py-3 pr-4 text-white/20 print:text-gray-400 text-xs">{i + 1}</td>
                                <td className="py-3 pr-4 font-medium print:text-black">{t.customer_name}</td>
                                <td className="py-3 pr-4 font-mono tracking-widest text-sm print:text-black">{t.code}</td>
                                <td className="py-3 pr-4 text-white/40 print:text-gray-600 text-xs hidden sm:table-cell">{t.customer_email}</td>
                                <td className="py-3 pr-4 text-white/30 print:text-gray-500 text-xs hidden md:table-cell">{t.show_title}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold print:border print:border-current ${t.status === 'used' ? 'text-amber-400 print:text-amber-600' : 'text-emerald-400 print:text-green-600'}`}>
                                    {t.status === 'used' ? 'Entwertet' : 'Gültig'}
                                  </span>
                                </td>
                                <td className="py-3 print:border print:border-gray-300 print:w-8 print:h-8" />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Search + Filter bar */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-colors"
                        placeholder="Name, E-Mail oder Code..."
                        value={adminTicketSearch}
                        onChange={e => {
                          setAdminTicketSearch(e.target.value);
                          fetchAdminTickets(e.target.value, adminTicketFilter === 'all' ? '' : adminTicketFilter);
                        }}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(['all', 'valid', 'used', 'cancelled'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => {
                            setAdminTicketFilter(f);
                            fetchAdminTickets(adminTicketSearch, f === 'all' ? '' : f);
                          }}
                          className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${adminTicketFilter === f ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white border border-white/10'}`}
                        >
                          {f === 'all' ? 'Alle' : f === 'valid' ? 'Gültig' : f === 'used' ? 'Entwertet' : 'Storniert'}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold shrink-0">
                      {adminTickets.length} Einträge
                    </div>
                  </div>

                  {/* Ticket list */}
                  <div className="space-y-2">
                    {adminTickets.length === 0 ? (
                      <div className="glass rounded-2xl p-12 text-center text-white/20 text-sm">
                        Keine Tickets gefunden
                      </div>
                    ) : adminTickets.map((t: any) => (
                      <div key={t.id} className={`glass rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all ${t.status === 'cancelled' ? 'opacity-40' : ''}`}>
                        {/* Status badge */}
                        <div className={`shrink-0 w-2 h-2 rounded-full ${t.status === 'valid' ? 'bg-emerald-500' : t.status === 'used' ? 'bg-amber-500' : 'bg-red-500'}`} />

                        {/* Code */}
                        <div className="font-mono text-base tracking-[0.3em] font-bold w-16 shrink-0">{t.code}</div>

                        {/* Name + email */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.customer_name}</div>
                          <div className="text-[11px] text-white/30 truncate">{t.customer_email}</div>
                        </div>

                        {/* Show + date */}
                        <div className="hidden md:block text-right shrink-0">
                          <div className="text-xs text-white/50 truncate max-w-[160px]">{t.show_title}</div>
                          <div className="text-[11px] text-white/25">
                            {t.show_date ? new Date(t.show_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </div>
                        </div>

                        {/* Status label */}
                        <div className={`shrink-0 px-3 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold ${
                          t.status === 'valid' ? 'bg-emerald-500/10 text-emerald-400' :
                          t.status === 'used'  ? 'bg-amber-500/10 text-amber-400' :
                                                  'bg-red-500/10 text-red-400'
                        }`}>
                          {t.status === 'valid' ? 'Gültig' : t.status === 'used' ? 'Entwertet' : 'Storniert'}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                          {t.status === 'valid' && (
                            <button
                              onClick={() => handleChangeTicketStatus(t.id, 'used')}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[9px] uppercase tracking-widest font-bold transition-all"
                              title="Als entwertet markieren"
                            >
                              Entwerten
                            </button>
                          )}
                          {t.status === 'used' && (
                            <button
                              onClick={() => handleChangeTicketStatus(t.id, 'valid')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[9px] uppercase tracking-widest font-bold transition-all"
                              title="Wieder aktivieren"
                            >
                              Reaktivieren
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAdminTicket(t.id)}
                            className="p-1.5 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Ticket löschen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'editor' && (adminRole !== 'admin' || !!ownerGroupId) && (
                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Inhalte & Design</div>
                      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">Vorstellungs-Editor</h2>
                    </div>
                    <Button variant="secondary" onClick={() => setShowCreateForm(!showCreateForm)} className="shrink-0">
                      <Plus size={18} /> Neue Vorstellung
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showCreateForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <CreateShowForm
                          groups={groups}
                          isOwner={adminRole === 'admin'}
                          onSave={(data) => { handleCreateShow(data); setShowCreateForm(false); }}
                          onCancel={() => setShowCreateForm(false)}
                          onUpload={handleImageUpload}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid gap-10">
                    {visibleAdminShows.length > 0 ? (
                      visibleAdminShows.map((show) => (
                        <ShowEditor key={show.id} show={show} groups={groups} isOwner={adminRole === 'admin'} onSave={handleUpdateShow} onDelete={handleDeleteShow} onUpload={handleImageUpload as any} />
                      ))
                    ) : (
                      <div className="glass p-10 rounded-[40px] text-center space-y-3">
                        <div className="text-lg font-bold">Noch keine Vorstellung für diesen Zugang</div>
                        <p className="text-white/40 text-sm">Erstelle zuerst eine Vorstellung, dann erscheinen hier Editor, Tickets und Statistiken für diese Gruppe.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'email' && (
                <div className="space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">Backend & Service</div>
                      <h2 className="text-5xl font-bold tracking-tight">E-Mail-Konfiguration</h2>
                    </div>
                  </div>

                  <div className="max-w-2xl">
                    <form onSubmit={handleSaveEmailSettings} className="glass p-12 rounded-[48px] space-y-8">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <Mail size={24} className="text-white/60" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-2xl font-bold tracking-tight">SMTP Zugangsdaten</h3>
                          <p className="text-white/30 text-xs uppercase tracking-widest font-bold">GMX Mail Service</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <Input 
                          label="GMX E-Mail-Adresse" 
                          value={emailSettings.emailUser}
                          onChange={(e: any) => setEmailSettings({ ...emailSettings, emailUser: e.target.value })}
                          placeholder="beispiel@gmx.de"
                          required
                        />
                        <div className="space-y-2">
                          <Input 
                            type="password"
                            label="GMX Passwort" 
                            value={emailSettings.emailPass}
                            onChange={(e: any) => setEmailSettings({ ...emailSettings, emailPass: e.target.value })}
                          placeholder={emailSettings.hasPassword ? "••••••••••••" : "Passwort eingeben"}
                            required={!emailSettings.hasPassword}
                          />
                          {emailSettings.hasPassword && (
                            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest font-bold ml-4">
                              ✓ Passwort ist bereits hinterlegt
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle size={16} className="text-white/40 mt-1 shrink-0" />
                          <div className="space-y-2">
                            <p className="text-xs text-white/60 leading-relaxed font-light">
                              Dieser Account wird ausschließlich zum Versenden der Ticket-Bestätigungen an die Kunden genutzt.
                            </p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                              Server: smtp.gmx.net | Port: 465 (SSL)
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button disabled={loading} type="submit" className="w-full py-4">
                        {loading ? 'Speichere...' : 'Konfiguration speichern'}
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {adminTab === 'settings' && adminRole === 'admin' && (
                <SettingsTab adminUser={adminUser} generalSettings={generalSettings} groups={groups} adminUsers={adminUsers} fetchGeneralSettings={fetchGeneralSettings} fetchGroups={fetchGroups} fetchAdminUsers={fetchAdminUsers} onRefreshShows={fetchShows} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10 px-8 mt-32">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-2">
            <div className="text-white/20 text-[9px] sm:text-[10px] font-normal tracking-[0.12em] uppercase">
              © {new Date().getFullYear()} Hannes Schuler · StagePass
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Scanner Component ---

function Scanner({ onScan }: { onScan: (text: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onScanRef = React.useRef(onScan);
  onScanRef.current = onScan;
  const instanceRef = React.useRef<{ qr: Html5Qrcode; running: boolean } | null>(null);
  const restartCountRef = React.useRef(0);
  // Stable ref so fixOrientation can call startScanner without circular deps
  const startScannerRef = React.useRef<() => Promise<void>>();

  const stopCurrent = async () => {
    const inst = instanceRef.current;
    instanceRef.current = null;
    if (inst?.running) {
      try { await inst.qr.stop(); } catch {}
    }
  };

  // Called every 2 s while the scanner is running.
  // Uses applyConstraints (no flicker!) and only restarts as last resort.
  const fixOrientation = React.useCallback(async () => {
    const video = document.querySelector('#reader video') as HTMLVideoElement | null;
    if (!video || video.videoWidth === 0) return;
    const portrait = window.innerHeight > window.innerWidth;
    const landscape = video.videoWidth > video.videoHeight * 1.15;
    if (!portrait || !landscape) return; // stream is fine

    // Option 1: applyConstraints - zero flicker, changes stream in-place
    try {
      const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({ aspectRatio: 1 });
        return; // next poll cycle verifies if it actually worked
      }
    } catch (_) { /* applyConstraints not supported, fall through */ }

    // Option 2: silent restart (brief flicker, max 3x)
    if (restartCountRef.current < 3) {
      restartCountRef.current++;
      startScannerRef.current?.();
    }
  }, []);

  const startScanner = React.useCallback(async () => {
    setError(null);
    setReady(false);
    await stopCurrent();

    const el = document.getElementById('reader');
    if (el) el.innerHTML = '';

    const isMobile = window.innerWidth < 640;
    const qrSize = isMobile ? 200 : 260;
    const config = { fps: 25, qrbox: { width: qrSize, height: qrSize }, aspectRatio: 1 } as any;

    const constraints: any[] = [
      { facingMode: 'environment' },
      { facingMode: 'user' },
      true,
    ];

    const qr = new Html5Qrcode('reader');
    instanceRef.current = { qr, running: false };

    for (const constraint of constraints) {
      try {
        await qr.start(
          constraint,
          config,
          (text) => { onScanRef.current(text); },
          () => {}
        );
        if (instanceRef.current) {
          instanceRef.current.running = true;
          restartCountRef.current = 0;
          setReady(true);
        }
        return;
      } catch (err: any) {
        const msg = (err?.name || err?.message || String(err)).toLowerCase();
        if (msg.includes('notallowed') || msg.includes('permission') || msg.includes('denied')) {
          setError('Kamera-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben und dann hier tippen.');
          return;
        }
        console.warn('Camera constraint failed, trying next:', constraint, err);
      }
    }

    setError('Kamera konnte nicht gestartet werden. Bitte hier tippen, um es erneut zu versuchen.');
  }, []);

  // Keep ref in sync so fixOrientation can call startScanner without circular deps
  startScannerRef.current = startScanner;

  // Poll every 2 s: silently correct landscape stream without restarting
  useEffect(() => {
    if (!ready) return;
    const init = setTimeout(() => fixOrientation(), 800);
    const poll = setInterval(() => fixOrientation(), 2000);
    return () => { clearTimeout(init); clearInterval(poll); };
  }, [ready, fixOrientation]);

  useEffect(() => {
    const timer = setTimeout(() => startScanner(), 400);
    return () => {
      clearTimeout(timer);
      stopCurrent();
    };
  }, [startScanner]);

  return (
    <div className="p-4">
      {error && (
        <button
          onClick={startScanner}
          className="mb-4 w-full rounded-2xl bg-red-500/20 border border-red-500/50 p-5 text-red-300 text-center active:opacity-70 transition-opacity"
        >
          <p className="text-sm mb-3">{error}</p>
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-6 py-2 rounded-xl">
            Erneut versuchen
          </span>
        </button>
      )}

      {/*
        Wrapper gives the spinner a fixed height while loading.
        The reader lives inside and is always visible so html5-qrcode
        can measure its width correctly on every device.
        The spinner is an absolute overlay that disappears once the camera runs.
      */}
      <div className="relative rounded-3xl overflow-hidden" style={{ minHeight: ready ? 0 : 300 }}>
        {/* Spinner overlay - only shown while camera is starting */}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10 rounded-3xl">
            <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
          </div>
        )}
        {/* reader is always rendered and visible - never hidden */}
        <div id="reader" style={{ width: '100%' }} />
      </div>

      <style>{`
        #reader { border: none !important; background: transparent !important; }
        #reader video {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
          border-radius: 1.5rem;
        }
      `}</style>
    </div>
  );
}

// --- Settings Tab Component ---

interface SettingsTabProps {
  adminUser: { username: string; password: string };
  generalSettings: { hasScannerPassword: boolean; ticketLimitPerEmail: string };
  groups: any[];
  adminUsers: any[];
  fetchGeneralSettings: () => void;
  fetchGroups: () => void;
  fetchAdminUsers: () => void;
  onRefreshShows?: () => void;
}

function SettingsTab({ adminUser, generalSettings, groups, adminUsers, fetchGeneralSettings, fetchGroups, fetchAdminUsers, onRefreshShows }: SettingsTabProps) {
  const [scannerPassword, setScannerPassword] = useState('');
  const [ticketLimit, setTicketLimit] = useState(generalSettings.ticketLimitPerEmail);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const [currentUsername, setCurrentUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState('');

  const [resetConfirmCode, setResetConfirmCode] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [groupForm, setGroupForm] = useState({ groupId: '', name: '', groupUsername: '', groupPassword: '' });
  const [groupMsg, setGroupMsg] = useState('');
  const [userForm, setUserForm] = useState({ userId: '', editUsername: '', editPassword: '', editRole: 'group_admin', editGroupId: '' });
  const [userMsg, setUserMsg] = useState('');

  useEffect(() => {
    setTicketLimit(generalSettings.ticketLimitPerEmail);
  }, [generalSettings.ticketLimitPerEmail]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/admin/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adminUser,
          scannerPassword: scannerPassword || undefined,
          ticketLimitPerEmail: ticketLimit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg('Einstellungen gespeichert.');
        setScannerPassword('');
        fetchGeneralSettings();
      } else {
        setSettingsMsg(data.error || 'Fehler beim Speichern.');
      }
    } catch {
      setSettingsMsg('Netzwerkfehler.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    setCredsMsg('');
    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUsername,
          password: currentPassword,
          newUsername,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
    setCredsMsg('Zugangsdaten geändert. Bitte neu einloggen.');
        setCurrentUsername(''); setCurrentPassword(''); setNewUsername(''); setNewPassword('');
      } else {
    setCredsMsg(data.error || 'Fehler beim Ändern.');
      }
    } catch {
      setCredsMsg('Netzwerkfehler.');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleResetTickets = async () => {
    if (resetConfirmCode !== 'RESET') {
    setResetMsg('Bitte "RESET" eingeben um zu bestätigen.');
      return;
    }
    setResetting(true);
    setResetMsg('');
    try {
      const res = await fetch('/api/admin/reset-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminUser, confirmCode: 'RESET' }),
      });
      const data = await res.json();
      if (data.success) {
    setResetMsg('Alle Tickets wurden gelöscht und Plätze zurückgesetzt.');
        setResetConfirmCode('');
        onRefreshShows?.(); // refresh shows list
      } else {
    setResetMsg(data.error || 'Fehler beim Zurücksetzen.');
      }
    } catch {
      setResetMsg('Netzwerkfehler.');
    } finally {
      setResetting(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupMsg('');
    try {
      const res = await fetch('/api/admin/groups/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminUser, ...groupForm }),
      });
      const data = await res.json();
      if (data.success) {
        setGroupMsg('Gruppe gespeichert.');
        setGroupForm({ groupId: '', name: '', groupUsername: '', groupPassword: '' });
        fetchGroups();
        fetchAdminUsers();
        onRefreshShows?.();
      } else {
        setGroupMsg(data.error || 'Gruppe konnte nicht gespeichert werden.');
      }
    } catch {
      setGroupMsg('Netzwerkfehler.');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg('');
    try {
      const res = await fetch('/api/admin/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminUser, ...userForm }),
      });
      const data = await res.json();
      if (data.success) {
        setUserMsg('User gespeichert.');
        setUserForm({ userId: '', editUsername: '', editPassword: '', editRole: 'group_admin', editGroupId: '' });
        fetchAdminUsers();
      } else {
        setUserMsg(data.error || 'User konnte nicht gespeichert werden.');
      }
    } catch {
      setUserMsg('Netzwerkfehler.');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-bold">System & Sicherheit</div>
          <h2 className="text-5xl font-bold tracking-tight">Einstellungen</h2>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 max-w-5xl">
        {/* Scanner & Limits */}
        <form onSubmit={handleSaveSettings} className="glass p-10 rounded-[48px] space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-3 rounded-2xl">
              <Settings size={24} className="text-white/60" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Zugang & Limits</h3>
              <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Scanner & Buchung</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
          Scanner-Passwort {generalSettings.hasScannerPassword && <span className="text-emerald-500/70 ml-2">✓ gesetzt</span>}
              </label>
              <input
                type="password"
          placeholder={generalSettings.hasScannerPassword ? "Neues Passwort (leer lassen = unverändert)" : "Scanner-Passwort setzen"}
                value={scannerPassword}
                onChange={e => setScannerPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
              />
              <p className="text-[10px] text-white/30 tracking-widest font-bold uppercase ml-1">
                Mit diesem Passwort kann der Scanner-Tab aufgerufen werden (kein Admin-Zugriff)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Max. Tickets pro E-Mail
              </label>
              <input
                type="number"
                min={1}
                placeholder="Leer = kein Limit"
                value={ticketLimit}
                onChange={e => setTicketLimit(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
              />
              <p className="text-[10px] text-white/30 tracking-widest font-bold uppercase ml-1">
                Tickets pro E-Mail-Adresse pro Vorstellung (leer = unbegrenzt)
              </p>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] text-white/30 tracking-widest font-bold uppercase">
                Veranstaltungsort wird jetzt pro Vorstellung im Ticket-Editor festgelegt.
              </p>
            </div>
          </div>

          {settingsMsg && (
            <p className={`text-xs font-bold uppercase tracking-widest ${settingsMsg.includes('Fehler') || settingsMsg.includes('Netzwerk') ? 'text-red-400' : 'text-emerald-400'}`}>
              {settingsMsg}
            </p>
          )}

          <Button disabled={savingSettings} type="submit" className="w-full py-4">
            {savingSettings ? 'Speichere...' : 'Einstellungen speichern'}
          </Button>
        </form>

        {/* Change Admin Credentials */}
        <form onSubmit={handleChangeCredentials} className="glass p-10 rounded-[48px] space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-3 rounded-2xl">
              <User size={24} className="text-white/60" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Admin-Zugangsdaten</h3>
              <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Benutzername & Passwort</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Aktueller Benutzername</label>
              <input
                required
                value={currentUsername}
                onChange={e => setCurrentUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
                placeholder="Aktueller Username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Aktuelles Passwort</label>
              <input
                required
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
        placeholder="••••••••"
              />
            </div>
            <div className="border-t border-white/10 pt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Neuer Benutzername</label>
                <input
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
                  placeholder="Neuer Username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Neues Passwort</label>
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-white/30 text-sm"
        placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {credsMsg && (
            <p className={`text-xs font-bold uppercase tracking-widest ${credsMsg.includes('Fehler') || credsMsg.includes('Netzwerk') ? 'text-red-400' : 'text-emerald-400'}`}>
              {credsMsg}
            </p>
          )}

          <Button disabled={savingCreds} type="submit" className="w-full py-4">
        {savingCreds ? 'Ändern...' : 'Zugangsdaten ändern'}
          </Button>
        </form>
      </div>

      <div className="max-w-5xl">
        <form onSubmit={handleSaveGroup} className="glass p-10 rounded-[48px] space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-3 rounded-2xl">
              <Users size={24} className="text-white/60" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Klassen & Gruppen</h3>
              <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Eigene Logins pro Gruppe</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {groups.map((group: any) => (
              <button
                type="button"
                key={group.id}
                onClick={() => setGroupForm({
                  groupId: String(group.id),
                  name: group.name || '',
                  groupUsername: group.username || '',
                  groupPassword: '',
                })}
                className="text-left border border-white/10 bg-white/[0.03] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="text-lg font-bold">{group.name}</div>
                <div className="text-xs text-white/35 mt-1">{group.section_title || 'Keine Überschrift'}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/25 mt-3">
                  Login: {group.username || 'nicht gesetzt'} · {group.show_count || 0} Vorstellungen · {group.ticket_count || 0} Tickets
                </div>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5 border-t border-white/10 pt-6">
            <Input label="Gruppenname" placeholder="z.B. 8B" value={groupForm.name} onChange={(e: any) => setGroupForm({ ...groupForm, name: e.target.value })} />
            <Input label="Login-Benutzername" placeholder="z.B. klasse8b" value={groupForm.groupUsername} onChange={(e: any) => setGroupForm({ ...groupForm, groupUsername: e.target.value })} />
            <Input label="Neues Gruppenpasswort" type="password" placeholder={groupForm.groupId ? "Leer lassen = unverändert" : "Mindestens 10 Zeichen"} value={groupForm.groupPassword} onChange={(e: any) => setGroupForm({ ...groupForm, groupPassword: e.target.value })} />
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 flex items-center text-sm text-white/45">
              Die Anzeige wird automatisch aus dem Gruppennamen gesetzt.
            </div>
          </div>

          {groupMsg && <p className={`text-xs font-bold uppercase tracking-widest ${groupMsg.includes('Fehler') || groupMsg.includes('Netzwerk') || groupMsg.includes('nicht') ? 'text-red-400' : 'text-emerald-400'}`}>{groupMsg}</p>}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1 py-4">{groupForm.groupId ? 'Gruppe speichern' : 'Neue Gruppe anlegen'}</Button>
            {groupForm.groupId && <Button variant="ghost" onClick={() => setGroupForm({ groupId: '', name: '', groupUsername: '', groupPassword: '' })}>Neu</Button>}
          </div>
        </form>
      </div>

      <div className="max-w-5xl">
        <form onSubmit={handleSaveUser} className="glass p-10 rounded-[48px] space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-3 rounded-2xl">
              <User size={24} className="text-white/60" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">User-Verwaltung</h3>
              <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Owner und Klassen-Zugänge</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {adminUsers.map((user: any) => (
              <button
                type="button"
                key={user.id}
                onClick={() => setUserForm({
                  userId: String(user.id),
                  editUsername: user.username || '',
                  editPassword: '',
                  editRole: user.role || 'group_admin',
                  editGroupId: user.group_id ? String(user.group_id) : '',
                })}
                className="text-left border border-white/10 bg-white/[0.03] rounded-2xl p-5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="text-lg font-bold">{user.username}</div>
                <div className="text-xs text-white/35 mt-1">{user.role === 'admin' ? 'Owner/Admin' : `Gruppe: ${user.group_name || 'keine'}`}</div>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5 border-t border-white/10 pt-6">
            <Input label="Benutzername" value={userForm.editUsername} onChange={(e: any) => setUserForm({ ...userForm, editUsername: e.target.value })} />
            <Input label="Neues Passwort" type="password" placeholder={userForm.userId ? "Leer lassen = unverändert" : "Mindestens 10 Zeichen"} value={userForm.editPassword} onChange={(e: any) => setUserForm({ ...userForm, editPassword: e.target.value })} />
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">Rolle</label>
              <select value={userForm.editRole} onChange={(e: any) => setUserForm({ ...userForm, editRole: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors">
                <option value="group_admin">Klassenadmin</option>
                <option value="admin">Owner/Admin</option>
              </select>
            </div>
            {userForm.editRole !== 'admin' && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">Gruppe</label>
                <select value={userForm.editGroupId} onChange={(e: any) => setUserForm({ ...userForm, editGroupId: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors">
                  <option value="">Gruppe wählen</option>
                  {groups.map((group: any) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {userMsg && <p className={`text-xs font-bold uppercase tracking-widest ${userMsg.includes('Fehler') || userMsg.includes('Netzwerk') || userMsg.includes('nicht') ? 'text-red-400' : 'text-emerald-400'}`}>{userMsg}</p>}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1 py-4">{userForm.userId ? 'User speichern' : 'Neuen User anlegen'}</Button>
            {userForm.userId && <Button variant="ghost" onClick={() => setUserForm({ userId: '', editUsername: '', editPassword: '', editRole: 'group_admin', editGroupId: '' })}>Neu</Button>}
          </div>
        </form>
      </div>

      {/* Danger Zone - Reset */}
      <div className="max-w-5xl">
        <div className="glass border border-red-500/20 p-10 rounded-[48px] space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/10 p-3 rounded-2xl">
              <Trash2 size={24} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-red-400">Gefahrenzone</h3>
              <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Unwiderrufliche Aktionen</p>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
            <p className="text-sm text-white/60 leading-relaxed">
        <strong className="text-red-400">Alle Tickets löschen:</strong> Entfernt sämtliche Buchungen aus der Datenbank und setzt die verfügbaren Plätze aller Vorstellungen auf die Maximalkapazität zurück. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
      Zur Bestätigung "RESET" eingeben
            </label>
            <input
              type="text"
              placeholder='Gib "RESET" ein'
              value={resetConfirmCode}
              onChange={e => setResetConfirmCode(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-red-500/20 rounded-2xl px-5 py-3 focus:outline-none focus:border-red-500/40 text-sm font-mono tracking-widest"
            />
          </div>

          {resetMsg && (
      <p className={`text-xs font-bold uppercase tracking-widest ${resetMsg.includes('gelöscht') ? 'text-emerald-400' : 'text-red-400'}`}>
              {resetMsg}
            </p>
          )}

          <button
            disabled={resetting || resetConfirmCode !== 'RESET'}
            onClick={handleResetTickets}
            className="w-full py-4 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed border border-red-500/30 rounded-2xl text-red-400 font-bold uppercase tracking-widest text-xs transition-all duration-300"
          >
      {resetting ? 'Lösche alle Tickets...' : 'Alle Tickets unwiderruflich löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Ticket Stub Preview (shared) ---
function TicketStubPreview({ title, date, time, price, price_child, seats }: { title: string; date: string; time: string; price: number; price_child: number; seats?: number }) {
  const dateStr = date ? new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'TT. MMM JJJJ';
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-xl relative overflow-visible w-full">
      <div className="flex min-h-[130px]">
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30">Vorstellung</div>
            <div className="text-sm font-mono uppercase tracking-[0.08em] text-white/90 mt-1 leading-snug">{title || 'Titel...'}</div>
          </div>
          <div className="flex flex-wrap gap-5 mt-3">
            <div>
              <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30">Datum</div>
              <div className="text-[10px] font-mono uppercase tracking-widest mt-0.5 text-white/60">{dateStr}</div>
            </div>
            <div>
              <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30">Uhrzeit</div>
              <div className="text-[10px] font-mono uppercase tracking-widest mt-0.5 text-white/60">{time || '-'} Uhr</div>
            </div>
          </div>
        </div>
        <div className="relative w-0 flex items-stretch">
          <div className="border-l border-dashed border-white/15 my-4" />
          <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#050505] border border-white/10 z-10" />
          <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#050505] border border-white/10 z-10" />
        </div>
        <div className="w-28 p-5 flex flex-col justify-between">
          <div>
            <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30">Erw.</div>
        <div className="text-lg font-mono mt-1 text-white/90">{formatPrice(price)}</div>
            <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30 mt-2">Kind</div>
        <div className="text-base font-mono mt-0.5 text-white/60">{formatPrice(price_child)}</div>
          </div>
          {seats !== undefined && (
            <div>
      <div className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/30">Plätze</div>
              <div className="text-[10px] font-mono uppercase tracking-widest mt-0.5 text-white/60">{seats} frei</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Show Editor Component ---

interface ShowEditorProps {
  key?: any;
  show: Show;
  groups?: any[];
  isOwner?: boolean;
  onSave: (data: any) => Promise<void> | void;
  onDelete: (showId: number) => Promise<void> | void;
  onUpload: (file: File) => Promise<string | null>;
}

function ShowEditor({ show, groups = [], isOwner = false, onSave, onDelete }: ShowEditorProps) {
  const rawOffset = show.entry_offset ?? 30;
  const [formData, setFormData] = useState({
    showId: show.id,
    title: show.title,
    description: show.description,
    price: show.price,
    price_child: show.price_child ?? 5,
    time: show.time,
    date: show.date,
    total_seats: show.total_seats,
    location_name: show.location_name || '',
    location_address: show.location_address || '',
    entry_offset: rawOffset > 0 ? rawOffset : 30,
    showEntryTime: rawOffset > 0,
    sales_lock_after_start: !!show.sales_lock_after_start,
    group_id: show.group_id || '',
  });

  return (
    <div className="glass p-6 sm:p-8 rounded-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-2.5 rounded-xl"><Edit3 size={18} className="text-white/60" /></div>
          <h3 className="text-lg font-bold tracking-tight">{show.title}</h3>
        </div>
          <button onClick={() => onDelete(show.id)} className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Löschen">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Live ticket-stub preview */}
      <div>
        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-3">Live-Vorschau</div>
        <TicketStubPreview title={formData.title} date={formData.date} time={formData.time} price={formData.price} price_child={formData.price_child} seats={show.available_seats} />
      </div>

      {/* Form fields */}
      <div className="grid sm:grid-cols-2 gap-5">
        <Input label="Titel" value={formData.title} onChange={(e: any) => setFormData({ ...formData, title: e.target.value })} />
        <TextArea label="Beschreibung" value={formData.description} onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} />
        <Input label="Datum" type="date" value={formData.date} onChange={(e: any) => setFormData({ ...formData, date: e.target.value })} />
        <Input label="Uhrzeit" type="time" value={formData.time} onChange={(e: any) => setFormData({ ...formData, time: e.target.value })} />
          <Input label="Preis Erwachsene (€, ab 18)" type="number" step="0.01" value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
          <Input label="Preis Kinder (€, unter 18)" type="number" step="0.01" value={formData.price_child} onChange={(e: any) => setFormData({ ...formData, price_child: parseFloat(e.target.value) || 0 })} />
          <Input label="Gesamtkapazität (Plätze)" type="number" value={formData.total_seats} onChange={(e: any) => setFormData({ ...formData, total_seats: parseInt(e.target.value) || 0 })} />
        {/* Einlass toggle */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setFormData({ ...formData, showEntryTime: !formData.showEntryTime })}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${formData.showEntryTime ? 'bg-emerald-500/70' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${formData.showEntryTime ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">Einlasszeit anzeigen</span>
          </label>
          {formData.showEntryTime && (
            <div className="ml-13 space-y-1">
              <Input
                label="Minuten vor Beginn"
                type="number"
                placeholder="30"
                value={formData.entry_offset}
                onChange={(e: any) => setFormData({ ...formData, entry_offset: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold ml-4">
                Einlass ab {calculateAdmissionTime(formData.time, formData.entry_offset)} Uhr
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Buchungsregeln</div>
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="flex items-center gap-3 cursor-pointer group bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
            <div
              onClick={() => setFormData({ ...formData, sales_lock_after_start: !formData.sales_lock_after_start })}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${formData.sales_lock_after_start ? 'bg-red-500/70' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${formData.sales_lock_after_start ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">Nach Beginn ausgrauen</span>
          </label>
          {isOwner && (
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">Gruppe/Klasse</label>
              <select
                value={formData.group_id}
                onChange={(e: any) => setFormData({ ...formData, group_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors"
              >
                <option value="">Keine Gruppe</option>
                {groups.map((group: any) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2 text-xs text-white/30 leading-relaxed">
            Die Landingpage bildet automatisch einen eigenen Ticket-Block pro Gruppe.
          </div>
        </div>
      </div>

      {/* Location fields */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Veranstaltungsort</div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Input label="Name des Ortes" placeholder="z.B. Aula Hauptgebäude" value={formData.location_name} onChange={(e: any) => setFormData({ ...formData, location_name: e.target.value })} />
          <Input label="Adresse (für interne Navigation)" placeholder="z.B. Musterstraße 1 oder Maps-Link" value={formData.location_address} onChange={(e: any) => setFormData({ ...formData, location_address: e.target.value })} />
        </div>
      </div>

      <Button className="w-full py-4" onClick={() => onSave({ ...formData, entry_offset: formData.showEntryTime ? formData.entry_offset : -1, sales_lock_after_start: formData.sales_lock_after_start ? 1 : 0 })}>
          <Save size={16} /> Änderungen speichern
      </Button>
    </div>
  );
}

function calculateAdmissionTime(time: string, offset: number = 30): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':').map(Number);
  const d = new Date(0, 0, 0, h, m);
  d.setMinutes(d.getMinutes() - (offset || 0));
  return d.toTimeString().slice(0, 5);
}

// --- Create Show Form ---

interface CreateShowFormProps {
  groups?: any[];
  isOwner?: boolean;
  onSave: (data: any) => void;
  onCancel: () => void;
  onUpload: (file: File) => Promise<string | null>;
}

function CreateShowForm({ groups = [], isOwner = false, onSave, onCancel }: CreateShowFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 10.00,
    price_child: 5.00,
    time: '19:00',
    date: '',
    total_seats: 200,
    location_name: '',
    location_address: '',
    entry_offset: 30,
    showEntryTime: true,
    sales_lock_after_start: false,
    group_id: groups[0]?.id || '',
  });

  return (
    <div className="glass p-6 sm:p-8 rounded-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl"><Plus size={18} className="text-emerald-500" /></div>
          <h3 className="text-lg font-bold tracking-tight">Neue Vorstellung erstellen</h3>
        </div>
        <button onClick={onCancel} className="text-white/30 hover:text-white transition-colors"><X size={18} /></button>
      </div>

      {/* Live preview */}
      <div>
        <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-3">Live-Vorschau</div>
        <TicketStubPreview title={formData.title} date={formData.date} time={formData.time} price={formData.price} price_child={formData.price_child} />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Input label="Titel" value={formData.title} onChange={(e: any) => setFormData({ ...formData, title: e.target.value })} />
        <TextArea label="Beschreibung" value={formData.description} onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} />
        <Input label="Datum" type="date" value={formData.date} onChange={(e: any) => setFormData({ ...formData, date: e.target.value })} />
        <Input label="Uhrzeit" type="time" value={formData.time} onChange={(e: any) => setFormData({ ...formData, time: e.target.value })} />
          <Input label="Preis Erwachsene (€, ab 18)" type="number" step="0.01" value={formData.price} onChange={(e: any) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
          <Input label="Preis Kinder (€, unter 18)" type="number" step="0.01" value={formData.price_child} onChange={(e: any) => setFormData({ ...formData, price_child: parseFloat(e.target.value) || 0 })} />
          <Input label="Gesamtkapazität (Plätze)" type="number" value={formData.total_seats} onChange={(e: any) => setFormData({ ...formData, total_seats: parseInt(e.target.value) || 0 })} />
        {/* Einlass toggle */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setFormData({ ...formData, showEntryTime: !formData.showEntryTime })}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${formData.showEntryTime ? 'bg-emerald-500/70' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${formData.showEntryTime ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">Einlasszeit anzeigen</span>
          </label>
          {formData.showEntryTime && (
            <div className="space-y-1">
              <Input
                label="Minuten vor Beginn"
                type="number"
                placeholder="30"
                value={formData.entry_offset}
                onChange={(e: any) => setFormData({ ...formData, entry_offset: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Buchungsregeln</div>
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="flex items-center gap-3 cursor-pointer group bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3">
            <div
              onClick={() => setFormData({ ...formData, sales_lock_after_start: !formData.sales_lock_after_start })}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${formData.sales_lock_after_start ? 'bg-red-500/70' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${formData.sales_lock_after_start ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">Nach Beginn ausgrauen</span>
          </label>
          {isOwner && (
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-white/50 font-medium ml-1">Gruppe/Klasse</label>
              <select
                value={formData.group_id}
                onChange={(e: any) => setFormData({ ...formData, group_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-white/30 transition-colors"
              >
                <option value="">Keine Gruppe</option>
                {groups.map((group: any) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2 text-xs text-white/30 leading-relaxed">
            Die Landingpage bildet automatisch einen eigenen Ticket-Block pro Gruppe.
          </div>
        </div>
      </div>

      {/* Location fields */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Veranstaltungsort</div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Input label="Name des Ortes" placeholder="z.B. Aula Hauptgebäude" value={formData.location_name} onChange={(e: any) => setFormData({ ...formData, location_name: e.target.value })} />
          <Input label="Adresse (für interne Navigation)" placeholder="z.B. Musterstraße 1 oder Maps-Link" value={formData.location_address} onChange={(e: any) => setFormData({ ...formData, location_address: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1 py-4" onClick={() => onSave({ ...formData, entry_offset: formData.showEntryTime ? formData.entry_offset : -1, sales_lock_after_start: formData.sales_lock_after_start ? 1 : 0 })}><Plus size={16} /> Vorstellung erstellen</Button>
        <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
      </div>
    </div>
  );
}
