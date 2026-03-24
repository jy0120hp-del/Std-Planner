import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ChevronLeft, ChevronRight, Plus, CheckCircle2, 
  Camera, LogOut, Loader2, XCircle, LayoutDashboard, Wallet, ListChecks,
  Edit2, Trash2, X
} from 'lucide-react';

const SUPABASE_URL = 'https://tjfamywgqesntiidlddi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZmFteXdncWVzbnRpaWRsZGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjgwMzIsImV4cCI6MjA4OTgwNDAzMn0.XpVeYOcgKujTWsmCWW4Xd0xmmf85CgM_Lu-5_yQnt0w';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const START_DATE = "2026-03-23"; // 스터디 공식 시작일

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

  useEffect(() => { fetchMembers(); }, []);
  useEffect(() => { fetchAllPlans(); }, [view, currentDate]);

  const fetchMembers = async () => {
    const { data } = await supabase.from('users').select('*').order('name');
    setMembers(data || []);
  };

  const fetchPlans = async (userName, date) => {
    setLoading(true);
    const dateStr = getKSTDate(date);
    const { data } = await supabase.from('plans').select('*').eq('user_name', userName).eq('date', dateStr).order('created_at', { ascending: true });
    setDailyPlans(data || []);
    setLoading(false);
  };

  const fetchAllPlans = async () => {
    const { data } = await supabase.from('plans').select('*');
    setAllPlans(data || []);
  };

  useEffect(() => {
    if (selectedMember) fetchPlans(selectedMember.name, currentDate);
  }, [selectedMember, currentDate]);

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
    const dayPlans = allPlans.filter(p => p.user_name === name && p.date === dateStr);
    
    // 계획이 아예 없는 경우
    if (dayPlans.length === 0) {
      return dateStr < todayStr ? "fail" : "pending";
    }
    
    const doneCount = dayPlans.filter(p => p.is_done).length;
    const goal = Math.ceil(dayPlans.length * 0.5);
    const isSuccess = doneCount >= goal;

    // ✅ 핵심 수정: 오늘 날짜라면 아직 시간이 남았으므로 '성공'이더라도 'pending'으로 표시하거나, 
    // 혹은 성공했을 때만 체크를 띄우고 싶다면 아래 로직을 유지하되 '실패'는 절대 미리 띄우지 않음.
    if (dateStr === todayStr) {
      return isSuccess ? "success" : "pending"; 
    }

    // 미래 날짜
    if (dateStr > todayStr) return "pending";

    // 과거 날짜: 성공 여부에 따라 확실하게 구분
    return isSuccess ? "success" : "fail";
  };

  const calculateFineForWeek = (name, weekDays) => {
    const todayStr = getKSTDate();
    const sundayStr = weekDays[6];
    if (sundayStr < START_DATE) return 0;
    if (todayStr <= sundayStr) return 0;
    
    let successCount = 0;
    weekDays.forEach(date => {
      if (getDayStatus(name, date) === "success") successCount++;
    });
    return successCount < 4 ? 1000 : 0;
  };

  const handleFileUpload = async (e, plan) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(plan.id);
      const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('Photos').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(fileName);
      await supabase.from('plans').update({ image_url: publicUrl, is_done: true }).eq('id', plan.id);
      fetchPlans(selectedMember.name, currentDate);
      fetchAllPlans();
    } catch (error) { alert(error.message); } finally { setUploading(null); }
  };

  const addPlan = async () => {
    const task = prompt("공부 계획 입력:");
    if (!task) return;
    await supabase.from('plans').insert([{ user_name: user.name, task, date: getKSTDate(currentDate), is_done: false }]);
    fetchPlans(user.name, currentDate);
    fetchAllPlans();
  };

  const updatePlan = async (id, currentTask) => {
    const newTask = prompt("계획 수정:", currentTask);
    if (!newTask || newTask === currentTask) return;
    await supabase.from('plans').update({ task: newTask }).eq('id', id);
    fetchPlans(selectedMember.name, currentDate);
    fetchAllPlans();
  };

  const deletePlan = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from('plans').delete().eq('id', id);
    fetchPlans(selectedMember.name, currentDate);
    fetchAllPlans();
  };

  const handleMemberSelect = (member) => {
    setDailyPlans([]);
    setSelectedMember(member);
  };

  const styles = {
    container: { maxWidth: '100vw', margin: '0', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '100px', fontFamily: '-apple-system, sans-serif', boxSizing: 'border-box' },
    header: { padding: '20px 16px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 },
    nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', maxWidth: '100vw', width: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'space-around', padding: '12px 0 24px 0', borderTop: '1px solid #f1f5f9', boxShadow: '0 -4px 12px rgba(0,0,0,0.03)' },
    navBtn: (active) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: active ? '#2563eb' : '#94a3b8', border: 'none', background: 'none', fontSize: '11px', fontWeight: active ? 'bold' : 'normal', cursor: 'pointer' }),
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    th: { backgroundColor: '#f8fafc', padding: '12px 4px', border: '1px solid #f1f5f9', color: '#64748b', fontWeight: 'bold' },
    td: { padding: '12px 4px', border: '1px solid #f1f5f9', textAlign: 'center' },
    modal: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }
  };

  if (!user) {
    return (
      <div style={{...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <form onSubmit={(e) => { e.preventDefault(); const foundUser = members.find(m => m.name === loginInput); if (foundUser) setUser(foundUser); else alert("이름을 확인해 주세요."); }} style={{backgroundColor: 'white', padding: '40px 30px', borderRadius: '32px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)'}}>
          <h2 style={{color: '#2563eb', fontWeight: 900, fontSize: '28px'}}>STUDY MATE</h2>
          <input style={{width: '100%', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', margin: '20px 0', fontSize: '16px'}} placeholder="이름 입력" value={loginInput} onChange={e => setLoginInput(e.target.value)} />
          <button style={{width: '100%', padding: '18px', borderRadius: '16px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', border: 'none'}}>입장하기</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {zoomImage && (
        <div style={styles.modal} onClick={() => setZoomImage(null)}>
          <img src={zoomImage} style={{maxWidth: '100%', maxHeight: '80%', borderRadius: '12px'}} alt="확대" />
        </div>
      )}

      <header style={styles.header}>
        <h2 style={{fontWeight: 900, fontSize: '24px'}}>{view === 'members' ? 'MEMBERS' : view === 'progress' ? '진행 현황' : '벌금 현황'}</h2>
        <button onClick={() => {setUser(null); setView('members'); setSelectedMember(null);}} style={{border: 'none', background: 'none', color: '#94a3b8'}}><LogOut size={22}/></button>
      </header>

      <main style={{padding: '16px'}}>
        {view === 'members' && !selectedMember && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {members.map(m => (
              <div key={m.id} onClick={() => handleMemberSelect(m)} style={{backgroundColor: 'white', padding: '30px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9'}}>
                <span style={{fontWeight: 'bold', fontSize: '20px'}}>{m.name}</span>
                <ChevronRight size={22} color="#cbd5e1"/>
              </div>
            ))}
          </div>
        )}

        {view === 'members' && selectedMember && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <button onClick={() => setSelectedMember(null)} style={{border: 'none', background: 'none', fontWeight: 'bold', color: '#64748b'}}>← BACK</button>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '24px', fontSize: '13px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'}}>
                <ChevronLeft size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d);}}/>
                <b>{getKSTDate(currentDate)}</b>
                <ChevronRight size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d);}}/>
              </div>
              {user.name === selectedMember.name ? <button onClick={addPlan} style={{backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', padding: '8px'}}><Plus size={20}/></button> : <div style={{width: 36}}/>}
            </div>
            {loading ? <div style={{textAlign:'center', padding:'40px'}}><Loader2 className="animate-spin" color="#2563eb" style={{margin:'auto'}}/></div> : dailyPlans.map(p => (
              <div key={p.id} style={{backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '12px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <div style={{flex: 1, fontWeight: 'bold', fontSize: '16px', color: p.is_done ? '#cbd5e1' : '#334155'}}>{p.task}</div>
                  <div style={{width: 48, height: 48, borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}} onClick={() => p.image_url && setZoomImage(p.image_url)}>
                    {uploading === p.id ? <Loader2 size={20} className="animate-spin" color="#2563eb"/> : p.image_url ? <img src={p.image_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <label><Camera size={20} color="#94a3b8"/><input type="file" accept="image/*" style={{display:'none'}} onChange={e => handleFileUpload(e, p)} disabled={user.name !== selectedMember.name}/></label>}
                  </div>
                  {p.is_done ? <CheckCircle2 size={28} color="#22c55e"/> : <div style={{width: 28, height: 28, borderRadius: '50%', border: '2px solid #e2e8f0'}}/>}
                </div>
                {user.name === selectedMember.name && (
                  <div style={{display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '12px', borderTop: '1px solid #f8fafc', paddingTop: '8px'}}>
                    <button onClick={() => updatePlan(p.id, p.task)} style={{border: 'none', background: 'none', fontSize: '12px', color: '#3b82f6', fontWeight: 'bold'}}>수정</button>
                    <button onClick={() => deletePlan(p.id)} style={{border: 'none', background: 'none', fontSize: '12px', color: '#ef4444', fontWeight: 'bold'}}>삭제</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {view === 'progress' && (
          <div style={{overflowX: 'auto'}}>
            <h3 style={{textAlign: 'center', marginBottom: '20px', fontWeight: 'bold'}}>이번 주 현황</h3>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>멤버</th>{['월','화','수','목','금','토','일'].map(d => <th key={d} style={styles.th}>{d}</th>)}</tr></thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => (
                  <tr key={name}>
                    <td style={{...styles.td, fontWeight: 'bold'}}>{name}</td>
                    {getWeekDays().map(date => {
                      const status = getDayStatus(name, date);
                      return <td key={date} style={styles.td}>
                        {status === "success" ? <CheckCircle2 size={18} color="#22c55e" style={{margin:'auto'}}/> : status === "fail" ? <XCircle size={18} color="#f87171" style={{margin:'auto'}}/> : "-"}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'fines' && (
          <div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>멤버</th>
                  <th style={{...styles.th, backgroundColor: '#eff6ff', color: '#2563eb'}}>누적 벌금</th>
                  <th style={styles.th}>지난 주</th>
                </tr>
              </thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => {
                  const lastWeekDate = new Date();
                  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
                  const lastWeekDays = getWeekDays(lastWeekDate);
                  const fineLastWeek = calculateFineForWeek(name, lastWeekDays);
                  return (
                    <tr key={name}>
                      <td style={{...styles.td, fontWeight: 'bold'}}>{name}</td>
                      <td style={{...styles.td, color: '#2563eb', fontWeight: '900'}}>{fineLastWeek.toLocaleString()}원</td>
                      <td style={styles.td}>{fineLastWeek.toLocaleString()}원</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div style={{ marginTop: '24px', padding: '24px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '18px', backgroundColor: '#2563eb', borderRadius: '4px' }}></div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '900' }}>스터디 운영 가이드 🎸</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>💰</span>
                  <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#475569' }}>
                    <b style={{ color: '#1e293b' }}>벌금은 매주 월요일 00:00에 누적됩니다.</b><br/>
                    지난주(월~일) 결과를 정산하여 자동 업데이트됩니다.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>✅</span>
                  <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#475569' }}>
                    <b style={{ color: '#1e293b' }}>하루 성공 기준: 목표의 50% 이상 완료</b><br/>
                    계획이 홀수일 경우 <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>반올림</span> 개수만큼 완료 시 성공!
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>🔥</span>
                  <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#475569' }}>
                    <b style={{ color: '#1e293b' }}>한 주 성공 기준: ✅ 4일 이상</b><br/>
                    성공 일수가 <span style={{ color: '#ef4444', fontWeight: 'bold' }}>4일 미만</span>이면 벌금 1,000원이 누적됩니다.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>🗓️</span>
                  <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#475569' }}>
                    <b style={{ color: '#1e293b' }}>공식 시작일: 3월 23일</b><br/>
                    첫 주 정산은 3월 30일(월)에 이루어집니다. 파이팅!
                  </div>
                </div>
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