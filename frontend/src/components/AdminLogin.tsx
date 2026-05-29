import React, { useState } from 'react';
import api from '../utils/api';
import './TeamLogin.css'; // 동일한 스타일 재사용

interface AdminLoginProps {
    onLoginSuccess: (data: any) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/api/admin/login', { username, password });
            console.log('✅ 관리자 로그인 성공:', data);
            onLoginSuccess(data);
        } catch (err: any) {
            console.error('❌ 로그인 실패:', err);
            setError('관리자 인증에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>👨‍💼 관리자 로그인</h2>
                <p className="login-description">관리자 계정으로 로그인하세요</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">아이디</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="관리자 아이디"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="비밀번호 입력"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-login"
                        disabled={loading}
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>

                <div className="login-hint">
                    <p>💡 힌트: 아이디는 admin, 비밀번호는 admin2024!</p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;