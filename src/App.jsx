import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, MapPin, Users, LayoutDashboard, Filter, 
  Map, Check, X, Minus, Clock, RefreshCw, Droplet, Fuel, 
  ChevronDown, Bell, Activity, CheckCircle2, XCircle,
  Trophy, Medal, Star, LogOut, LogIn, Edit, Settings, Save, Lock
} from 'lucide-react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const FUEL_NAMES = {
  diesel: "ดีเซล",
  g95: "แก๊สโซฮอล์ 95",
  g91: "แก๊สโซฮอล์ 91",
  e20: "แก๊สโซฮอล์ E20"
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
  
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("ทั้งหมด");
  const [filterBrand, setFilterBrand] = useState("ทั้งหมด");
  
  const [voteModal, setVoteModal] = useState({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });
  const [editModal, setEditModal] = useState({ isOpen: false, station: null });
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stations');
      console.log("Response status:", response.status);
      if (response.ok) {
        const result = await response.json();
        console.log("Fetched stations:", result.length);
        setData(result);
      } else {
        console.error("Failed to fetch stations:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Check if URL ends with /admin to show login modal
    if (window.location.pathname === '/admin') {
      setShowAdminLoginModal(true);
      // Clean up URL without refreshing
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
      console.error("Admin login error:", error);
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
    // Optimistic UI update
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

    const payload = {
      stationId: voteModal.stationId,
      fuelKey: voteModal.fuelKey,
      voteType: type
    };
    
    setVoteModal({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });

    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("Vote failed", error);
      // Optional: rollback on failure
    }
  };

  const saveAdminEdit = async (updatedStation) => {
    setIsUpdating(true);
    const payload = {
      stationId: updatedStation.id,
      name: updatedStation.name,
      brand: updatedStation.brand,
      district: updatedStation.district
    };

    try {
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Update local state immediately
        setData(prev => prev.map(s => s.id === updatedStation.id ? { ...s, ...updatedStation } : s));
        setEditModal({ isOpen: false, station: null });
      } else {
        alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Update failed", error);
    }
    setIsUpdating(false);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.district.includes(searchTerm);
      const matchDistrict = filterDistrict === "ทั้งหมด" || item.district === filterDistrict;
      const matchBrand = filterBrand === "ทั้งหมด" || item.brand === filterBrand;
      return matchSearch && matchDistrict && matchBrand;
    });
  }, [data, searchTerm, filterDistrict, filterBrand]);

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

  const renderFuelStatus = (stationId, fuelKey, fuelData, stationName) => {
    if (!fuelData) return null;
    const total = fuelData.have + fuelData.out;
    const percent = total === 0 ? 0 : Math.round((fuelData.have / total) * 100);
    const fuelName = FUEL_NAMES[fuelKey];

    let badgeClass = "";
    let indicatorClass = "";
    let text = "";

    if (total === 0) {
      badgeClass = "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200";
      indicatorClass = "bg-slate-400";
      text = "รอข้อมูล";
    } else if (percent >= 60) {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
      indicatorClass = "bg-emerald-500";
      text = `${percent}% มี`;
    } else if (percent >= 30) {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
      indicatorClass = "bg-amber-500";
      text = `${percent}% มี`;
    } else {
      badgeClass = "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100";
      indicatorClass = "bg-rose-500";
      text = "หมด";
    }

    return (
      <button 
        onClick={() => handleVoteClick(stationId, fuelKey, stationName, fuelName)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border transition-all active:scale-95 cursor-pointer shadow-sm min-w-[70px] justify-center ${badgeClass}`}
        title={user ? `คลิกเพื่ออัปเดตสถานะ ${fuelName}` : "เข้าสู่ระบบเพื่อร่วมโหวต"}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${indicatorClass}`}></div>
        {text}
      </button>
    );
  };

  const BrandLogo = ({ brand }) => {
    const colors = {
      "ปตท.": "bg-blue-600 text-white",
      "บางจาก": "bg-emerald-600 text-white",
      "เชลล์": "bg-amber-400 text-red-600",
      "พีที": "bg-green-500 text-white",
      "คาลเท็กซ์": "bg-red-600 text-white"
    };
    return (
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${colors[brand] || "bg-slate-200 text-slate-600"}`}>
        {brand.substring(0, 3)}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden text-slate-800">
      
      <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        <div className="h-20 flex items-center px-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Fuel size={22} />
          </div>
          <span className="ml-3 font-black text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
            FuelRadar.
          </span>
        </div>

        <div className="py-6 px-4 space-y-2">
          <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Main Menu</p>
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
              activeView === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard size={18} />
            แดชบอร์ดสถานะ
          </button>
          <button 
            onClick={() => setActiveView('leaderboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
              activeView === 'leaderboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Users size={18} />
            กระดานนักโหวต
          </button>

          {/* Admin button removed from here and moved to a small icon at the bottom */}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 mt-auto">
          {user ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">
                  {user.avatar}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 text-sm font-semibold transition-colors"
              >
                <LogOut size={16} /> ออกจากระบบ
              </button>
            </>
          ) : (
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-3 px-2">เข้าสู่ระบบเพื่อร่วมโหวตอัปเดตสถานะน้ำมัน</p>
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm shadow-blue-500/30 disabled:opacity-70 active:scale-95"
              >
                {isLoggingIn ? <RefreshCw className="animate-spin text-white" size={16} /> : <LogIn size={16} />}
                {isLoggingIn ? "กำลังโหลด..." : "เข้าสู่ระบบด้วย Google"}
              </button>
            </div>
          )}
          
          {isAdminLoggedIn && (
            <button 
              onClick={handleAdminLogout}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-sm font-semibold transition-colors"
            >
              <Lock size={14} /> ออกจากระบบ Admin
            </button>
          )}

          {/* Subtle Admin Entry (Small Gear) */}
          <div className="mt-4 flex justify-start px-2">
            <button 
              onClick={() => {
                if (isAdminLoggedIn) setActiveView('admin');
                else setShowAdminLoginModal(true);
              }}
              className={`p-2 rounded-lg transition-all ${
                activeView === 'admin' ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
              }`}
              title="จัดการระบบ"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              {activeView === 'dashboard' ? 'ภาพรวมน้ำมันจังหวัดตรัง' : 
               activeView === 'leaderboard' ? 'สุดยอดผู้รายงานสถานะน้ำมัน' : 
               'จัดการระบบสถานีบริการ'}
            </h1>
          </div>
          <div className="flex items-center gap-5">
            {activeView === 'dashboard' && (
              <div className="relative hidden md:block w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อปั๊ม, ถนน..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {activeView === 'dashboard' && (
            <div className="animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-8">
                <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Map size={60} /></div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">จำนวนปั๊มที่พบ</p>
                  <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
                </div>

                {[
                  { label: "ดีเซล พร้อมบริการ", count: stats.dieselCount, color: "blue" },
                  { label: "G95 พร้อมบริการ", count: stats.g95Count, color: "orange" },
                  { label: "G91 พร้อมบริการ", count: stats.g91Count, color: "rose" },
                  { label: "E20 พร้อมบริการ", count: stats.e20Count, color: "emerald" },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] border border-slate-100 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{stat.label}</p>
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800">{stat.count}</h3>
                        <span className="text-sm font-semibold text-slate-400">แห่ง</span>
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-500 mb-1`}><Droplet size={20} fill="currentColor" /></div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Activity size={20} className="text-blue-500" /> สถานะคลังน้ำมัน
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">อัปเดตสถานะแบบเรียลไทม์จากเครือข่ายภาคประชาชน</p>
                  </div>
                  <button onClick={fetchData} disabled={isLoading} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50">
                    <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> {isLoading ? "กำลังโหลด..." : "ซิงค์ข้อมูลล่าสุด"}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">สถานีบริการ</th>
                        <th className="px-4 py-4 text-center font-bold text-slate-500 text-xs uppercase tracking-wider"><span className="text-blue-500">●</span> ดีเซล</th>
                        <th className="px-4 py-4 text-center font-bold text-slate-500 text-xs uppercase tracking-wider"><span className="text-orange-500">●</span> G95</th>
                        <th className="px-4 py-4 text-center font-bold text-slate-500 text-xs uppercase tracking-wider"><span className="text-rose-500">●</span> G91</th>
                        <th className="px-4 py-4 text-center font-bold text-slate-500 text-xs uppercase tracking-wider"><span className="text-emerald-500">●</span> E20</th>
                        <th className="px-4 py-4 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">อำเภอ</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">อัปเดตล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((station) => (
                        <tr key={station.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <BrandLogo brand={station.brand} />
                              <div>
                                <p className="font-bold text-slate-800">{station.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">{renderFuelStatus(station.id, 'diesel', station.fuels.diesel, station.name)}</td>
                          <td className="px-4 py-4 text-center">{renderFuelStatus(station.id, 'g95', station.fuels.g95, station.name)}</td>
                          <td className="px-4 py-4 text-center">{renderFuelStatus(station.id, 'g91', station.fuels.g91, station.name)}</td>
                          <td className="px-4 py-4 text-center">{renderFuelStatus(station.id, 'e20', station.fuels.e20, station.name)}</td>
                          <td className="px-4 py-4 text-center font-medium text-slate-600">{station.district}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-slate-500 text-xs">{station.lastUpdated || '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'leaderboard' && (
            <div className="animate-in fade-in duration-300">
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-500 mb-4 shadow-sm"><Trophy size={32} /></div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">กระดานนักโหวตยอดเยี่ยม</h2>
                <p className="text-slate-500 mt-2">ขอบคุณทุกท่านที่ร่วมแชร์ข้อมูลสถานะน้ำมันเพื่อชาวตรัง</p>
              </div>
            </div>
          )}

          {activeView === 'admin' && isAdminLoggedIn && (
            <div className="animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h3 className="font-black text-slate-800 text-xl flex items-center gap-2">
                      <Settings size={24} className="text-indigo-600" /> จัดการข้อมูลสถานีบริการ
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">แก้ไขข้อมูลปั๊มน้ำมันและอำเภอโดยตรง</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-8 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-8 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">ชื่อสถานี</th>
                        <th className="px-8 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">แบรนด์</th>
                        <th className="px-8 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">อำเภอ</th>
                        <th className="px-8 py-4 text-right font-bold text-slate-500 text-xs uppercase tracking-wider">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((station) => (
                        <tr key={station.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-8 py-5 text-slate-400 font-mono text-xs">#{station.id}</td>
                          <td className="px-8 py-5 font-bold text-slate-800">{station.name}</td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <BrandLogo brand={station.brand} />
                              <span className="font-semibold text-slate-600">{station.brand}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 font-bold text-slate-600">{station.district}</td>
                          <td className="px-8 py-5 text-right">
                            <button 
                              onClick={() => setEditModal({ isOpen: true, station })}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                            >
                              <Edit size={14} /> แก้ไขข้อมูล
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
            <button onClick={() => setShowAdminLoginModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20} /></button>
            <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100 shadow-inner">
              <Lock size={36} />
            </div>
            <h2 className="text-2xl font-black text-center text-slate-800 mb-2 tracking-tight">Admin Login</h2>
            <p className="text-sm text-center text-slate-500 mb-8">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบหลังบ้าน</p>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="กรอกชื่อผู้ใช้"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                  value={adminLoginForm.username}
                  onChange={(e) => setAdminLoginForm({...adminLoginForm, username: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                  value={adminLoginForm.password}
                  onChange={(e) => setAdminLoginForm({...adminLoginForm, password: e.target.value})}
                />
              </div>
              {adminLoginError && <p className="text-rose-500 text-xs font-bold text-center mt-2">{adminLoginError}</p>}
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-500/30 active:scale-95 mt-4"
              >
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STATION MODAL */}
      {editModal.isOpen && editModal.station && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">แก้ไขข้อมูลสถานี</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Station ID: #{editModal.station.id}</p>
              </div>
              <button 
                onClick={() => setEditModal({ isOpen: false, station: null })}
                className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              saveAdminEdit({
                ...editModal.station,
                name: formData.get('name'),
                brand: formData.get('brand'),
                district: formData.get('district')
              });
            }} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">ชื่อสถานีบริการ</label>
                <input 
                  name="name"
                  defaultValue={editModal.station.name}
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">แบรนด์</label>
                  <select 
                    name="brand"
                    defaultValue={editModal.station.brand}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="ปตท.">ปตท.</option>
                    <option value="บางจาก">บางจาก</option>
                    <option value="เชลล์">เชลล์</option>
                    <option value="พีที">พีที</option>
                    <option value="คาลเท็กซ์">คาลเท็กซ์</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">อำเภอ</label>
                  <select 
                    name="district"
                    defaultValue={editModal.station.district}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="เมืองตรัง">เมืองตรัง</option>
                    <option value="ห้วยยอด">ห้วยยอด</option>
                    <option value="กันตัง">กันตัง</option>
                    <option value="ย่านตาขาว">ย่านตาขาว</option>
                    <option value="ปะเหลียน">ปะเหลียน</option>
                    <option value="สิเกา">สิเกา</option>
                    <option value="วังวิเศษ">วังวิเศษ</option>
                    <option value="นาโยง">นาโยง</option>
                    <option value="รัษฎา">รัษฎา</option>
                    <option value="หาดสำราญ">หาดสำราญ</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, station: null })}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isUpdating ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  {isUpdating ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGIN MODAL (Regular User) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20} /></button>
            <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 border border-blue-100 shadow-inner"><LogIn size={36} /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-sm text-slate-500 mb-8 px-4">กรุณาเข้าสู่ระบบด้วย Google เพื่อยืนยันตัวตนก่อนร่วมรายงานสถานะน้ำมัน</p>
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 text-slate-700 px-6 py-4 rounded-2xl font-black transition-all shadow-sm active:scale-95">
              Google Login
            </button>
          </div>
        </div>
      )}

      {/* VOTE MODAL */}
      {voteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">รายงานสถานะน้ำมัน</h2>
                <p className="text-sm text-slate-500 font-bold mt-1"><span className="text-blue-600">{voteModal.fuelName}</span> @ {voteModal.stationName}</p>
              </div>
              <button onClick={() => setVoteModal({ ...voteModal, isOpen: false })} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20} /></button>
            </div>
            <p className="text-sm text-center text-slate-600 mb-6 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 font-medium">ข้อมูลของคุณจะช่วยอัปเดตสถานะให้ผู้ใช้งานท่านอื่นแบบเรียลไทม์</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => submitVote('have')} className="flex flex-col items-center justify-center gap-4 p-8 bg-emerald-50 border-2 border-emerald-100 rounded-3xl text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 transition-all active:scale-95 group">
                <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><CheckCircle2 className="h-10 w-10 text-emerald-500" /></div>
                <span className="font-black text-lg tracking-wide">ยังมีอยู่</span>
              </button>
              <button onClick={() => submitVote('out')} className="flex flex-col items-center justify-center gap-4 p-8 bg-rose-50 border-2 border-rose-100 rounded-3xl text-rose-700 hover:bg-rose-100 hover:border-rose-200 transition-all active:scale-95 group">
                <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><XCircle className="h-10 w-10 text-rose-500" /></div>
                <span className="font-black text-lg tracking-wide">หมดแล้ว</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
