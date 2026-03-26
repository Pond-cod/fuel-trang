import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, MapPin, Users, LayoutDashboard, Filter, 
  Map, Check, X, Minus, Clock, RefreshCw, Droplet, Fuel, 
  ChevronDown, Bell, Activity, CheckCircle2, XCircle,
  Trophy, Medal, Star, LogOut, LogIn, Edit, Settings, Save, Lock,
  Zap, AlertTriangle, Menu
} from 'lucide-react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const FUEL_NAMES = {
  diesel: "ดีเซล",
  g95: "G95",
  g91: "G91",
  e20: "E20"
};

const FUEL_COLORS = {
  diesel: { dot: "bg-blue-500", badge: "text-blue-600", light: "bg-blue-50" },
  g95: { dot: "bg-orange-500", badge: "text-orange-600", light: "bg-orange-50" },
  g91: { dot: "bg-rose-500", badge: "text-rose-600", light: "bg-rose-50" },
  e20: { dot: "bg-emerald-500", badge: "text-emerald-600", light: "bg-emerald-50" },
};

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
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
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
      setUser({
        name: result.user.displayName,
        email: result.user.email,
        avatar: result.user.displayName ? result.user.displayName.charAt(0).toUpperCase() : "U"
      });
      setShowLoginModal(false);
    } catch (error) {
      console.error("Login failed", error);
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLoginForm)
      });
      if (response.ok) {
        setIsAdminLoggedIn(true);
        setShowAdminLoginModal(false);
        setActiveView('admin');
        setAdminLoginError('');
        setAdminLoginForm({ username: '', password: '' });
      } else {
        setAdminLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      setAdminLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setActiveView('dashboard');
  };

  const handleVoteClick = (stationId, fuelKey, stationName, fuelName) => {
    if (!user) {
      setShowLoginModal(true);
    } else {
      setVoteModal({ isOpen: true, stationId, fuelKey, stationName, fuelName });
    }
  };

  const submitVote = async (type) => {
    setData(prev => prev.map(station => {
      if (station.id === voteModal.stationId) {
        const current = station.fuels[voteModal.fuelKey];
        return {
          ...station,
          lastUpdated: new Date().toLocaleString('th-TH'),
          fuels: {
            ...station.fuels,
            [voteModal.fuelKey]: {
              ...current,
              [type]: current[type] + 1
            }
          }
        };
      }
      return station;
    }));
    const payload = { stationId: voteModal.stationId, fuelKey: voteModal.fuelKey, voteType: type };
    setVoteModal({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });
    try {
      await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (error) {
      console.error("Vote failed", error);
    }
  };

  const saveAdminEdit = async (updatedStation) => {
    setIsUpdating(true);
    const payload = { stationId: updatedStation.id, name: updatedStation.name, brand: updatedStation.brand, district: updatedStation.district };
    try {
      const response = await fetch('/api/admin/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (response.ok) {
        setData(prev => prev.map(s => s.id === updatedStation.id ? { ...s, ...updatedStation } : s));
        setEditModal({ isOpen: false, station: null });
      } else {
        alert("ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch (error) {
      console.error("Update failed", error);
    }
    setIsUpdating(false);
  };

  const districts = useMemo(() => ["ทั้งหมด", ...new Set(data.map(s => s.district))], [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.district.includes(searchTerm);
      const matchDistrict = filterDistrict === "ทั้งหมด" || item.district === filterDistrict;
      const matchFuel = filterFuel === "ทั้งหมด" || (() => {
        const f = item.fuels[filterFuel];
        if (!f) return false;
        const total = f.have + f.out;
        return total > 0 && (f.have / total) >= 0.3;
      })();
      return matchSearch && matchDistrict && matchFuel;
    });
  }, [data, searchTerm, filterDistrict, filterFuel]);

  const isAvailable = (fuelData) => {
    if (!fuelData) return false;
    const total = fuelData.have + fuelData.out;
    if (total === 0) return false;
    return (fuelData.have / total) >= 0.5;
  };

  const stats = useMemo(() => {
    const total = filteredData.length;
    const dieselCount = filteredData.filter(d => isAvailable(d.fuels.diesel)).length;
    const g95Count = filteredData.filter(d => isAvailable(d.fuels.g95)).length;
    const g91Count = filteredData.filter(d => isAvailable(d.fuels.g91)).length;
    const e20Count = filteredData.filter(d => isAvailable(d.fuels.e20)).length;
    return { total, dieselCount, g95Count, g91Count, e20Count };
  }, [filteredData]);

  const getFuelStatus = (fuelData) => {
    if (!fuelData) return { level: 'none', percent: 0, text: 'รอข้อมูล' };
    const total = fuelData.have + fuelData.out;
    if (total === 0) return { level: 'none', percent: 0, text: 'รอข้อมูล' };
    const percent = Math.round((fuelData.have / total) * 100);
    if (percent >= 60) return { level: 'high', percent, text: 'มีเลย!' };
    if (percent >= 30) return { level: 'mid', percent, text: 'มีบ้าง' };
    return { level: 'low', percent, text: 'ใกล้หมด' };
  };

  const FuelBadge = ({ stationId, fuelKey, fuelData, stationName }) => {
    const status = getFuelStatus(fuelData);
    const color = FUEL_COLORS[fuelKey];
    let badgeClass = "";
    if (status.level === 'none') badgeClass = "bg-slate-100 text-slate-400 border-slate-200";
    else if (status.level === 'high') badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
    else if (status.level === 'mid') badgeClass = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 cursor-pointer";
    else badgeClass = "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer";

    return (
      <button
        onClick={() => status.level !== 'none' && handleVoteClick(stationId, fuelKey, stationName, FUEL_NAMES[fuelKey])}
        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${badgeClass}`}
        disabled={status.level === 'none'}
      >
        <span className={`w-2 h-2 rounded-full ${status.level === 'high' ? 'bg-emerald-500' : status.level === 'mid' ? 'bg-amber-500' : status.level === 'low' ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
        <span className="text-[10px] leading-tight">{FUEL_NAMES[fuelKey]}</span>
        <span>{status.text}</span>
      </button>
    );
  };

  const BrandBadge = ({ brand }) => {
    const colors = {
      "ปตท.": "bg-blue-600 text-white",
      "บางจาก": "bg-green-600 text-white",
      "เชลล์": "bg-yellow-400 text-red-700",
      "พีที": "bg-green-500 text-white",
      "คาลเท็กซ์": "bg-red-600 text-white"
    };
    return (
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-[10px] font-black shadow-sm flex-shrink-0 ${colors[brand] || "bg-slate-300 text-slate-700"}`}>
        {brand.substring(0, 2)}
      </span>
    );
  };

  const NavItem = ({ icon, label, view }) => (
    <button
      onClick={() => { setActiveView(view); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
        activeView === view ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-slate-100">
      <div className="h-16 flex items-center px-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-400/40">
          <Fuel size={16} className="text-white" />
        </div>
        <span className="ml-2.5 font-black text-lg text-slate-800">FuelRadar</span>
        <span className="ml-1 text-xs font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">ตรัง</span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">เมนูหลัก</p>
        <NavItem icon={<LayoutDashboard size={18} />} label="ภาพรวมสถานีน้ำมัน" view="dashboard" />
        <NavItem icon={<Trophy size={18} />} label="กระดานนักโหวต" view="leaderboard" />
        {isAdminLoggedIn && (
          <NavItem icon={<Settings size={18} />} label="จัดการระบบ" view="admin" />
        )}
      </nav>

      <div className="p-3 border-t border-slate-100">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200">
                {user.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-rose-500 hover:bg-rose-50 text-xs font-bold transition-colors">
              <LogOut size={14} /> ออกจากระบบ
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            {isLoggingIn ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
            {isLoggingIn ? "กำลังโหลด..." : "เข้าสู่ระบบ Google"}
          </button>
        )}
        {isAdminLoggedIn && (
          <button onClick={handleAdminLogout} className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-indigo-500 hover:bg-indigo-50 text-xs font-bold transition-colors">
            <Lock size={12} /> ออก Admin
          </button>
        )}
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => { if (isAdminLoggedIn) setActiveView('admin'); else setShowAdminLoginModal(true); }}
            className="p-1.5 rounded-lg text-slate-200 hover:text-slate-500 hover:bg-slate-100 transition-all"
            title="จัดการระบบ"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden text-slate-800">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 flex-shrink-0 z-20">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col bg-white shadow-2xl">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-6 z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-800">
                {activeView === 'dashboard' ? 'สถานะน้ำมันจังหวัดตรัง' : activeView === 'leaderboard' ? 'กระดานนักโหวต' : 'จัดการระบบ'}
              </h1>
              <p className="text-xs text-slate-400 hidden md:block">อัปเดตโดยชาวตรัง เพื่อชาวตรัง</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isLoading ? "กำลังโหลด..." : "อัปเดต"}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {activeView === 'dashboard' && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                <div className="col-span-2 md:col-span-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-400 font-semibold mb-1">ปั๊มน้ำมันทั้งหมด</p>
                  <p className="text-3xl font-black text-slate-800">{isLoading ? <RefreshCw size={24} className="animate-spin text-slate-300" /> : stats.total}</p>
                  <p className="text-xs text-slate-400 mt-1">แห่งในจังหวัดตรัง</p>
                </div>
                {[
                  { label: "ดีเซล", count: stats.dieselCount, color: "blue" },
                  { label: "G95", count: stats.g95Count, color: "orange" },
                  { label: "G91", count: stats.g91Count, color: "rose" },
                  { label: "E20", count: stats.e20Count, color: "emerald" },
                ].map((s, i) => (
                  <div key={i} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-2xl p-4 shadow-sm`}>
                    <p className={`text-xs font-bold text-${s.color}-600 mb-1`}>{s.label}</p>
                    <p className="text-2xl font-black text-slate-800">{isLoading ? '-' : s.count}</p>
                    <p className="text-xs text-slate-400 mt-1">แห่งพร้อมบริการ</p>
                  </div>
                ))}
              </div>

              {/* Search & Filter */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="🔍  ค้นหาชื่อปั๊ม, อำเภอ..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all border border-slate-100"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterDistrict}
                      onChange={(e) => setFilterDistrict(e.target.value)}
                      className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      {districts.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <select
                      value={filterFuel}
                      onChange={(e) => setFilterFuel(e.target.value)}
                      className="flex-1 sm:flex-none bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="ทั้งหมด">ทุกน้ำมัน</option>
                      <option value="diesel">เฉพาะดีเซล</option>
                      <option value="g95">เฉพาะ G95</option>
                      <option value="g91">เฉพาะ G91</option>
                      <option value="e20">เฉพาะ E20</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Station Cards */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <RefreshCw size={32} className="animate-spin mb-3" />
                  <p className="text-sm font-medium">กำลังโหลดข้อมูล...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <p className="text-4xl mb-3">⛽</p>
                  <p className="text-sm font-medium">ไม่พบปั๊มน้ำมันที่ตรงกัน</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredData.map((station) => (
                    <div key={station.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <BrandBadge brand={station.brand} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{station.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                            <p className="text-xs text-slate-400 font-medium truncate">{station.district}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.keys(FUEL_NAMES).map(fuelKey => (
                          <FuelBadge
                            key={fuelKey}
                            stationId={station.id}
                            fuelKey={fuelKey}
                            fuelData={station.fuels[fuelKey]}
                            stationName={station.name}
                          />
                        ))}
                      </div>
                      {station.lastUpdated && (
                        <p className="mt-2.5 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                          <Clock size={10} />
                          {station.lastUpdated}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!user && !isLoading && data.length > 0 && (
                <div className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-blue-500/20">
                  <div>
                    <p className="font-bold text-lg">ร่วมอัปเดตสถานะให้ชาวตรัง! 🙏</p>
                    <p className="text-sm text-blue-100 mt-0.5">เข้าสู่ระบบเพื่อกดโหวตสถานะน้ำมัน ช่วยเพื่อนบ้านประหยัดเวลา</p>
                  </div>
                  <button
                    onClick={handleGoogleLogin}
                    className="flex-shrink-0 flex items-center gap-2 bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <LogIn size={16} /> เข้าสู่ระบบ
                  </button>
                </div>
              )}
            </div>
          )}

          {activeView === 'leaderboard' && (
            <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-black text-slate-700">กระดานนักโหวต</h2>
              <p className="text-slate-400 mt-2">ฟีเจอร์นี้กำลังจะมาเร็วๆ นี้!</p>
            </div>
          )}

          {activeView === 'admin' && isAdminLoggedIn && (
            <div className="p-4 md:p-6 max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings size={18} className="text-indigo-600" /> จัดการสถานีบริการ</h3>
                    <p className="text-xs text-slate-400 mt-0.5">คลิกแก้ไขเพื่อปรับข้อมูล</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase">ปั๊ม</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase hidden sm:table-cell">อำเภอ</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-400 uppercase text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.map(station => (
                        <tr key={station.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <BrandBadge brand={station.brand} />
                              <div>
                                <p className="font-bold text-slate-700 text-sm">{station.name}</p>
                                <p className="text-xs text-slate-400 sm:hidden">{station.district}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-500 text-sm hidden sm:table-cell">{station.district}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => setEditModal({ isOpen: true, station })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                            >
                              <Edit size={13} /> แก้ไข
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

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4"><Lock size={28} /></div>
              <h2 className="text-xl font-black text-slate-800">เข้าสู่ระบบ Admin</h2>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input type="text" required placeholder="Username" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" value={adminLoginForm.username} onChange={(e) => setAdminLoginForm({...adminLoginForm, username: e.target.value})} />
              <input type="password" required placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" value={adminLoginForm.password} onChange={(e) => setAdminLoginForm({...adminLoginForm, password: e.target.value})} />
              {adminLoginError && <p className="text-rose-500 text-xs font-bold text-center">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-all mt-1">เข้าสู่ระบบ</button>
              <button type="button" onClick={() => setShowAdminLoginModal(false)} className="w-full text-slate-400 hover:text-slate-600 py-2 text-sm transition-colors">ยกเลิก</button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STATION MODAL */}
      {editModal.isOpen && editModal.station && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-slate-800">แก้ไขข้อมูลสถานี</h2>
              <button onClick={() => setEditModal({ isOpen: false, station: null })} className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.target); saveAdminEdit({ ...editModal.station, name: f.get('name'), brand: f.get('brand'), district: f.get('district') }); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อสถานีบริการ</label>
                <input name="name" defaultValue={editModal.station.name} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">แบรนด์</label>
                  <select name="brand" defaultValue={editModal.station.brand} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                    {["ปตท.", "บางจาก", "เชลล์", "พีที", "คาลเท็กซ์", "อิสระ"].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">อำเภอ</label>
                  <select name="district" defaultValue={editModal.station.district} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                    {["เมืองตรัง","ห้วยยอด","กันตัง","ย่านตาขาว","ปะเหลียน","สิเกา","วังวิเศษ","นาโยง","รัษฎา","หาดสำราญ"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal({ isOpen: false, station: null })} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all">ยกเลิก</button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {isUpdating ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4"><LogIn size={28} /></div>
            <h2 className="text-xl font-black text-slate-800 mb-1">เข้าสู่ระบบ</h2>
            <p className="text-sm text-slate-400 mb-6">เพื่อร่วมรายงานสถานะน้ำมัน</p>
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition-all">
              เข้าสู่ระบบด้วย Google
            </button>
            <button onClick={() => setShowLoginModal(false)} className="w-full mt-3 text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* VOTE MODAL */}
      {voteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-800">รายงานสถานะ</h2>
                <p className="text-sm text-slate-400 mt-0.5"><span className="font-bold text-blue-600">{voteModal.fuelName}</span> · {voteModal.stationName}</p>
              </div>
              <button onClick={() => setVoteModal({ ...voteModal, isOpen: false })} className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 text-center bg-blue-50 py-2.5 px-3 rounded-xl mb-4 font-medium">ข้อมูลของคุณจะช่วยคนอื่นๆ ในตรังได้ครับ 🙏</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => submitVote('have')} className="flex flex-col items-center gap-3 p-5 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-95">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <span className="font-bold text-base">✅ ยังมีอยู่</span>
              </button>
              <button onClick={() => submitVote('out')} className="flex flex-col items-center gap-3 p-5 bg-rose-50 border-2 border-rose-100 rounded-xl text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95">
                <XCircle size={36} className="text-rose-500" />
                <span className="font-bold text-base">❌ หมดแล้ว</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
