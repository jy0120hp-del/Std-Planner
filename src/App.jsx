import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ChevronLeft, ChevronRight, Plus, CheckCircle2, 
  Camera, LogOut, Loader2, XCircle, LayoutDashboard, Wallet, ListChecks,
  Lock, ShieldCheck
} from 'lucide-react';

const SUPABASE_URL = 'https://tjfamywgqesntiidlddi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZmFteXdncWVzbnRpaWRsZGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjgwMzIsImV4cCI6MjA4OTgwNDAzMn0.XpVeYOcgKujTWsmCWW4Xd0xmmf85CgM_Lu-5_yQnt0w';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const START_DATE = "2026-03-23"; 

const getKSTDate = (date = new Date()) => {
  const offset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + offset);
  return kstDate.toISOString().split('T')[0];
};

const StudyGroupApp = () => {
  const [view, setView] = useState('members');
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyPlans, setDailyPlans] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [loginInput, setLoginInput] = useState("");
  const [uploading, setUploading] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pwModal, setPwModal] = useState({ open: false, targetUser: null, mode: 'login' });
  const [pwInput, setPwInput] = useState("");

  useEffect(() => { fetchMembers(); }, []);
  useEffect(() => { fetchAllPlans(); }, [view, currentDate]);
  useEffect(() => { if (selectedMember) fetchPlans(selectedMember.name, currentDate); }, [selectedMember, currentDate]);

  const fetchMembers = async () => {
    const { data } = await supabase.from('users').select('*').order('name');
    setMembers(data || []);
  };

  const handleLoginAttempt = (e) => {
    e.preventDefault();
    const foundUser = members.find(m => m.name === loginInput);
    if (!foundUser) { alert("등록된 멤버가 아닙니다."); return; }
    setPwModal({ open: true, targetUser: foundUser, mode: foundUser.password ? 'login' : 'setup' });
  };

  const submitPassword = async () => {
    if (!pwInput || isNaN(pwInput)) { alert("숫자 비밀번호를 입력해주세요."); return; }
    if (pwModal.mode === 'setup') {
      await supabase.from('users').update({ password: pwInput }).eq('id', pwModal.targetUser.id);
      alert("설정 완료! 다시 로그인해주세요."); setPwModal({ open: false }); setPwInput(""); fetchMembers();
    } else {
      if (String(pwModal.targetUser.password) === pwInput) { setUser(pwModal.targetUser); setPwModal({ open: false }); setPwInput(""); }
      else { alert("비밀번호가 틀렸습니다."); setPwInput(""); }
    }
  };

  const fetchPlans = async (userName, date) => {
    setLoading(true);
    const { data } = await supabase.from('plans').select('*').eq('user_name', userName).eq('date', getKSTDate(date)).order('created_at', { ascending: true });
    setDailyPlans(data || []);
    setLoading(false);
  };

  const fetchAllPlans = async () => {
    const { data } = await supabase.from('plans').select('*');
    setAllPlans(data || []);
  };

  const getWeekDays = (baseDate = new Date()) => {
    const target = new Date(baseDate);
    const day = target.getDay();
    const diff = target.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(new Date(target).setDate(diff));
    return [0,1,2,3,4,5,6].map(i => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return getKSTDate(d);
    });
  };

  const getDayStatus = (name, dateStr) => {
    const todayStr = getKSTDate();
    if (dateStr >= todayStr) return "pending"; 
    const dayPlans = allPlans.filter(p => p.user_name === name && p.date === dateStr);
    if (dayPlans.length === 0) return "fail";
    const doneCount = dayPlans.filter(p => p.is_done).length;
    return doneCount >= Math.ceil(dayPlans.length * 0.5) ? "success" : "fail";
  };

  // ★ 수정된 벌금 체계: (안 한 날수 * 500원)
  const calculateFineForOneWeek = (name, weekDays) => {
    if (weekDays[6] < START_DATE) return 0;
    let failCount = 0;
    weekDays.forEach(date => {
      if (getDayStatus(name, date) === "fail") failCount++;
    });
    return failCount * 500;
  };

  const calculateTotalFine = (name) => {
    let totalFine = 0;
    const start = new Date(START_DATE);
    const thisMondayStr = getWeekDays(new Date())[0];
    let checkDate = new Date(start);
    while (getKSTDate(checkDate) < thisMondayStr) {
      totalFine += calculateFineForOneWeek(name, getWeekDays(checkDate));
      checkDate.setDate(checkDate.getDate() + 7);
    }
    return totalFine;
  };

  const handleFileUpload = async (e, plan) => {
    if (plan.date !== getKSTDate()) { alert("당일 계획만 인증 가능합니다."); return; }
    const file = e.target.files[0];
    if (!file) return;
    setUploading(plan.id);
    const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
    await supabase.storage.from('Photos').upload(fileName, file);
    const { data } = supabase.storage.from('Photos').getPublicUrl(fileName);
    await supabase.from('plans').update({ image_url: data.publicUrl, is_done: true }).eq('id', plan.id);
    fetchPlans(selectedMember.name, currentDate); fetchAllPlans();
    setUploading(null);
  };

  const addPlan = async () => {
    const task = prompt("공부 계획 입력:");
    if (!task) return;
    await supabase.from('plans').insert([{ user_name: user.name, task, date: getKSTDate(currentDate), is_done: false }]);
    fetchPlans(user.name, currentDate); fetchAllPlans();
  };

  const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f8fafc', overflow: 'hidden' },
    header: { flexShrink: 0, padding: '20px 16px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 },
    main: { flexGrow: 1, overflowY: 'auto', padding: '16px', paddingBottom: '100px', WebkitOverflowScrolling: 'touch' },
    nav: { flexShrink: 0, height: '80px', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingBottom: 'env(safe-area-inset-bottom)' },
    navBtn: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: active ? '#2563eb' : '#94a3b8', border: 'none', background: 'none', fontSize: '11px', fontWeight: active ? 'bold' : 'normal' }),
    card: { backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', fontSize: '12px' },
    th: { backgroundColor: '#f8fafc', padding: '12px 4px', border: '1px solid #f1f5f9', color: '#64748b', fontWeight: 'bold' },
    td: { padding: '12px 4px', border: '1px solid #f1f5f9', textAlign: 'center' },
    modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    guideItem: { display: 'flex', gap: '12px', alignItems: 'flex-start', textAlign: 'left' }
  };

  if (!user) {
    return (
      <div style={{...styles.container, justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
        <form onSubmit={handleLoginAttempt} style={{backgroundColor: 'white', padding: '40px 30px', borderRadius: '32px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)'}}>
          <Lock size={32} color="#2563eb" style={{marginBottom:'10px'}}/>
          <h2 style={{color: '#2563eb', fontWeight: 900, fontSize: '28px'}}>STUDY PLAN</h2>
          <input style={{width: '100%', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', margin: '20px 0', boxSizing:'border-box'}} placeholder="이름 입력" value={loginInput} onChange={e => setLoginInput(e.target.value)} />
          <button style={{width: '100%', padding: '18px', borderRadius: '16px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', border: 'none'}}>로그인</button>
        </form>
        {pwModal.open && (
          <div style={styles.modalOverlay}>
            <div style={{backgroundColor:'white', padding:'30px', borderRadius:'24px', width:'100%', maxWidth:'320px', textAlign:'center'}}>
              <ShieldCheck size={40} color="#2563eb" style={{marginBottom:'12px'}}/>
              <h3 style={{fontWeight:'bold'}}>{pwModal.mode === 'setup' ? '비밀번호 설정' : '비밀번호 확인'}</h3>
              <input type="password" inputMode="numeric" autoFocus style={{width:'100%', padding:'15px', borderRadius:'12px', border:'2px solid #e2e8f0', textAlign:'center', fontSize:'24px', marginTop:'15px'}} value={pwInput} onChange={e => setPwInput(e.target.value)} />
              <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button onClick={() => setPwModal({open:false})} style={{flex:1, padding:'12px', borderRadius:'12px', border:'none', backgroundColor:'#f1f5f9'}}>취소</button>
                <button onClick={submitPassword} style={{flex:2, padding:'12px', borderRadius:'12px', border:'none', backgroundColor:'#2563eb', color:'white', fontWeight:'bold'}}>확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {zoomImage && <div style={styles.modalOverlay} onClick={() => setZoomImage(null)}><img src={zoomImage} style={{maxWidth: '100%', maxHeight: '80%'}} /></div>}

      <header style={styles.header}>
        <h2 style={{fontWeight: 900, fontSize: '22px'}}>{view === 'members' ? 'MEMBERS' : view === 'progress' ? 'PROGRESS' : 'FINES'}</h2>
        <button onClick={() => setUser(null)} style={{border:'none', background:'none'}}><LogOut size={22} color="#94a3b8"/></button>
      </header>

      <main style={styles.main}>
        {view === 'members' && !selectedMember && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {members.map(m => (
              <div key={m.id} onClick={() => setSelectedMember(m)} style={{backgroundColor: 'white', padding: '25px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', cursor: 'pointer'}}>
                <span style={{fontWeight: 'bold', fontSize: '18px'}}>{m.name}</span><ChevronRight size={20} color="#cbd5e1"/>
              </div>
            ))}
          </div>
        )}

        {view === 'members' && selectedMember && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <button onClick={() => setSelectedMember(null)} style={{border: 'none', background: 'none', fontWeight: 'bold', color: '#64748b'}}>← BACK</button>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '24px', fontSize: '13px'}}>
                <ChevronLeft size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d);}}/>
                <b>{getKSTDate(currentDate)}</b>
                <ChevronRight size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d);}}/>
              </div>
              {user.name === selectedMember.name && getKSTDate(currentDate) >= getKSTDate() ? <button onClick={addPlan} style={{backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', padding: '8px'}}><Plus size={20}/></button> : <div style={{width: 36}}/>}
            </div>
            {loading ? <div style={{textAlign:'center', padding:'40px'}}><Loader2 className="animate-spin" color="#2563eb" style={{margin:'auto'}}/></div> : dailyPlans.map(p => (
              <div key={p.id} style={styles.card}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <div style={{flex: 1, fontWeight: 'bold', color: p.is_done ? '#cbd5e1' : (p.date < getKSTDate() ? '#f87171' : '#334155')}}>{p.task}</div>
                  <div style={{width: 44, height: 44, borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}} onClick={() => p.image_url && setZoomImage(p.image_url)}>
                    {uploading === p.id ? <Loader2 size={18} className="animate-spin" color="#2563eb"/> : p.image_url ? <img src={p.image_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : (p.date === getKSTDate() && user.name === selectedMember.name && <label><Camera size={18} color="#94a3b8"/><input type="file" accept="image/*" style={{display:'none'}} onChange={e => handleFileUpload(e, p)}/></label>)}
                  </div>
                  {p.is_done ? <CheckCircle2 size={26} color="#22c55e"/> : p.date < getKSTDate() ? <XCircle size={26} color="#ef4444"/> : <div style={{width: 26, height: 26, borderRadius: '50%', border: '2px solid #e2e8f0'}}/>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'progress' && (
          <div style={{overflowX: 'auto'}}>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>멤버</th>{['월','화','수','목','금','토','일'].map(d => <th key={d} style={styles.th}>{d}</th>)}</tr></thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => (
                  <tr key={name}><td style={{...styles.td, fontWeight: 'bold'}}>{name}</td>{getWeekDays().map(date => { const status = getDayStatus(name, date); return <td key={date} style={styles.td}>{status === "success" ? <CheckCircle2 size={16} color="#22c55e" style={{margin:'auto'}}/> : status === "fail" ? <XCircle size={16} color="#f87171" style={{margin:'auto'}}/> : "-"}</td>; })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'fines' && (
          <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>멤버</th><th style={{...styles.th, backgroundColor:'#eff6ff', color:'#2563eb'}}>누적 벌금</th><th style={styles.th}>지난 주</th></tr></thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => {
                  const lastWeekDate = new Date(); lastWeekDate.setDate(lastWeekDate.getDate() - 7);
                  const fineLastWeek = calculateFineForOneWeek(name, getWeekDays(lastWeekDate));
                  const totalFine = calculateTotalFine(name); 
                  return (<tr key={name}><td style={{...styles.td, fontWeight: 'bold'}}>{name}</td><td style={{...styles.td, color: '#2563eb', fontWeight: '900'}}>{totalFine.toLocaleString()}원</td><td style={styles.td}>{fineLastWeek.toLocaleString()}원</td></tr>);
                })}
              </tbody>
            </table>

            {/* ★ 멘트 그대로 살리고 벌금 체계만 수정 ★ */}
            <div style={{ marginTop: '4px', padding: '24px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '18px', backgroundColor: '#2563eb', borderRadius: '4px' }}></div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '900' }}>스터디 운영 가이드 🎸</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={styles.guideItem}><span style={{ fontSize: '18px' }}>💰</span><div style={{ fontSize: '13px', color: '#475569' }}><b>벌금은 매주 월요일 00:00에 누적됩니다.</b><br/>지난주 결과를 자동 정산합니다.</div></div>
                <div style={styles.guideItem}><span style={{ fontSize: '18px' }}>✅</span><div style={{ fontSize: '13px', color: '#475569' }}><b>하루 성공 기준: 목표의 50% 이상 완료</b><br/>계획이 홀수일 경우 반올림합니다.</div></div>
                <div style={styles.guideItem}><span style={{ fontSize: '18px' }}>🔥</span><div style={{ fontSize: '13px', color: '#475569' }}><b>벌금 산정 기준: 공부 안 한 날 수 × 500원</b><br/>성공하지 못한 날마다 벌금이 차곡차곡 쌓입니다.</div></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav style={styles.nav}>
        <button onClick={() => {setView('members'); setSelectedMember(null);}} style={styles.navBtn(view === 'members')}><ListChecks size={24}/><span>플래너</span></button>
        <button onClick={() => setView('progress')} style={styles.navBtn(view === 'progress')}><LayoutDashboard size={24}/><span>현황</span></button>
        <button onClick={() => setView('fines')} style={styles.navBtn(view === 'fines')}><Wallet size={24}/><span>벌금</span></button>
      </nav>
    </div>
  );
};

export default StudyGroupApp;