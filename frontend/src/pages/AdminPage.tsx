import React, { useState, useEffect } from 'react';
import { Team, Keyword, AuctionState } from '../types';
import api, { teamAPI, keywordAPI, auctionAPI, connectWebSocket } from '../utils/api';
import './AdminPage.css';

interface AdminPageProps {
    onBack: () => void;
    onStartAuctionMode: () => void;
    onOpenSettings: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onBack, onStartAuctionMode, onOpenSettings }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
    const [activeTab, setActiveTab] = useState<'teams' | 'keywords' | 'create'>('teams');

    // 새 키워드 생성 폼
    const [newKeyword, setNewKeyword] = useState({
        name: '',
        category: '물리',
        min_bid: 10
    });
    const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // 메시지 전송 모달
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState('');

    // 이벤트 모달
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);

    useEffect(() => {
        loadAllData();

        // WebSocket 연결
        const ws = connectWebSocket((msg) => {
            console.log('📨 관리자 WebSocket:', msg);

            if (msg.type === 'new_bid' || msg.type === 'keyword_created') {
                loadAllData(); // 데이터 새로고침
            }
        });

        // 5초마다 자동 새로고침
        const interval = setInterval(loadAllData, 5000);

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, []);

    const loadAllData = async () => {
        try {
            const [teamsData, keywordsData, stateData] = await Promise.all([
                teamAPI.getAll(),
                keywordAPI.getAll(),
                auctionAPI.getState()
            ]);
            setTeams(teamsData);
            setKeywords(keywordsData);
            setAuctionState(stateData);
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        }
    };

    const handleDeleteKeyword = async (keywordId: number) => {
        if (!window.confirm('정말로 이 키워드를 삭제하시겠습니까?')) {
            return;
        }

        try {
            await keywordAPI.delete(keywordId);
            setCreateMessage({ type: 'success', text: '키워드가 삭제되었습니다.' });
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err: any) {
            setCreateMessage({
                type: 'error',
                text: err.response?.data?.detail || '키워드 삭제에 실패했습니다.'
            });
        }
    };

    const handleRestoreKeyword = async (keywordId: number) => {
        if (!window.confirm('이 키워드를 복구하시겠습니까? (낙찰 취소)')) {
            return;
        }

        try {
            await api.post(`/api/keywords/${keywordId}/restore`);
            setCreateMessage({ type: 'success', text: '키워드가 복구되었습니다.' });
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '키워드 복구에 실패했습니다.' });
        }
    };

    const handleBroadcastMessage = async () => {
        if (!broadcastMessage.trim()) {
            return;
        }

        try {
            await api.post('/api/admin/broadcast', { message: broadcastMessage });
            setBroadcastMessage('');
            setIsMessageModalOpen(false);
            setCreateMessage({ type: 'success', text: '메시지가 전송되었습니다.' });
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '메시지 전송에 실패했습니다.' });
        }
    };

    const handleResetAll = async () => {
        const confirmText = '정말로 전체 시스템을 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다:\n- 모든 팀의 코인이 80으로 리셋\n- 모든 키워드 낙찰 취소\n- 모든 입찰 기록 삭제\n\n계속하려면 "초기화"를 입력하세요.';

        const userInput = window.prompt(confirmText);

        if (userInput !== '초기화') {
            return;
        }

        try {
            await api.post('/api/admin/reset');
            setCreateMessage({ type: 'success', text: '시스템이 초기화되었습니다.' });
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '초기화에 실패했습니다.' });
        }
    };

    const handleBonusCoins = async () => {
        try {
            await api.post('/api/admin/event/bonus-coins');
            setCreateMessage({ type: 'success', text: '모든 팀에게 10코인이 지급되었습니다!' });
            setIsEventModalOpen(false);
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '보너스 지급에 실패했습니다.' });
        }
    };

    const handleRandomBonus = async () => {
        try {
            const { data } = await api.post('/api/admin/event/random-bonus');
            setCreateMessage({
                type: 'success',
                text: `${data.lucky_team}이(가) ${data.bonus_amount}코인 행운의 보너스 획득!`
            });
            setIsEventModalOpen(false);
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '랜덤 보너스 실패.' });
        }
    };

    const handleStealCoins = async () => {
        if (!window.confirm('상위 팀 코인의 10%를 하위 팀에게 분배하시겠습니까?')) {
            return;
        }

        try {
            await api.post('/api/admin/event/steal-coins');
            setCreateMessage({ type: 'success', text: '부의 재분배가 완료되었습니다!' });
            setIsEventModalOpen(false);
            loadAllData();
            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err) {
            setCreateMessage({ type: 'error', text: '재분배 실패.' });
        }
    };

    const handleCreateKeyword = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await keywordAPI.create(
                newKeyword.name,
                newKeyword.category,
                newKeyword.min_bid
            );

            setCreateMessage({ type: 'success', text: '키워드가 생성되었습니다!' });
            setNewKeyword({ name: '', category: '물리', min_bid: 10 });
            loadAllData();

            setTimeout(() => setCreateMessage(null), 3000);
        } catch (err: any) {
            setCreateMessage({
                type: 'error',
                text: err.response?.data?.detail || '키워드 생성에 실패했습니다.'
            });
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: { [key: string]: string } = {
            '물리': '#3b82f6',
            '화학': '#ef4444',
            '생명': '#10b981',
            '수학': '#f59e0b',
            '인문': '#8b5cf6'
        };
        return colors[category] || '#6b7280';
    };

    const checkTeamRules = (team: Team) => {
        const issues: string[] = [];
        const categories = team.keywords_by_category;

        // 각 계열 최소 1개 체크
        Object.entries(categories).forEach(([category, count]) => {
            if (count === 0) {
                issues.push(`${category} 계열 미보유`);
            }
            if (count > 3) {
                issues.push(`${category} 계열 초과 (최대 3개)`);
            }
        });

        // 전체 키워드 수 체크
        const totalKeywords = Object.values(categories).reduce((sum, count) => sum + count, 0);
        if (totalKeywords < 7) {
            issues.push(`전체 키워드 부족 (${totalKeywords}/7)`);
        }
        if (totalKeywords > 10) {
            issues.push(`전체 키워드 초과 (${totalKeywords}/10)`);
        }

        return issues;
    };

    const soldKeywords = keywords.filter(k => k.sold);
    const availableKeywords = keywords.filter(k => !k.sold);

    return (
        <div className="admin-page">
            {/* 헤더 */}
            <div className="admin-header">
                <div className="header-title">
                    <h1>👨‍💼 관리자 대시보드</h1>
                    <p className="subtitle">실시간 경매 시스템 통제 센터</p>
                </div>

                <div className="header-actions">
                    <div className="action-row">
                        <button className="btn btn-settings" onClick={onOpenSettings}>
                            ⚙️ 설정
                        </button>
                        <button className="btn btn-auction" onClick={onStartAuctionMode}>
                            🎯 경매 시작
                        </button>
                        <button className="btn btn-message" onClick={() => setIsMessageModalOpen(true)}>
                            📢 전체 메시지
                        </button>
                    </div>
                    <div className="action-row">
                        <button className="btn btn-event" onClick={() => setIsEventModalOpen(true)}>
                            🎉 특별 이벤트
                        </button>
                        <button className="btn btn-reset" onClick={handleResetAll}>
                            🔄 전체 초기화
                        </button>
                        <button className="btn btn-logout" onClick={onBack}>
                            🚪 로그아웃
                        </button>
                    </div>
                </div>
            </div>

            {/* 메시지 전송 모달 */}
            {isMessageModalOpen && (
                <div className="modal-overlay" onClick={() => setIsMessageModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>📢 전체 메시지 전송</h3>
                        <p>모든 참가자에게 메시지를 전송합니다</p>
                        <textarea
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            rows={4}
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="btn btn-send" onClick={handleBroadcastMessage}>
                                전송
                            </button>
                            <button className="btn btn-cancel-modal" onClick={() => {
                                setIsMessageModalOpen(false);
                                setBroadcastMessage('');
                            }}>
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 이벤트 모달 */}
            {isEventModalOpen && (
                <div className="modal-overlay" onClick={() => setIsEventModalOpen(false)}>
                    <div className="modal-content event-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>🎉 특별 이벤트</h3>
                        <p>다양한 이벤트로 경매를 더욱 흥미롭게!</p>

                        <div className="event-buttons">
                            <button className="event-btn bonus-btn" onClick={handleBonusCoins}>
                                <div className="event-icon">🎁</div>
                                <div className="event-title">민생지원금</div>
                                <div className="event-desc">모든 팀에게 코인 지급</div>
                            </button>

                            <button className="event-btn random-btn" onClick={handleRandomBonus}>
                                <div className="event-icon">🍀</div>
                                <div className="event-title">인생 갓챠</div>
                                <div className="event-desc">랜덤 팀에게 20-50코인</div>
                            </button>

                            <button className="event-btn steal-btn" onClick={handleStealCoins}>
                                <div className="event-icon">⚖️</div>
                                <div className="event-title">부의 재분배</div>
                                <div className="event-desc">상위팀 → 하위팀 코인 이전</div>
                            </button>

                            <button className="event-btn close-btn" onClick={() => setIsEventModalOpen(false)}>
                                <div className="event-icon">❌</div>
                                <div className="event-title">닫기</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 통계 요약 */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                        <div className="stat-value">{teams.length}</div>
                        <div className="stat-label">참가 팀</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🏷️</div>
                    <div className="stat-info">
                        <div className="stat-value">{keywords.length}</div>
                        <div className="stat-label">전체 키워드</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-info">
                        <div className="stat-value">{soldKeywords.length}</div>
                        <div className="stat-label">판매 완료</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📦</div>
                    <div className="stat-info">
                        <div className="stat-value">{availableKeywords.length}</div>
                        <div className="stat-label">판매 가능</div>
                    </div>
                </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teams')}
                >
                    👥 팀 현황
                </button>
                <button
                    className={`tab-btn ${activeTab === 'keywords' ? 'active' : ''}`}
                    onClick={() => setActiveTab('keywords')}
                >
                    🏷️ 키워드 관리
                </button>
                <button
                    className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                >
                    ➕ 키워드 생성
                </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="tab-content">
                {/* 팀 현황 탭 */}
                {activeTab === 'teams' && (
                    <div className="teams-section">
                        <h2>팀별 상세 현황</h2>
                        <div className="teams-grid">
                            {teams.map(team => {
                                const issues = checkTeamRules(team);
                                const ownedKeywords = keywords.filter(k => k.owner_team_id === team.id);

                                return (
                                    <div key={team.id} className="team-card">
                                        <div className="team-header">
                                            <h3>{team.name}</h3>
                                            {issues.length > 0 && (
                                                <span className="warning-badge">⚠️ {issues.length}</span>
                                            )}
                                        </div>

                                        <div className="team-info">
                                            <div className="info-row">
                                                <span className="info-label">💰 보유 코인:</span>
                                                <span className="info-value">{team.coins}</span>
                                            </div>

                                            <div className="info-row">
                                                <span className="info-label">🌍 국가:</span>
                                                <span className="info-value">{team.country || '미선택'}</span>
                                            </div>
                                        </div>

                                        <div className="team-categories">
                                            <h4>계열별 키워드</h4>
                                            <div className="mini-category-grid">
                                                {Object.entries(team.keywords_by_category).map(([cat, count]) => (
                                                    <div key={cat} className="mini-category">
                                                        <span
                                                            className="mini-badge"
                                                            style={{ backgroundColor: getCategoryColor(cat) }}
                                                        >
                                                            {cat}
                                                        </span>
                                                        <span className="mini-count">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {ownedKeywords.length > 0 && (
                                            <div className="owned-keywords">
                                                <h4>보유 키워드 ({ownedKeywords.length}개)</h4>
                                                <div className="keyword-tags">
                                                    {ownedKeywords.map(kw => (
                                                        <span
                                                            key={kw.id}
                                                            className="keyword-tag"
                                                            style={{ backgroundColor: getCategoryColor(kw.category) }}
                                                        >
                                                            {kw.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {issues.length > 0 && (
                                            <div className="team-issues">
                                                <h4>⚠️ 규칙 위반</h4>
                                                <ul>
                                                    {issues.map((issue, idx) => (
                                                        <li key={idx}>{issue}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 키워드 관리 탭 */}
                {activeTab === 'keywords' && (
                    <div className="keywords-section">
                        <div className="keywords-columns">
                            <div className="keywords-column">
                                <h3>📦 판매 가능 ({availableKeywords.length}개)</h3>
                                <div className="keyword-list">
                                    {availableKeywords.map(kw => (
                                        <div key={kw.id} className="keyword-card available">
                                            <span
                                                className="keyword-badge"
                                                style={{ backgroundColor: getCategoryColor(kw.category) }}
                                            >
                                                {kw.category}
                                            </span>
                                            <div className="keyword-details">
                                                <div className="keyword-name">{kw.name}</div>
                                                <div className="keyword-price">최소 {kw.min_bid}코인</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="keywords-column">
                                <h3>✅ 판매 완료 ({soldKeywords.length}개)</h3>
                                <div className="keyword-list">
                                    {soldKeywords.map(kw => {
                                        const owner = teams.find(t => t.id === kw.owner_team_id);
                                        return (
                                            <div key={kw.id} className="keyword-card sold">
                                                <span
                                                    className="keyword-badge"
                                                    style={{ backgroundColor: getCategoryColor(kw.category) }}
                                                >
                                                    {kw.category}
                                                </span>
                                                <div className="keyword-details">
                                                    <div className="keyword-name">{kw.name}</div>
                                                    <div className="keyword-owner">
                                                        소유: {owner?.name || '알 수 없음'}
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn-restore-keyword"
                                                    onClick={() => handleRestoreKeyword(kw.id)}
                                                    title="복구"
                                                >
                                                    ↩️
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 키워드 생성 탭 */}
                {activeTab === 'create' && (
                    <div className="create-section">
                        <div className="create-form-wrapper">
                            <h2>➕ 새 키워드 생성</h2>

                            {createMessage && (
                                <div className={`message ${createMessage.type}`}>
                                    {createMessage.text}
                                </div>
                            )}

                            <form onSubmit={handleCreateKeyword} className="create-form">
                                <div className="form-group">
                                    <label>키워드 이름</label>
                                    <input
                                        type="text"
                                        value={newKeyword.name}
                                        onChange={(e) => setNewKeyword({ ...newKeyword, name: e.target.value })}
                                        placeholder="예: 인공지능"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>계열</label>
                                    <select
                                        value={newKeyword.category}
                                        onChange={(e) => setNewKeyword({ ...newKeyword, category: e.target.value })}
                                    >
                                        <option value="물리">물리</option>
                                        <option value="화학">화학</option>
                                        <option value="생명">생명</option>
                                        <option value="수학">수학</option>
                                        <option value="인문">인문</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>최소 입찰가 (코인)</label>
                                    <input
                                        type="number"
                                        value={newKeyword.min_bid}
                                        onChange={(e) => setNewKeyword({ ...newKeyword, min_bid: parseInt(e.target.value) })}
                                        min="1"
                                        required
                                    />
                                </div>

                                <button type="submit" className="btn btn-create">
                                    키워드 생성
                                </button>
                            </form>
                        </div>

                        <div className="create-preview-wrapper">
                            <h3>🎨 미리보기</h3>
                            <div className="preview-card">
                                <span
                                    className="preview-badge"
                                    style={{ backgroundColor: getCategoryColor(newKeyword.category) }}
                                >
                                    {newKeyword.category}
                                </span>
                                <div className="preview-details">
                                    <div className="preview-name">
                                        {newKeyword.name || '키워드 이름'}
                                    </div>
                                    <div className="preview-price">
                                        최소 {newKeyword.min_bid}코인
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;