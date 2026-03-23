import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ChevronLeft, ChevronRight, Plus, CheckCircle2, 
  Camera, LogOut, Loader2, XCircle, LayoutDashboard, Wallet, ListChecks,
  Edit2, Trash2
} from 'lucide-react';

const SUPABASE_URL = 'https://tjfamywgqesntiidlddi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZmFteXdncWVzbnRpaWRsZGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjgwMzIsImV4cCI6MjA4OTgwNDAzMn0.XpVeYOcgKujTWsmCWW4Xd0xmmf85CgM_Lu-5_yQnt0w';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  useEffect(() => { fetchMembers(); }, []);
  useEffect(() => { fetchAllPlans(); }, [view]);

  const fetchMembers = async () => {
    const { data } = await supabase.from('users').select('*').order('name');
    setMembers(data || []);
  };

  const fetchPlans = async (userName, date) => {
    const dateStr = date.toISOString().split('T')[0];
    const { data } = await supabase.from('plans').select('*').eq('user_name', userName).eq('date', dateStr).order('created_at', { ascending: true });
    setDailyPlans(data || []);
  };

  const fetchAllPlans = async () => {
    const { data } = await supabase.from('plans').select('*');
    setAllPlans(data || []);
  };

  useEffect(() => {
    if (selectedMember) fetchPlans(selectedMember.name, currentDate);
  }, [selectedMember, currentDate]);

  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = members.find(m => m.name === loginInput);
    if (foundUser) setUser(foundUser);
    else alert("등록되지 않은 이름입니다.");
  };

  const getWeekDays = (baseDate = new Date()) => {
    const curr = new Date(baseDate);
    const first = curr.getDate() - (curr.getDay() === 0 ? 6 : curr.getDay() - 1);
    return [0,1,2,3,4,5,6].map(i => {
      const d = new Date(new Date(baseDate).setDate(first + i));
      return d.toISOString().split('T')[0];
    });
  };

  const getDayStatus = (name, dateStr) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dayPlans = allPlans.filter(p => p.user_name === name && p.date === dateStr);
    if (dateStr >= todayStr) return "pending";
    const doneCount = dayPlans.filter(p => p.is_done).length;
    const goal = Math.ceil(dayPlans.length * 0.5);
    if (dayPlans.length === 0 || doneCount < goal) return "fail";
    return "success";
  };

  const calculateFinalFine = (name, targetWeekDays) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastDayOfWeek = targetWeekDays[6];
    if (todayStr <= lastDayOfWeek) return 0;
    let successCount = 0;
    targetWeekDays.forEach(date => {
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
    } catch (error) { alert(error.message); } finally { setUploading(null); }
  };

  const addPlan = async () => {
    const task = prompt("공부 계획 입력:");
    if (!task) return;
    await supabase.from('plans').insert([{ user_name: user.name, task, date: currentDate.toISOString().split('T')[0], is_done: false }]);
    fetchPlans(user.name, currentDate);
  };

  const updatePlan = async (id, currentTask) => {
    const newTask = prompt("계획 수정:", currentTask);
    if (!newTask || newTask === currentTask) return;
    await supabase.from('plans').update({ task: newTask }).eq('id', id);
    fetchPlans(selectedMember.name, currentDate);
  };

  const deletePlan = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from('plans').delete().eq('id', id);
    fetchPlans(selectedMember.name, currentDate);
  };

  // ✅ 스타일 정의 (모바일 대응 강화 및 Members 화면 최적화)
  const styles = {
    container: { 
      maxWidth: '100vw', // 화면 끝까지 채우기
      margin: '0', 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh', 
      paddingBottom: '100px', // 메뉴 바 공간 확보
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    },
    header: { 
      padding: '20px 16px', 
      backgroundColor: 'white', 
      borderBottom: '1px solid #f1f5f9', // 밑줄 끝까지 확장
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      position: 'sticky', 
      top: 0, 
      zIndex: 50 
    },
    nav: { 
      position: 'fixed', 
      bottom: 0, 
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '100vw', // 화면 끝까지 채우기
      width: '100%', 
      backgroundColor: 'white', 
      display: 'flex', 
      justifyContent: 'space-around', 
      padding: '12px 0 24px 0', // 아이폰 하단 바 대응 여백
      borderTop: '1px solid #f1f5f9',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.03)'
    },
    navBtn: (active) => ({ 
      flex: 1, // 균등 분배
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '4px', 
      color: active ? '#2563eb' : '#94a3b8', 
      border: 'none', 
      background: 'none', 
      fontSize: '11px', 
      fontWeight: active ? 'bold' : 'normal',
      cursor: 'pointer' 
    }),
    table: { 
      width: '100%', 
      borderCollapse: 'collapse', 
      backgroundColor: 'white', 
      borderRadius: '16px', 
      overflow: 'hidden', 
      fontSize: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    },
    th: { backgroundColor: '#f8fafc', padding: '12px 4px', border: '1px solid #f1f5f9', color: '#64748b', fontWeight: 'bold' },
    td: { padding: '12px 4px', border: '1px solid #f1f5f9', textAlign: 'center' }
  };

  if (!user) {
    return (
      <div style={{...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
        <form onSubmit={handleLogin} style={{backgroundColor: 'white', padding: '40px 30px', borderRadius: '32px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)'}}>
          <h2 style={{color: '#2563eb', fontWeight: 900, fontSize: '28px', letterSpacing: '-1px'}}>STUDY MATE</h2>
          <p style={{color: '#94a3b8', marginBottom: '30px', fontSize: '14px'}}>환영합니다! 이름을 입력해주세요.</p>
          <input style={{width: '100%', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px', boxSizing: 'border-box', fontSize: '16px', outline: 'none'}} placeholder="이름 입력" value={loginInput} onChange={e => setLoginInput(e.target.value)} />
          <button style={{width: '100%', padding: '18px', borderRadius: '16px', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer'}}>입장하기</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={{fontWeight: 900, fontSize: '24px', color: '#1e293b'}}>{view === 'members' ? 'MEMBERS' : view === 'progress' ? '진행 현황' : '벌금 현황'}</h2>
        <button onClick={() => {setUser(null); setView('members');}} style={{border: 'none', background: 'none', color: '#94a3b8'}}><LogOut size={22}/></button>
      </header>

      <main style={{padding: '16px'}}>
        {view === 'members' && !selectedMember && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {members.map(m => (
              <div key={m.id} onClick={() => setSelectedMember(m)} style={{
                backgroundColor: 'white', 
                padding: '30px', // 회색 바탕 꽉 채우기
                borderRadius: '24px', // 큼직하게 변경
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                border: '1px solid #f1f5f9', 
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{fontWeight: 'bold', fontSize: '20px', color: '#334155'}}>{m.name}</span>
                <ChevronRight size={22} color="#cbd5e1"/>
              </div>
            ))}
          </div>
        )}

        {view === 'members' && selectedMember && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <button onClick={() => setSelectedMember(null)} style={{border: 'none', background: 'none', fontWeight: 'bold', color: '#64748b', fontSize: '14px'}}>← BACK</button>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '24px', fontSize: '13px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'}}>
                <ChevronLeft size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d);}}/>
                <b style={{color: '#1e293b'}}>{currentDate.toISOString().split('T')[0]}</b>
                <ChevronRight size={18} onClick={() => {const d = new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d);}}/>
              </div>
              {user.name === selectedMember.name ? (
                <button onClick={addPlan} style={{backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', padding: '8px'}}><Plus size={20}/></button>
              ) : <div style={{width: 36}} />}
            </div>
            
            {dailyPlans.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '14px'}}>오늘의 계획이 없습니다.</div>
            ) : dailyPlans.map(p => (
              <div key={p.id} style={{backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <div style={{flex: 1, fontWeight: 'bold', fontSize: '16px', color: p.is_done ? '#cbd5e1' : '#334155', lineHeight: '1.4'}}>{p.task}</div>
                  <label style={{width: 48, height: 48, borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f8fafc'}}>
                    {uploading === p.id ? <Loader2 size={20} className="animate-spin" color="#2563eb"/> : p.image_url ? <img src={p.image_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <Camera size={20} color="#94a3b8"/>}
                    <input type="file" accept="image/*" style={{display: 'none'}} onChange={e => handleFileUpload(e, p)} disabled={user.name !== selectedMember.name}/>
                  </label>
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
            <h3 style={{textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', fontSize: '16px'}}>3월 4주차 진행</h3>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>멤버</th>{['월','화','수','목','금','토','일'].map(d => <th key={d} style={styles.th}>{d}</th>)}</tr>
              </thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => (
                  <tr key={name}>
                    <td style={{...styles.td, fontWeight: 'bold', color: '#334155'}}>{name}</td>
                    {getWeekDays().map(date => {
                      const status = getDayStatus(name, date);
                      return <td key={date} style={styles.td}>
                        {status === "pending" ? "-" : (status === "success" ? <CheckCircle2 size={18} color="#22c55e" style={{margin:'auto'}}/> : <XCircle size={18} color="#f87171" style={{margin:'auto'}}/>)}
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
                  <th style={styles.th}>이번 주</th>
                </tr>
              </thead>
              <tbody>
                {['백민영', '전상현', '조재영', '최은빈'].map(name => {
                  const fine3rdWeek = calculateFinalFine(name, getWeekDays());
                  return (
                    <tr key={name}>
                      <td style={{...styles.td, fontWeight: 'bold', color: '#334155'}}>{name}</td>
                      <td style={{...styles.td, color: '#2563eb', fontWeight: '900', fontSize: '14px'}}>{fine3rdWeek.toLocaleString()}원</td>
                      <td style={styles.td}>{fine3rdWeek.toLocaleString()}원</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{marginTop: '24px', padding: '20px', backgroundColor: 'white', borderRadius: '20px', fontSize: '12px', color: '#64748b', border: '1px solid #f1f5f9', lineHeight: '1.6'}}>
              <b style={{color: '#ef4444', display: 'block', marginBottom: '8px'}}>🚨 벌금 확정 안내</b>
              • 매주 월요일 자정, 지난주 결과를 합산합니다.<br/>
              • 성공(✅)이 4일 미만인 경우에만 1,000원이 확정됩니다.
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