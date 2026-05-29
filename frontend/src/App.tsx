import React, { useState, useEffect } from 'react';
import './App.css';
import AdminLogin from './components/AdminLogin';
import TeamLogin from './components/TeamLogin';
import ParticipantPage from './pages/ParticipantPage';
import AdminPage from './pages/AdminPage';
import AuctionControlPage from './pages/AuctionControlPage';
import AuctionScreenPage from './pages/AuctionScreenPage';
import SettingsPage from './pages/SettingsPage';
import { LoginResponse } from './types';
import logo from './components/fulllogo.png';

type View = 'home' | 'admin-login' | 'admin-dashboard' | 'auction-control' | 'settings' | 'participant-login' | 'participant-dashboard';

function App() {
  const [view, setView] = useState<View>('home');
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [adminAuth, setAdminAuth] = useState<any>(null);

  // 컴포넌트 마운트시 localStorage에서 로그인 정보 복원
  useEffect(() => {
    const savedParticipantData = localStorage.getItem('participantLoginData');
    const savedAdminData = localStorage.getItem('adminAuthData');

    if (savedParticipantData) {
      try {
        const parsedData = JSON.parse(savedParticipantData);
        setLoginData(parsedData);
        setView('participant-dashboard');
      } catch (err) {
        console.error('참가자 로그인 데이터 복원 실패:', err);
        localStorage.removeItem('participantLoginData');
      }
    } else if (savedAdminData) {
      try {
        const parsedData = JSON.parse(savedAdminData);
        setAdminAuth(parsedData);
        setView('admin-dashboard');
      } catch (err) {
        console.error('관리자 로그인 데이터 복원 실패:', err);
        localStorage.removeItem('adminAuthData');
      }
    }
  }, []);

  // 경매 스크린 페이지인 경우
  if (window.location.pathname === '/auction-screen') {
    return <AuctionScreenPage />;
  }
  // 관리자 로그인 성공
  const handleAdminLoginSuccess = (data: any) => {
    setAdminAuth(data);
    setView('admin-dashboard');
    // localStorage에 저장
    localStorage.setItem('adminAuthData', JSON.stringify(data));
  };

  // 참가자 로그인 성공
  const handleParticipantLoginSuccess = (data: LoginResponse) => {
    setLoginData(data);
    setView('participant-dashboard');
    // localStorage에 저장
    localStorage.setItem('participantLoginData', JSON.stringify(data));
  };

  // 로그아웃
  const handleLogout = () => {
    setLoginData(null);
    setAdminAuth(null);
    setView('home');
    // localStorage에서 제거
    localStorage.removeItem('participantLoginData');
    localStorage.removeItem('adminAuthData');
  };

  // 화면 렌더링
  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <div className="user-type-selection">
            <img src={logo} alt="로고" className="app-logo" />
            <h2>사용자 유형을 선택하세요</h2>
            <div className="button-group">
              <button
                className="btn btn-admin"
                onClick={() => setView('admin-login')}
              >
                👨‍💼 관리자
              </button>
              <button
                className="btn btn-participant"
                onClick={() => setView('participant-login')}
              >
                👥 참가자
              </button>
            </div>
          </div>
        );

      case 'admin-login':
        return (
          <div className="content">
            <button
              className="btn btn-back"
              onClick={() => setView('home')}
            >
              ← 돌아가기
            </button>
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          </div>
        );

      case 'admin-dashboard':
        return (
          <AdminPage
            onBack={handleLogout}
            onStartAuctionMode={() => setView('auction-control')}
            onOpenSettings={() => setView('settings')}
          />
        );

      case 'settings':
        return (
          <SettingsPage
            onBack={() => setView('admin-dashboard')}
          />
        );

      case 'auction-control':
        return (
          <AuctionControlPage
            onBack={() => setView('admin-dashboard')}
            onStartAuction={() => { }}
          />
        );

      case 'participant-login':
        return (
          <div className="content">
            <button
              className="btn btn-back"
              onClick={() => setView('home')}
            >
              ← 돌아가기
            </button>
            <TeamLogin onLoginSuccess={handleParticipantLoginSuccess} />
          </div>
        );

      case 'participant-dashboard':
        return loginData ? (
          <ParticipantPage loginData={loginData} onLogout={handleLogout} />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {renderView()}
      </header>
    </div>
  );
}

export default App;