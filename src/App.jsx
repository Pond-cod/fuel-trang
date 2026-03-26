import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, MapPin, RefreshCw, Droplet, Fuel, 
  X, Clock, CheckCircle2, XCircle,
  LogOut, LogIn, Edit, Settings, Save, Lock, Heart,
  Menu, Users, Star
} from 'lucide-react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const FUEL_NAMES = { diesel: "ดีเซล", g95: "G95", g91: "G91", e20: "E20" };

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [adminLoginError, setAdminLoginError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("ทั้งหมด");
  const [filterFuel, setFilterFuel] = useState("ทั้งหมด");

  const [voteModal, setVoteModal] = useState({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });
  const [editModal, setEditModal] = useState({ isOpen: false, station: null });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stations');
      if (response.ok) setData(await response.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (window.location.pathname === '/admin') {
      setShowAdminLoginModal(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser({ name: result.user.displayName, email: result.user.email, avatar: result.user.displayName?.charAt(0).toUpperCase() || "U" });
      setShowLoginModal(false);
    } catch (e) { console.error(e); }
    setIsLoggingIn(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminLoginForm) });
      if (res.ok) { setIsAdminLoggedIn(true); setShowAdminLoginModal(false); setActiveView('admin'); setAdminLoginError(''); setAdminLoginForm({ username: '', password: '' }); }
      else setAdminLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } catch (e) { setAdminLoginError('เกิดข้อผิดพลาด'); }
  };

  const handleVoteClick = (stationId, fuelKey, stationName, fuelName) => {
    if (!user) setShowLoginModal(true);
    else setVoteModal({ isOpen: true, stationId, fuelKey, stationName, fuelName });
  };

  const submitVote = async (type) => {
    setData(prev => prev.map(s => {
      if (s.id !== voteModal.stationId) return s;
      const current = s.fuels[voteModal.fuelKey];
      return { ...s, lastUpdated: new Date().toLocaleString('th-TH'), fuels: { ...s.fuels, [voteModal.fuelKey]: { ...current, [type]: current[type] + 1 } } };
    }));
    const payload = { stationId: voteModal.stationId, fuelKey: voteModal.fuelKey, voteType: type };
    setVoteModal({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });
    try { await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) { }
  };

  const saveAdminEdit = async (updated) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/admin/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stationId: updated.id, name: updated.name, brand: updated.brand, district: updated.district }) });
      if (res.ok) { setData(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)); setEditModal({ isOpen: false, station: null }); }
    } catch (e) { }
    setIsUpdating(false);
  };

  const districts = useMemo(() => ["ทั้งหมด", ...new Set(data.map(s => s.district))], [data]);

  const filteredData = useMemo(() => data.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.district.includes(searchTerm);
    const matchDistrict = filterDistrict === "ทั้งหมด" || item.district === filterDistrict;
    const matchFuel = filterFuel === "ทั้งหมด" || (() => { const f = item.fuels[filterFuel]; if (!f) return false; const t = f.have + f.out; return t > 0 && f.have / t >= 0.3; })();
    return matchSearch && matchDistrict && matchFuel;
  }), [data, searchTerm, filterDistrict, filterFuel]);

  const getFuelStatus = (fuelData) => {
    if (!fuelData) return { level: 'none', text: '—' };
    const total = fuelData.have + fuelData.out;
    if (total === 0) return { level: 'none', text: '—' };
    const pct = Math.round(fuelData.have / total * 100);
    if (pct >= 60) return { level: 'high', text: 'มีอยู่' };
    if (pct >= 30) return { level: 'mid', text: 'มีบ้าง' };
    return { level: 'low', text: 'ใกล้หมด' };
  };

  const stats = useMemo(() => ({
    total: filteredData.length,
    dieselCount: filteredData.filter(d => getFuelStatus(d.fuels.diesel).level === 'high' || getFuelStatus(d.fuels.diesel).level === 'mid').length,
    g95Count: filteredData.filter(d => getFuelStatus(d.fuels.g95).level !== 'none' && getFuelStatus(d.fuels.g95).level !== 'low').length,
    g91Count: filteredData.filter(d => getFuelStatus(d.fuels.g91).level !== 'none' && getFuelStatus(d.fuels.g91).level !== 'low').length,
    e20Count: filteredData.filter(d => getFuelStatus(d.fuels.e20).level !== 'none' && getFuelStatus(d.fuels.e20).level !== 'low').length,
  }), [filteredData]);

  const BRAND_COLORS = { "ปตท.": "bg-blue-600", "บางจาก": "bg-green-600", "เชลล์": "bg-yellow-400", "พีที": "bg-green-500", "คาลเท็กซ์": "bg-red-600" };
  const BrandBadge = ({ brand }) => (
    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow ${BRAND_COLORS[brand] || "bg-slate-400"}`}>
      {brand.substring(0, 2)}
    </span>
  );

  const FuelChip = ({ stationId, fuelKey, fuelData, stationName }) => {
    const st = getFuelStatus(fuelData);
    const cls = st.level === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                st.level === 'mid'  ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                st.level === 'low'  ? 'bg-red-100 text-red-600 border-red-200' :
                                      'bg-slate-100 text-slate-400 border-slate-200';
    const dot = st.level === 'high' ? 'bg-emerald-500' : st.level === 'mid' ? 'bg-yellow-500' : st.level === 'low' ? 'bg-red-500' : 'bg-slate-300';
    return (
      <button
        onClick={() => st.level !== 'none' && handleVoteClick(stationId, fuelKey, stationName, FUEL_NAMES[fuelKey])}
        disabled={st.level === 'none'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-all active:scale-95 ${cls} ${st.level !== 'none' ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
        {FUEL_NAMES[fuelKey]}
        {st.level !== 'none' && <span className="ml-0.5">{st.text}</span>}
      </button>
    );
  };

  const navigate = (view) => { setActiveView(view); setSidebarOpen(false); };

  const NavBtn = ({ icon, label, view }) => (
    <button onClick={() => navigate(view)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeView === view ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-600'}`}>
      {icon}{label}
    </button>
  );

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-orange-100">
      {/* Brand */}
      <div className="p-5 border-b border-orange-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md shadow-orange-300/40">
            <Fuel size={18} className="text-white" />
          </div>
          <div>
            <p className="font-black text-slate-800 text-base leading-none">ปั๊มตรัง</p>
            <p className="text-[10px] text-orange-500 font-bold">คนตรังช่วยคนตรัง</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <NavBtn icon={<Fuel size={17} />} label="ภาพรวมน้ำมัน" view="dashboard" />
        <NavBtn icon={<Users size={17} />} label="นักรายงานข่าว" view="leaderboard" />
        {isAdminLoggedIn && <NavBtn icon={<Settings size={17} />} label="จัดการระบบ" view="admin" />}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-orange-100 space-y-3">
        {user ? (
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center text-sm border border-orange-200">{user.avatar}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={() => signOut(auth).then(() => setUser(null))} className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <LogOut size={13} /> ออกจากระบบ
            </button>
          </div>
        ) : (
          <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-orange-300/40">
            {isLoggingIn ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
            {isLoggingIn ? 'กำลังโหลด...' : 'เข้าสู่ระบบ Google'}
          </button>
        )}
        {isAdminLoggedIn && (
          <button onClick={() => { setIsAdminLoggedIn(false); setActiveView('dashboard'); }} className="w-full py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition-colors">
            <Lock size={11} /> ออก Admin
          </button>
        )}
        <div className="flex justify-end">
          <button onClick={() => isAdminLoggedIn ? setActiveView('admin') : setShowAdminLoginModal(true)} className="p-1.5 text-slate-200 hover:text-slate-400 transition-colors" title="Admin">
            <Settings size={13} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-orange-50/30 font-sans overflow-hidden text-slate-800">

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col shadow-2xl"><Sidebar /></div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-orange-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-orange-50" onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-slate-600" /></button>
            <div>
              <h1 className="text-sm font-black text-slate-800">
                {activeView === 'dashboard' ? 'สถานะน้ำมันจังหวัดตรัง' : activeView === 'leaderboard' ? 'นักรายงานข่าว' : 'จัดการระบบ'}
              </h1>
              <p className="text-[10px] text-orange-400 font-semibold">เพื่อนช่วยเพื่อน • คนตรังช่วยคนตรัง ❤️</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-orange-200 disabled:opacity-50">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isLoading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          {activeView === 'dashboard' && (
            <div className="p-4 md:p-5 max-w-6xl mx-auto space-y-4">

              {/* Hero Banner */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl p-5 text-white shadow-lg shadow-orange-300/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold opacity-80 mb-1">🤝 คนตรังช่วยคนตรัง</p>
                    <h2 className="text-xl font-black leading-tight">รู้ก่อน ออกก่อน<br />ไม่ต้องเสียเวลาเข้าคิว!</h2>
                    <p className="text-xs opacity-80 mt-2">อัปเดตจากชาวตรังจริงๆ ทุกวัน</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black">{isLoading ? '...' : stats.total}</p>
                    <p className="text-xs opacity-80">ปั๊มในตรัง</p>
                  </div>
                </div>
              </div>

              {/* Stat Row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "ดีเซล", count: stats.dieselCount, color: "blue" },
                  { label: "G95", count: stats.g95Count, color: "orange" },
                  { label: "G91", count: stats.g91Count, color: "rose" },
                  { label: "E20", count: stats.e20Count, color: "emerald" },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
                    <p className="text-2xl font-black text-slate-800">{isLoading ? '-' : s.count}</p>
                    <p className={`text-[10px] font-bold text-${s.color}-500 mt-0.5`}>{s.label}</p>
                    <p className="text-[9px] text-slate-400">แห่งพร้อม</p>
                  </div>
                ))}
              </div>

              {/* Search & Filter */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อปั๊ม, อำเภอ..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:bg-white transition-all border border-transparent focus:border-orange-200"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-400/20">
                    {districts.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <select value={filterFuel} onChange={e => setFilterFuel(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-400/20">
                    <option value="ทั้งหมด">ทุกประเภท</option>
                    <option value="diesel">ดีเซล</option>
                    <option value="g95">G95</option>
                    <option value="g91">G91</option>
                    <option value="e20">E20</option>
                  </select>
                </div>
              </div>

              {/* Station Cards */}
              {isLoading ? (
                <div className="flex flex-col items-center py-16 text-slate-400">
                  <RefreshCw size={28} className="animate-spin mb-3 text-orange-400" />
                  <p className="text-sm font-medium">กำลังโหลดข้อมูลจากชาวตรัง...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-slate-400">
                  <p className="text-5xl mb-3">⛽</p>
                  <p className="font-bold text-slate-500">ไม่พบปั๊มที่ตรงกัน</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredData.map(station => (
                    <div key={station.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
                      <div className="p-4">
                        <div className="flex gap-3 mb-3">
                          <BrandBadge brand={station.brand} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{station.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={10} className="text-orange-400 flex-shrink-0" />
                              <p className="text-xs text-orange-500 font-semibold">{station.district}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(FUEL_NAMES).map(fuelKey => (
                            <FuelChip key={fuelKey} stationId={station.id} fuelKey={fuelKey} fuelData={station.fuels[fuelKey]} stationName={station.name} />
                          ))}
                        </div>
                      </div>
                      {station.lastUpdated && (
                        <div className="px-4 py-2 border-t border-slate-50 flex items-center gap-1 text-[10px] text-slate-300">
                          <Clock size={9} />
                          อัปเดตล่าสุด {station.lastUpdated}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              {!user && !isLoading && data.length > 0 && (
                <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-black text-slate-800 text-base">🤝 ช่วยเพื่อนในตรังด้วยกัน!</p>
                    <p className="text-xs text-slate-500 mt-1">เข้าสู่ระบบแล้วกดโหวตสถานะน้ำมัน ใช้เวลาไม่ถึง 5 วินาที</p>
                  </div>
                  <button onClick={handleGoogleLogin} className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
                    เข้าร่วมชุมชน →
                  </button>
                </div>
              )}
            </div>
          )}

          {activeView === 'leaderboard' && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <p className="text-5xl mb-4">🌟</p>
              <h2 className="text-xl font-black text-slate-700">นักรายงานข่าวชาวตรัง</h2>
              <p className="text-slate-400 text-sm mt-1">ฟีเจอร์นี้กำลังจะมาเร็วๆ นี้ครับ!</p>
            </div>
          )}

          {activeView === 'admin' && isAdminLoggedIn && (
            <div className="p-4 md:p-5 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-bold flex items-center gap-2 text-slate-700"><Settings size={16} className="text-orange-500" /> จัดการสถานีบริการ</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-bold">
                      <tr>
                        <th className="px-5 py-3">ปั๊ม</th>
                        <th className="px-5 py-3 hidden sm:table-cell">อำเภอ</th>
                        <th className="px-5 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.map(s => (
                        <tr key={s.id} className="hover:bg-orange-50/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <BrandBadge brand={s.brand} />
                              <div><p className="font-bold text-slate-700 text-sm">{s.name}</p><p className="text-xs text-slate-400 sm:hidden">{s.district}</p></div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{s.district}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setEditModal({ isOpen: true, station: s })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-all">
                              <Edit size={12} /> แก้ไข
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* VOTE MODAL */}
      {voteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-400 p-5 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-lg leading-none">{voteModal.fuelName}</p>
                  <p className="text-xs opacity-80 mt-1 line-clamp-2">{voteModal.stationName}</p>
                </div>
                <button onClick={() => setVoteModal({ ...voteModal, isOpen: false })} className="bg-white/20 rounded-lg p-1"><X size={16} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs text-center text-slate-400 mb-4 font-medium">ตอนนี้ <span className="font-bold text-orange-600">{voteModal.fuelName}</span> ที่ปั๊มนี้เป็นยังไงบ้างครับ?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => submitVote('have')} className="flex flex-col items-center gap-2 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                  <span className="font-black text-emerald-700">✅ มีอยู่!</span>
                </button>
                <button onClick={() => submitVote('out')} className="flex flex-col items-center gap-2 p-5 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-300 active:scale-95 transition-all">
                  <XCircle size={32} className="text-red-500" />
                  <span className="font-black text-red-700">❌ หมดแล้ว</span>
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-300 mt-3 font-medium">ข้อมูลของคุณช่วยชาวตรังประหยัดเวลา 🙏</p>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-400 p-5 text-white text-center">
              <Heart size={28} className="mx-auto mb-2" />
              <p className="font-black text-lg">เข้าร่วมชุมชนตรัง</p>
              <p className="text-xs opacity-80 mt-1">เพื่อร่วมรายงานสถานะน้ำมัน</p>
            </div>
            <div className="p-5 space-y-3">
              <button onClick={handleGoogleLogin} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <LogIn size={16} /> เข้าสู่ระบบด้วย Google
              </button>
              <button onClick={() => setShowLoginModal(false)} className="w-full text-slate-400 hover:text-slate-600 py-1.5 text-sm font-medium transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-5 text-white text-center">
              <Lock size={24} className="mx-auto mb-2 text-orange-400" />
              <p className="font-black">Admin Login</p>
            </div>
            <form onSubmit={handleAdminLogin} className="p-5 space-y-3">
              <input type="text" required placeholder="Username" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" value={adminLoginForm.username} onChange={e => setAdminLoginForm({...adminLoginForm, username: e.target.value})} />
              <input type="password" required placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all" value={adminLoginForm.password} onChange={e => setAdminLoginForm({...adminLoginForm, password: e.target.value})} />
              {adminLoginError && <p className="text-red-500 text-xs font-bold text-center">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm transition-all">เข้าสู่ระบบ</button>
              <button type="button" onClick={() => setShowAdminLoginModal(false)} className="w-full text-slate-400 text-sm py-1 hover:text-slate-600 transition-colors">ยกเลิก</button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal.isOpen && editModal.station && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-slate-800">แก้ไขสถานีบริการ</h2>
              <button onClick={() => setEditModal({ isOpen: false, station: null })} className="p-1.5 bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.target); saveAdminEdit({ ...editModal.station, name: f.get('name'), brand: f.get('brand'), district: f.get('district') }); }} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อสถานีบริการ</label>
                <input name="name" defaultValue={editModal.station.name} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">แบรนด์</label>
                  <select name="brand" defaultValue={editModal.station.brand} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20">
                    {["ปตท.", "บางจาก", "เชลล์", "พีที", "คาลเท็กซ์", "อิสระ"].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">อำเภอ</label>
                  <select name="district" defaultValue={editModal.station.district} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20">
                    {["เมืองตรัง","ห้วยยอด","กันตัง","ย่านตาขาว","ปะเหลียน","สิเกา","วังวิเศษ","นาโยง","รัษฎา","หาดสำราญ"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal({ isOpen: false, station: null })} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">ยกเลิก</button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {isUpdating ? 'บันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
