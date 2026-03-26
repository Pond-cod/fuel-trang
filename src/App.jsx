import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, MapPin, RefreshCw, Droplet, Fuel, 
  X, Clock, CheckCircle2, XCircle,
  LogOut, LogIn, Edit, Settings, Save, Lock, Heart,
  Menu, Users, Star, Megaphone, Trash2, Plus, ExternalLink, Image, Video, MessageSquare, User, Info
} from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const FUEL_NAMES = { diesel: "ดีเซล", g95: "G95", g91: "G91", e20: "E20" };
const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes

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
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [userNews, setUserNews] = useState([]);
  const [comments, setComments] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsDetailModal, setNewsDetailModal] = useState({ isOpen: false, item: null });
  const [newsFormModal, setNewsFormModal] = useState({ isOpen: false, item: null, imageUrls: [''], videoUrls: [''], type: 'admin' });
  const [siteConfig, setSiteConfig] = useState({ announcement_enabled: 'false', announcement_title: '', announcement_content: '' });
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const logoutTimerRef = useRef(null);

  const doLogout = () => {
    signOut(auth).then(() => {
      setUser(null);
      localStorage.removeItem('fuel_login_time');
    });
  };

  const startLogoutTimer = (loginTime) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    const elapsed = Date.now() - loginTime;
    const remaining = SESSION_DURATION - elapsed;
    if (remaining <= 0) {
      doLogout();
    } else {
      logoutTimerRef.current = setTimeout(() => doLogout(), remaining);
    }
  };

  // Listen to Firebase auth state – persists across refreshes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        let loginTime = parseInt(localStorage.getItem('fuel_login_time'));
        if (!loginTime) {
          loginTime = Date.now();
          localStorage.setItem('fuel_login_time', loginTime.toString());
        }
        // Check if session expired
        if (Date.now() - loginTime > SESSION_DURATION) {
          doLogout();
          return;
        }
        setUser({
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          avatar: firebaseUser.displayName?.charAt(0).toUpperCase() || "U"
        });
        startLogoutTimer(loginTime);
      } else {
        setUser(null);
        localStorage.removeItem('fuel_login_time');
      }
    });
    return () => {
      unsubscribe();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stations');
      if (response.ok) setData(await response.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        setSiteConfig(prev => ({ ...prev, ...config }));
        if (config.announcement_enabled === 'true') setShowAnnouncement(true);
      }
    } catch (e) { console.error('Config error:', e); }
  };
  useEffect(() => {
    fetchData();
    fetchNews();
    fetchUserNews();
    fetchConfig();
    if (window.location.pathname === '/admin') {
      setShowAdminLoginModal(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loginTime = Date.now();
      localStorage.setItem('fuel_login_time', loginTime.toString());
      setUser({ name: result.user.displayName, email: result.user.email, avatar: result.user.displayName?.charAt(0).toUpperCase() || "U" });
      startLogoutTimer(loginTime);
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

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/config', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ config: siteConfig }) 
      });
      if (res.ok) alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (e) { alert('เกิดข้อผิดพลาดในการบันทึก'); }
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
    const payload = { stationId: voteModal.stationId, fuelKey: voteModal.fuelKey, voteType: type, userName: user?.name || '', userEmail: user?.email || '' };
    setVoteModal({ isOpen: false, stationId: null, fuelKey: null, stationName: "", fuelName: "" });
    try {
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      console.log('Vote result:', result);
      // Re-fetch fresh data from server after 1 second
      setTimeout(() => fetchData(), 1000);
    } catch (e) {
      console.error('Vote error:', e);
    }
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
    if (!fuelData) return { level: 'none', text: '—', percent: 0 };
    const total = fuelData.have + fuelData.out;
    if (total === 0) return { level: 'none', text: '—', percent: 0 };
    const pct = Math.round(fuelData.have / total * 100);
    if (pct >= 60) return { level: 'high', text: 'มี', percent: pct };
    if (pct >= 30) return { level: 'mid', text: 'มีบ้าง', percent: pct };
    return { level: 'low', text: 'หมด', percent: pct };
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
        {st.level !== 'none' && <span className="ml-0.5">{st.percent}% {st.text}</span>}
      </button>
    );
  };

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) setLeaderboard(await res.json());
    } catch (e) { console.error(e); }
    setLeaderboardLoading(false);
  };

  const fetchNews = async () => {
    setNewsLoading(true);
    try { const res = await fetch('/api/news'); const d = await res.json(); setNews(d); } catch (e) { console.error(e); }
    setNewsLoading(false);
  };

  const fetchUserNews = async () => {
    try { const res = await fetch('/api/user-news'); const d = await res.json(); setUserNews(d); } catch (e) { console.error(e); }
  };

  const fetchComments = async (newsId) => {
    try { 
      const res = await fetch(`/api/comments/${newsId}`); 
      const d = await res.json(); 
      setComments(d); 
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (newsDetailModal.isOpen && newsDetailModal.item) {
      fetchComments(newsDetailModal.item.id);
    }
  }, [newsDetailModal.isOpen, newsDetailModal.item]);

  const saveNews = async (form) => {
    setIsUpdating(true);
    try {
      const isUser = newsFormModal.type === 'user';
      const url = isUser ? '/api/user-news' : (form.id ? '/api/news/update' : '/api/news');
      // Store images and videos as JSON string
      const payload = { 
        ...form, 
        user_name: user?.name,
        user_email: user?.email,
        image_url: JSON.stringify(newsFormModal.imageUrls.filter(u => u.trim() !== '')),
        video_url: JSON.stringify(newsFormModal.videoUrls.filter(u => u.trim() !== ''))
      };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { 
        setNewsFormModal({ isOpen: false, item: null, imageUrls: [''], videoUrls: [''], type: 'admin' }); 
        fetchNews();
        fetchUserNews();
      }
    } catch (e) { console.error(e); }
    setIsUpdating(false);
  };

  const submitComment = async (newsId, content) => {
    if (!user || !content.trim()) return;
    try {
      const payload = { news_id: newsId, user_name: user.name, user_email: user.email, avatar: user.avatar, content };
      const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) fetchComments(newsId);
    } catch (e) { console.error(e); }
  };

  const openNewsForm = (item = null, type = 'admin') => {
    let urls = [''];
    let vurls = [''];
    if (item) {
      if (item.image_url) {
        try {
          const parsed = JSON.parse(item.image_url);
          urls = Array.isArray(parsed) ? (parsed.length > 0 ? parsed : ['']) : [item.image_url];
        } catch (e) { urls = [item.image_url]; }
      }
      if (item.video_url) {
        try {
          const parsed = JSON.parse(item.video_url);
          vurls = Array.isArray(parsed) ? (parsed.length > 0 ? parsed : ['']) : [item.video_url];
        } catch (e) { vurls = [item.video_url]; }
      }
    }
    setNewsFormModal({ isOpen: true, item, imageUrls: urls, videoUrls: vurls, type });
  };

  const addImageField = () => setNewsFormModal(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ''] }));
  const updateImageField = (index, val) => setNewsFormModal(prev => {
    const urls = [...prev.imageUrls];
    urls[index] = val;
    return { ...prev, imageUrls: urls };
  });
  const removeImageField = (index) => setNewsFormModal(prev => {
    const urls = prev.imageUrls.filter((_, i) => i !== index);
    return { ...prev, imageUrls: urls.length > 0 ? urls : [''] };
  });

  const addVideoField = () => setNewsFormModal(prev => ({ ...prev, videoUrls: [...prev.videoUrls, ''] }));
  const updateVideoField = (index, val) => setNewsFormModal(prev => {
    const vurls = [...prev.videoUrls];
    vurls[index] = val;
    return { ...prev, videoUrls: vurls };
  });
  const removeVideoField = (index) => setNewsFormModal(prev => {
    const vurls = prev.videoUrls.filter((_, i) => i !== index);
    return { ...prev, videoUrls: vurls.length > 0 ? vurls : [''] };
  });

  const renderNewsCard = (item, isAdmin = true) => {
    let images = [];
    let videos = [];
    try { images = JSON.parse(item.image_url); if (!Array.isArray(images)) images = [item.image_url]; }
    catch(e) { images = item.image_url ? [item.image_url] : []; }
    try { videos = JSON.parse(item.video_url); if (!Array.isArray(videos)) videos = [item.video_url]; }
    catch(e) { videos = item.video_url ? [item.video_url] : []; }

    return (
      <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-purple-200 transition-all flex flex-col group animate-fade-in">
        {images.length > 0 && (
          <div className="aspect-video w-full overflow-hidden bg-slate-100 relative">
            <img src={images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {images.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                <Image size={10} /> +{images.length - 1}
              </div>
            )}
          </div>
        )}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">{item.created_at}</p>
              {isAdmin ? (
                <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Official</span>
              ) : (
                <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Community</span>
              )}
            </div>
            {videos.length > 0 && <span className="p-1 bg-red-100 text-red-600 rounded-md" title="มีวีดีโอ"><Video size={10} /></span>}
          </div>
          <h3 className="font-black text-slate-800 mb-2 line-clamp-2 leading-tight">{item.title}</h3>
          <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed">{item.content}</p>
          <div className="mt-auto flex justify-between items-center">
            <button onClick={() => setNewsDetailModal({ isOpen: true, item })} className="text-xs font-black text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-all">
              อ่านเนื้อหาทั้งหมด <Plus size={14} />
            </button>
            {item.reference_url && (
              <a href={item.reference_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-300 hover:text-purple-400 transition-all outline-none">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const deleteNews = async (id) => {
    if (!confirm('ลบข่าวนี้?')) return;
    try {
      await fetch(`/api/news/${id}`, { method: 'DELETE' });
      fetchNews();
      fetchUserNews();
    } catch (e) { console.error(e); }
  };

  const navigate = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
    if (view === 'leaderboard') fetchLeaderboard();
    if (view === 'news') fetchNews();
    if (view === 'admin') fetchNews();
  };

  const NavBtn = ({ icon, label, view }) => (
    <button onClick={() => navigate(view)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeView === view ? 'bg-purple-500 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-700'}`}>
      {icon}{label}
    </button>
  );

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-purple-100">
      {/* Brand */}
      <div className="p-5 border-b border-purple-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center shadow-md shadow-purple-300/40">
            <Fuel size={18} className="text-white" />
          </div>
          <div>
            <p className="font-black text-slate-800 text-base leading-none">ปั๊มตรัง</p>
            <p className="text-[10px] text-purple-500 font-bold">คนตรังช่วยคนตรัง</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <NavBtn icon={<Fuel size={17} />} label="ภาพรวมน้ำมัน" view="dashboard" />
        <NavBtn icon={<Megaphone size={17} />} label="ประชาสัมพันธ์" view="news" />
        <NavBtn icon={<Users size={17} />} label="นักรายงานข่าว" view="leaderboard" />
        <button 
          onClick={() => { setShowAnnouncement(true); setSidebarOpen(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-all"
        >
          <Info size={17} className="text-purple-400" /> คู่มือการทำงาน
        </button>
        {isAdminLoggedIn && <NavBtn icon={<Settings size={17} />} label="จัดการระบบ" view="admin" />}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-purple-100 space-y-3">
        {user ? (
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-black flex items-center justify-center text-sm border border-purple-200">{user.avatar}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button onClick={doLogout} className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <LogOut size={13} /> ออกจากระบบ
            </button>
          </div>
        ) : (
          <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-purple-300/40">
            {isLoggingIn ? <RefreshCw size={15} className="animate-spin" /> : <LogIn size={15} />}
            {isLoggingIn ? 'กำลังโหลด...' : 'เข้าสู่ระบบ Google'}
          </button>
        )}
        {isAdminLoggedIn && (
          <button onClick={() => { setIsAdminLoggedIn(false); setActiveView('dashboard'); }} className="w-full py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition-colors">
            <Lock size={11} /> ออก Admin
          </button>
        )}
        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-end w-full">
            <button onClick={() => isAdminLoggedIn ? setActiveView('admin') : setShowAdminLoginModal(true)} className="p-1.5 text-slate-200 hover:text-slate-400 transition-colors" title="Admin">
              <Settings size={13} />
            </button>
          </div>
          <a href="https://dee-dev-iot.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-300 hover:text-purple-400 transition-all flex items-center gap-1 group">
            สร้างโดย <span className="text-slate-400 group-hover:text-purple-500 transition-colors">DeeDevIOT</span>
          </a>
        </div>
      </div>
    </aside>
  );

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex h-screen bg-purple-50/30 font-sans overflow-hidden text-slate-800">

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
        <header className="bg-white border-b border-purple-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-purple-50" onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-slate-600" /></button>
            <div>
              <h1 className="text-sm font-black text-slate-800">
                {activeView === 'dashboard' ? 'สถานะน้ำมันจังหวัดตรัง' : activeView === 'leaderboard' ? 'นักรายงานข่าว' : 'จัดการระบบ'}
              </h1>
              <p className="text-[10px] text-purple-400 font-semibold">เพื่อนช่วยเพื่อน • คนตรังช่วยคนตรัง ❤️</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-purple-200 disabled:opacity-50">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{isLoading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          {activeView === 'dashboard' && (
            <div className="p-4 md:p-5 max-w-6xl mx-auto space-y-4">

              {/* Hero Banner */}
              <div className="bg-gradient-to-r from-purple-500 to-purple-400 rounded-2xl p-6 text-white shadow-lg shadow-purple-300/30 overflow-hidden relative">
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <p className="text-xs font-bold opacity-80 mb-1">🤝 คนตรังช่วยคนตรัง</p>
                    <h2 className="text-xl font-black leading-tight">รู้ก่อน ออกก่อน<br />ไม่ต้องเสียเวลาเข้าคิว!</h2>
                    <p className="text-xs opacity-80 mt-2">อัปเดตจากชาวตรังจริงๆ ทุกวัน</p>
                    
                    <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-2 pr-4 w-fit border border-white/10 animate-pulse-slow">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Heart size={14} className="text-white fill-white" />
                      </div>
                      <p className="text-[10px] font-bold">ช่วยกันรายงานสถานะที่แต่ละปั๊ม เพื่อเพื่อนชาวตรังครับ 💜</p>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className="text-4xl font-black">{isLoading ? '...' : stats.total}</p>
                    <p className="text-xs opacity-80">ปั๊มในตรัง</p>
                  </div>
                </div>
                
                {/* Decorative background shapes */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-32 h-32 bg-purple-300/10 rounded-full blur-xl" />
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
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:bg-white transition-all border border-transparent focus:border-purple-200"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-400/20">
                    {districts.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <select value={filterFuel} onChange={e => setFilterFuel(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-400/20">
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
                  <RefreshCw size={28} className="animate-spin mb-3 text-purple-400" />
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
                    <div key={station.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all group">
                      <div className="p-4">
                        <div className="flex gap-3 mb-3">
                          <BrandBadge brand={station.brand} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{station.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={10} className="text-purple-400 flex-shrink-0" />
                              <p className="text-xs text-purple-500 font-semibold">{station.district}</p>
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
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-black text-slate-800 text-base">🤝 ช่วยเพื่อนในตรังด้วยกัน!</p>
                    <p className="text-xs text-slate-500 mt-1">เข้าสู่ระบบแล้วกดโหวตสถานะน้ำมัน ใช้เวลาไม่ถึง 5 วินาที</p>
                  </div>
                  <button onClick={handleGoogleLogin} className="flex-shrink-0 bg-purple-500 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
                    เข้าร่วมชุมชน →
                  </button>
                </div>
              )}
            </div>
          )}

          {activeView === 'news' && (
            <div className="p-4 md:p-5 max-w-4xl mx-auto space-y-8 pb-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800">ข่าวสาร & ประชาสัมพันธ์</h2>
                {user && (
                  <button onClick={() => openNewsForm(null, 'user')} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-purple-700 transition-all flex items-center gap-1.5">
                    <Plus size={14} /> บอกข่าวชุมชน
                  </button>
                )}
              </div>

              {newsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                  <RefreshCw size={32} className="text-purple-200 animate-spin mb-3" />
                  <p className="text-sm font-bold text-slate-400">กำลังโหลดข่าวสารล่าสุด...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-10">
                  {/* OFFICIAL SECTION */}
                  <section className="space-y-5">
                    <div className="flex items-center gap-3 border-l-4 border-purple-600 pl-4 py-1">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 leading-none">ข่าวสารทางการ</h3>
                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mt-1">Official updates from Admin</p>
                      </div>
                    </div>
                    {news.length === 0 ? (
                      <div className="p-10 text-center bg-white/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 italic">ยังไม่มีข่าวสารทางการในขณะนี้</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {news.map((item) => renderNewsCard(item, true))}
                      </div>
                    )}
                  </section>

                  {/* COMMUNITY SECTION */}
                  <section className="space-y-5">
                    <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-4 py-1">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 leading-none">บอกข่าวชุมชนคนตรัง</h3>
                        <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mt-1">Community Announcements</p>
                      </div>
                    </div>
                    {userNews.length === 0 ? (
                      <div className="p-10 text-center bg-white/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 italic">ยังไม่มีข่าวจากชุมชนในขณะนี้</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userNews.map((item) => renderNewsCard(item, false))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}

          {activeView === 'leaderboard' && (
            <div className="p-4 md:p-5 max-w-2xl mx-auto space-y-4">
              <div className="bg-gradient-to-r from-purple-600 to-purple-400 rounded-2xl p-5 text-white shadow-lg shadow-purple-300/30 text-center">
                <p className="text-4xl mb-2">🏆</p>
                <h2 className="text-xl font-black">นักรายงานข่าวชาวตรัง</h2>
                <p className="text-xs opacity-80 mt-1">ขอบคุณทุกคนที่ร่วมรายงานสถานะให้ชาวตรัง ❤️</p>
              </div>
              {leaderboardLoading ? (
                <div className="flex flex-col items-center py-12 text-slate-400">
                  <RefreshCw size={24} className="animate-spin mb-3 text-purple-400" />
                  <p className="text-sm">กำลังโหลดข้อมูล...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="font-bold text-slate-500">ยังไม่มีข้อมูลการรายงาน</p>
                  <p className="text-xs text-slate-400 mt-1">เริ่มโหวตสถานะน้ำมันเลย!</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className={`flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-b-0 ${i < 3 ? 'bg-purple-50/50' : ''} hover:bg-purple-50/30 transition-colors`}>
                      <div className="w-8 text-center flex-shrink-0">
                        {i < 3 ? <span className="text-xl">{medals[i]}</span> : <span className="text-sm font-black text-slate-400">#{i + 1}</span>}
                      </div>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300' : i === 1 ? 'bg-slate-100 text-slate-600 border-2 border-slate-300' : i === 2 ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' : 'bg-purple-100 text-purple-600 border border-purple-200'}`}>
                        {entry.name ? entry.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${i < 3 ? 'text-slate-800' : 'text-slate-600'}`}>{entry.name || 'Anonymous'}</p>
                        <p className="text-[10px] text-slate-400 truncate">รายงานล่าสุด {entry.lastVote}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-lg font-black ${i === 0 ? 'text-yellow-600' : i < 3 ? 'text-purple-600' : 'text-slate-600'}`}>{entry.voteCount}</p>
                        <p className="text-[9px] text-slate-400 font-bold">ครั้ง</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'user-dashboard' && user && (
            <div className="p-4 md:p-5 max-w-4xl mx-auto space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-8 text-white relative overflow-hidden">
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="relative flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-white text-purple-600 flex items-center justify-center text-3xl font-black shadow-xl mb-4">
                      {user.avatar}
                    </div>
                    <h2 className="text-xl font-black">{user.name}</h2>
                    <p className="text-xs opacity-75">{user.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-50 border-t border-slate-50">
                  <div className="p-6 text-center">
                    <p className="text-2xl font-black text-purple-600">
                      {leaderboard.find(l => l.email === user.email)?.voteCount || 0}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">การรายงานทั้งหมด</p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-2xl font-black text-slate-700">
                      {(() => {
                        const rank = leaderboard.findIndex(l => l.email === user.email);
                        return rank === -1 ? '-' : `#${rank + 1}`;
                      })()}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">อันดับร่วมชุมชน</p>
                  </div>
                </div>
              </div>

              {/* My Community Posts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <Megaphone size={18} className="text-purple-500" /> 
                    ข่าวที่คุณบอกชุมชน ({userNews.filter(n => n.user_email === user.email).length})
                  </h3>
                  <button onClick={() => openNewsForm(null, 'user')} className="text-xs font-black text-purple-600 flex items-center gap-1 hover:bg-purple-50 px-3 py-1.5 rounded-xl transition-all">
                    <Plus size={14} /> เขียนโพสต์ใหม่
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userNews.filter(n => n.user_email === user.email).length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                      <p className="text-4xl mb-3">🗞️</p>
                      <p className="text-sm font-bold text-slate-400 italic">คุณยังไม่เคยบอกข่าวเลย ลองเขียนข่าวแรกดูสิ!</p>
                    </div>
                  ) : (
                    userNews.filter(n => n.user_email === user.email).map((item) => {
                      let images = [];
                      try { images = JSON.parse(item.image_url); if (!Array.isArray(images)) images = [item.image_url]; }
                      catch(e) { images = item.image_url ? [item.image_url] : []; }

                      return (
                        <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col group relative">
                          {images.length > 0 && (
                            <div className="aspect-video w-full overflow-hidden bg-slate-100">
                              <img src={images[0]} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-4 flex-1 flex flex-col">
                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">{item.created_at}</p>
                            <h3 className="font-black text-slate-800 mb-2 line-clamp-1">{item.title}</h3>
                            <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                              <button onClick={() => setNewsDetailModal({ isOpen: true, item })} className="text-xs font-black text-purple-600 flex items-center gap-1">
                                ดูโพสต์ <Plus size={12} />
                              </button>
                              <button onClick={() => deleteNews(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'admin' && isAdminLoggedIn && (
            <div className="p-4 md:p-5 max-w-4xl mx-auto space-y-5 pb-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 italic border-l-4 border-slate-800 pl-4 py-1 leading-none uppercase tracking-tight">Backend Control Center</h2>
                <div className="flex gap-2">
                  <button onClick={() => openNewsForm()} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-purple-700 transition-all flex items-center gap-1.5 active:scale-95">
                    <Megaphone size={14} /> เพิ่มข่าวประชาสัมพันธ์
                  </button>
                </div>
              </div>

              {/* Announcement Settings */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-slate-700">
                    <Megaphone size={16} className="text-purple-500" /> ตั้งค่าประกาศหน้าแรก (Pop-up)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{siteConfig.announcement_enabled === 'true' ? 'เปิดใช้งาน' : 'ปิดอยู่'}</span>
                    <button 
                      onClick={() => setSiteConfig(prev => ({ ...prev, announcement_enabled: prev.announcement_enabled === 'true' ? 'false' : 'true' }))} 
                      className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${siteConfig.announcement_enabled === 'true' ? 'bg-purple-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${siteConfig.announcement_enabled === 'true' ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">หัวข้อประกาศ</label>
                      <input 
                        value={siteConfig.announcement_title} 
                        onChange={e => setSiteConfig(prev => ({ ...prev, announcement_title: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm font-bold" 
                        placeholder="หัวข้อที่จะแสดงบน Pop-up..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">เนื้อหาประกาศ</label>
                      <textarea 
                        value={siteConfig.announcement_content} 
                        onChange={e => setSiteConfig(prev => ({ ...prev, announcement_content: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm leading-relaxed" 
                        placeholder="รายละเอียดข้อความ... (รองรับการขึ้นบรรทัดใหม่)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button onClick={handleSaveConfig} className="bg-slate-800 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-700 hover:bg-slate-900 transition-all flex items-center gap-2">
                      <Save size={14} /> บันทึกการตั้งค่าประกาศ
                    </button>
                  </div>
                </div>
              </div>

              {/* Stations Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-slate-700"><MapPin size={16} className="text-purple-500" /> รายชื่อสถานีบริการ</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.length} สถานี</span>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-[10px] text-slate-400 uppercase font-bold sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-3">ปั๊ม / อำเภอ</th>
                        <th className="px-5 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.map(s => (
                        <tr key={s.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <BrandBadge brand={s.brand} />
                              <div>
                                <p className="font-bold text-slate-700 text-xs">{s.name}</p>
                                <p className="text-[10px] text-slate-400">{s.district}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setEditModal({ isOpen: true, station: s })} className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-all" title="แก้ไข">
                              <Edit size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* News Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-slate-700"><Megaphone size={16} className="text-purple-500" /> ข่าวประชาสัมพันธ์</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{news.length} รายการ</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-[10px] text-slate-400 uppercase font-bold">
                      <tr>
                        <th className="px-5 py-3">หัวข้อข่าว / วันที่</th>
                        <th className="px-5 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {newsLoading ? (
                        <tr><td colSpan="2" className="p-10 text-center text-slate-400 text-xs">กำลังโหลด...</td></tr>
                      ) : news.length === 0 ? (
                        <tr><td colSpan="2" className="p-10 text-center text-slate-400 text-xs italic">ไม่มีข่าวสาร</td></tr>
                      ) : news.map(item => (
                        <tr key={item.id} className="hover:bg-purple-50/30 transition-colors text-xs">
                          <td className="px-5 py-3">
                            <p className="font-bold text-slate-700 truncate max-w-[200px]">{item.title}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{item.created_at}</p>
                          </td>
                          <td className="px-5 py-3 text-right space-x-1">
                            <button onClick={() => openNewsForm(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="แก้ไข">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => deleteNews(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="ลบ">
                              <Trash2 size={14} />
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
            <div className="bg-gradient-to-r from-purple-500 to-purple-400 p-5 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-lg leading-none">{voteModal.fuelName}</p>
                  <p className="text-xs opacity-80 mt-1 line-clamp-2">{voteModal.stationName}</p>
                </div>
                <button onClick={() => setVoteModal({ ...voteModal, isOpen: false })} className="bg-white/20 rounded-lg p-1"><X size={16} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs text-center text-slate-400 mb-4 font-medium">ตอนนี้ <span className="font-bold text-purple-700">{voteModal.fuelName}</span> ที่ปั๊มนี้เป็นยังไงบ้างครับ?</p>
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
            <div className="bg-gradient-to-r from-purple-500 to-purple-400 p-5 text-white text-center">
              <Heart size={28} className="mx-auto mb-2" />
              <p className="font-black text-lg">เข้าร่วมชุมชนตรัง</p>
              <p className="text-xs opacity-80 mt-1">เพื่อร่วมรายงานสถานะน้ำมัน</p>
            </div>
            <div className="p-5 space-y-3">
              <button onClick={handleGoogleLogin} className="w-full bg-purple-500 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <LogIn size={16} /> เข้าสู่ระบบด้วย Google
              </button>
              <button onClick={() => setShowLoginModal(false)} className="w-full text-slate-400 hover:text-slate-600 py-1.5 text-sm font-medium transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* NEWS DETAIL MODAL */}
      {newsDetailModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto">
            <div className="relative group/modal">
              {(() => {
                let images = [];
                try { images = JSON.parse(newsDetailModal.item.image_url); if (!Array.isArray(images)) images = [newsDetailModal.item.image_url]; }
                catch(e) { images = newsDetailModal.item.image_url ? [newsDetailModal.item.image_url] : []; }

                if (images.length === 0) return <div className="w-full h-32 bg-gradient-to-r from-purple-500 to-purple-400" />;
                if (images.length === 1) return <img src={images[0]} className="w-full aspect-video object-cover" alt="" />;
                
                return (
                  <div className="grid grid-cols-2 gap-0.5 bg-slate-100">
                    {images.map((url, i) => (
                      <div key={i} className={`${images.length === 3 && i === 0 ? 'col-span-2' : ''} aspect-video overflow-hidden`}>
                        <img src={url} className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" alt="" />
                      </div>
                    ))}
                  </div>
                );
              })()}
              <button onClick={() => setNewsDetailModal({ isOpen: false, item: null })} className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all z-10"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8">
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Clock size={12} /> เผยแพร่เมื่อ {newsDetailModal.item.created_at}
              </p>
              <h2 className="text-2xl font-black text-slate-800 mb-4 leading-tight">{newsDetailModal.item.title}</h2>
              <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed space-y-4 mb-6 whitespace-pre-wrap">
                {newsDetailModal.item.content}
              </div>

                {(() => {
                  let videos = [];
                  try { videos = JSON.parse(newsDetailModal.item.video_url); if (!Array.isArray(videos)) videos = [newsDetailModal.item.video_url]; }
                  catch(e) { videos = newsDetailModal.item.video_url ? [newsDetailModal.item.video_url] : []; }
                  
                  if (videos.length === 0) return null;

                  return (
                    <div className="space-y-4 mb-6">
                      {videos.map((vurl, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
                          <div className="bg-slate-50 p-2.5 flex items-center gap-2 border-b border-slate-100">
                            <Video size={14} className="text-red-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">วีดีโอที่ {i + 1}</span>
                          </div>
                          <div className="aspect-video bg-black flex items-center justify-center">
                            {vurl.includes('youtube.com') || vurl.includes('youtu.be') ? (
                              <iframe 
                                className="w-full h-full"
                                src={vurl.replace('watch?v=', 'embed/').split('&')[0]} 
                                title="YouTube video player" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                              ></iframe>
                            ) : (
                              <a href={vurl} target="_blank" rel="noopener noreferrer" className="text-white hover:text-purple-300 transition-colors flex flex-col items-center gap-2">
                                <Video size={32} />
                                <span className="text-[10px] font-bold">กดเพื่อรับชมวีดีโอ</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              {newsDetailModal.item.reference_url && (
                <a href={newsDetailModal.item.reference_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-xs font-black hover:bg-purple-100 transition-all border border-purple-100">
                  <ExternalLink size={14} /> อ่านต้นฉบับข่าวสาร
                </a>
              )}

              {/* COMMENTS SECTION */}
              <div className="mt-10 pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <MessageSquare size={18} className="text-purple-500" /> 
                    ความคิดเห็น ({comments.length})
                  </h3>
                  {!user && <p className="text-[10px] font-bold text-slate-400">เข้าสู่ระบบเพื่อแสดงความเห็น</p>}
                </div>

                {user && (
                  <div className="mb-8 flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-600 flex-shrink-0">
                      {user.avatar}
                    </div>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const content = e.target.comment.value;
                        if (content.trim()) {
                          submitComment(newsDetailModal.item.id, content);
                          e.target.reset();
                        }
                      }}
                      className="flex-1 flex gap-2"
                    >
                      <input 
                        name="comment"
                        placeholder="เขียนความคิดเห็นของคุณ..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm"
                      />
                      <button type="submit" className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 transition-all shadow-md">
                        <Save size={18} />
                      </button>
                    </form>
                  </div>
                )}

                <div className="space-y-6">
                  {comments.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-slate-100 rounded-2xl">
                      <p className="text-sm font-bold text-slate-300 italic">ยังไม่มีความคิดเห็นในขณะนี้</p>
                    </div>
                  ) : (
                    comments.map((c, i) => (
                      <div key={i} className="flex gap-3 animate-fade-in">
                        <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center font-black text-purple-400 text-xs flex-shrink-0">
                          {c.avatar || '?'}
                        </div>
                        <div className="flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                          <div className="flex justify-between items-center mb-1">
                            <p className="font-black text-slate-700 text-xs">{c.user_name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{c.created_at}</p>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEWS FORM MODAL */}
      {newsFormModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-700 flex items-center gap-2">
                {newsFormModal.item ? <Edit size={18} className="text-blue-500" /> : <Plus size={18} className="text-emerald-500" />}
                {newsFormModal.item ? 'แก้ไขข่าวประชาสัมพันธ์' : 'เพิ่มข่าวประชาสัมพันธ์ใหม่'}
              </h3>
              <button onClick={() => setNewsFormModal({ isOpen: false, item: null })} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              saveNews({
                id: newsFormModal.item?.id,
                title: fd.get('title'),
                content: fd.get('content'),
                reference_url: fd.get('reference_url')
              });
            }} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">หัวข้อข่าว *</label>
                <input name="title" required defaultValue={newsFormModal.item?.title} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm font-bold" placeholder="เช่น รุ้งข่าว! ปรับลดราคาน้ำมันด่วน..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">เนื้อหาข่าวสาร *</label>
                <textarea name="content" required defaultValue={newsFormModal.item?.content} rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm leading-relaxed" placeholder="รายละเอียดเนื้อความข่าว..." />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Image size={10} /> URL รูปภาพประกอบ (หลายรูปได้)</label>
                  <button type="button" onClick={addImageField} className="text-[10px] font-black text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-all">
                    <Plus size={10} /> เพิ่มรูปภาพ
                  </button>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {newsFormModal.imageUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        value={url} 
                        onChange={(e) => updateImageField(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm" 
                        placeholder={`URL รูปภาพที่ ${index + 1}...`} 
                      />
                      <button 
                        type="button" 
                        onClick={() => removeImageField(index)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Video size={10} /> URL วีดีโอประกอบ (หลายรายการได้)</label>
                  <button type="button" onClick={addVideoField} className="text-[10px] font-black text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-all">
                    <Plus size={10} /> เพิ่มวีดีโอ
                  </button>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {newsFormModal.videoUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        value={url} 
                        onChange={(e) => updateVideoField(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 text-xs sm:text-sm" 
                        placeholder={`URL วีดีโอที่ ${index + 1}... (Youtube)`} 
                      />
                      <button 
                        type="button" 
                        onClick={() => removeVideoField(index)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5"><ExternalLink size={10} /> URL อ้างอิงแหล่งที่มา</label>
                <input name="reference_url" defaultValue={newsFormModal.item?.reference_url} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm" placeholder="https://..." />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={isUpdating} className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-black shadow-lg shadow-purple-200/50 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-0 transition-all flex items-center justify-center gap-2">
                  {isUpdating ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                  {newsFormModal.item ? 'บันทึกการแก้ไข' : 'ลงประกาศข่าวประชาสัมพันธ์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-5 text-white text-center">
              <Lock size={24} className="mx-auto mb-2 text-purple-400" />
              <p className="font-black">Admin Login</p>
            </div>
            <form onSubmit={handleAdminLogin} className="p-5 space-y-3">
              <input type="text" required placeholder="Username" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" value={adminLoginForm.username} onChange={e => setAdminLoginForm({...adminLoginForm, username: e.target.value})} />
              <input type="password" required placeholder="Password" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" value={adminLoginForm.password} onChange={e => setAdminLoginForm({...adminLoginForm, password: e.target.value})} />
              {adminLoginError && <p className="text-red-500 text-xs font-bold text-center">{adminLoginError}</p>}
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm transition-all">เข้าสู่ระบบ</button>
              <button type="button" onClick={() => setShowAdminLoginModal(false)} className="w-full text-slate-400 text-sm py-1 hover:text-slate-600 transition-colors">ยกเลิก</button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal.isOpen && editModal.station && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-black text-slate-800">แก้ไขสถานีบริการ</h2>
              <button onClick={() => setEditModal({ isOpen: false, station: null })} className="p-1.5 bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.target); saveAdminEdit({ ...editModal.station, name: f.get('name'), brand: f.get('brand'), district: f.get('district') }); }} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">ชื่อสถานีบริการ</label>
                <input name="name" defaultValue={editModal.station.name} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">แบรนด์</label>
                  <select name="brand" defaultValue={editModal.station.brand} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20">
                    {["ปตท.", "บางจาก", "เชลล์", "พีที", "คาลเท็กซ์", "อิสระ"].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">อำเภอ</label>
                  <select name="district" defaultValue={editModal.station.district} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/20">
                    {["เมืองตรัง","ห้วยยอด","กันตัง","ย่านตาขาว","ปะเหลียน","สิเกา","วังวิเศษ","นาโยง","รัษฎา","หาดสำราญ"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal({ isOpen: false, station: null })} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">ยกเลิก</button>
                <button type="submit" disabled={isUpdating} className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {isUpdating ? 'บันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      {showAnnouncement && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-br from-purple-600 to-purple-500 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowAnnouncement(false)} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-all backdrop-blur-sm"><X size={20} /></button>
              </div>
              
              {/* Decorative light effect */}
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>

              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/30 shadow-xl backdrop-blur-md">
                <Megaphone size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-black leading-tight">{siteConfig.announcement_title}</h2>
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mt-4"></div>
            </div>
            
            <div className="p-8 md:p-10">
              <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-8 text-center bg-slate-50/50 p-6 rounded-3xl border border-slate-100/50">
                {siteConfig.announcement_content}
              </div>
              <button 
                onClick={() => setShowAnnouncement(false)} 
                className="w-full py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-[20px] font-black text-sm shadow-xl shadow-slate-200 hover:shadow-slate-300 hover:translate-y-[-1px] active:translate-y-0 transition-all flex items-center justify-center gap-3"
              >
                เข้าใจแล้ว เริ่มใช้งานเลย! 🚀
              </button>
              <p className="text-center text-[10px] font-bold text-slate-300 mt-6 uppercase tracking-widest">Powered by FuelRadar Community</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
