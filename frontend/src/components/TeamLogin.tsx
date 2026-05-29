import React, { useState } from 'react';
import { userAPI } from '../utils/api';
import { LoginResponse } from '../types';
import './TeamLogin.css';

interface TeamLoginProps {
    onLoginSuccess: (loginData: LoginResponse) => void;
}

const TeamLogin: React.FC<TeamLoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await userAPI.login(username, password);
            onLoginSuccess(response);
        } catch (err: any) {
            setError(err.response?.data?.detail || '로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>👤 참가자 로그인</h2>
                <p className="login-description">개인 아이디와 비밀번호를 입력하세요</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">아이디</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="아이디 입력"
                            required
                            disabled={loading}
                            autoComplete="username"
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
                            autoComplete="current-password"
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
                    <p>💡 관리자에게 발급받은 개인 아이디로 로그인하세요. 같은 팀의 여러 명이 동시에 접속할 수 있습니다.</p>
                </div>
            </div>
        </div>
    );
};

export default TeamLogin;
