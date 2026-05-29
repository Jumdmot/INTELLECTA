import React, { useState, useEffect } from 'react';
import { Team, User } from '../types';
import api, { teamAPI, userAPI } from '../utils/api';
import './SettingsPage.css';

interface SettingsPageProps {
    onBack: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'teams' | 'members' | 'events'>('teams');

    // 팀 생성 폼
    const [newTeam, setNewTeam] = useState({ name: '', password: '', coins: 80, country: '' });

    // 팀 수정 폼
    const [editForm, setEditForm] = useState({ name: '', password: '', coins: 0, country: '' });

    // 멤버 관리 상태
    const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
    const [teamUsers, setTeamUsers] = useState<Record<number, User[]>>({});
    const [creatingMemberFor, setCreatingMemberFor] = useState<number | null>(null);
    const [newMember, setNewMember] = useState({ username: '', password: '', display_name: '' });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editUserForm, setEditUserForm] = useState({ username: '', password: '', display_name: '' });

    // 이벤트 설정
    const [eventSettings, setEventSettings] = useState({ bonus_coins: 10, random_min: 20, random_max: 50 });

    useEffect(() => {
        loadTeams();
        loadEventSettings();
    }, []);

    const loadTeams = async () => {
        try {
            const data = await teamAPI.getAll();
            setTeams(data);
        } catch (err) {
            console.error('팀 로드 실패:', err);
        }
    };

    const loadEventSettings = async () => {
        try {
            const { data } = await api.get('/api/admin/event-settings');
            setEventSettings(data);
        } catch (err) {
            console.error('이벤트 설정 로드 실패:', err);
        }
    };

    const loadTeamUsers = async (teamId: number) => {
        try {
            const data = await userAPI.getByTeam(teamId);
            setTeamUsers(prev => ({ ...prev, [teamId]: data }));
        } catch (err) {
            console.error('멤버 로드 실패:', err);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    // ── 팀 CRUD ──
    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTeam.name || !newTeam.password) {
            showMessage('error', '팀명과 비밀번호는 필수입니다.');
            return;
        }
        try {
            await teamAPI.create(newTeam.name, newTeam.password, newTeam.coins, newTeam.country);
            showMessage('success', '팀이 생성되었습니다!');
            setNewTeam({ name: '', password: '', coins: 80, country: '' });
            setIsCreating(false);
            loadTeams();
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '팀 생성에 실패했습니다.');
        }
    };

    const handleEditTeam = (team: Team) => {
        setEditingTeam(team);
        setEditForm({ name: team.name, password: '', coins: team.coins, country: team.country || '' });
    };

    const handleUpdateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTeam) return;
        try {
            const updateData: any = { name: editForm.name, coins: editForm.coins, country: editForm.country };
            if (editForm.password) updateData.password = editForm.password;
            await teamAPI.update(editingTeam.id, updateData);
            showMessage('success', '팀 정보가 수정되었습니다!');
            setEditingTeam(null);
            loadTeams();
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '팀 수정에 실패했습니다.');
        }
    };

    const handleDeleteTeam = async (teamId: number, teamName: string) => {
        if (!window.confirm(`정말로 "${teamName}" 팀을 삭제하시겠습니까?\n소속 멤버도 모두 삭제됩니다.`)) return;
        try {
            await teamAPI.delete(teamId);
            showMessage('success', '팀이 삭제되었습니다.');
            loadTeams();
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '팀 삭제에 실패했습니다.');
        }
    };

    // ── 멤버 CRUD ──
    const toggleTeamExpand = async (teamId: number) => {
        if (expandedTeam === teamId) {
            setExpandedTeam(null);
        } else {
            setExpandedTeam(teamId);
            await loadTeamUsers(teamId);
        }
        setCreatingMemberFor(null);
        setEditingUser(null);
    };

    const handleCreateMember = async (e: React.FormEvent, teamId: number) => {
        e.preventDefault();
        if (!newMember.username || !newMember.password || !newMember.display_name) {
            showMessage('error', '아이디, 비밀번호, 이름은 필수입니다.');
            return;
        }
        try {
            await userAPI.create(newMember.username, newMember.password, newMember.display_name, teamId);
            showMessage('success', '멤버가 추가되었습니다!');
            setNewMember({ username: '', password: '', display_name: '' });
            setCreatingMemberFor(null);
            loadTeamUsers(teamId);
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '멤버 추가에 실패했습니다.');
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setEditUserForm({ username: user.username, password: '', display_name: user.display_name });
    };

    const handleUpdateUser = async (e: React.FormEvent, teamId: number) => {
        e.preventDefault();
        if (!editingUser) return;
        try {
            const data: any = { username: editUserForm.username, display_name: editUserForm.display_name };
            if (editUserForm.password) data.password = editUserForm.password;
            await userAPI.update(editingUser.id, data);
            showMessage('success', '멤버 정보가 수정되었습니다!');
            setEditingUser(null);
            loadTeamUsers(teamId);
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '멤버 수정에 실패했습니다.');
        }
    };

    const handleDeleteUser = async (userId: number, displayName: string, teamId: number) => {
        if (!window.confirm(`"${displayName}" 멤버를 삭제하시겠습니까?`)) return;
        try {
            await userAPI.delete(userId);
            showMessage('success', '멤버가 삭제되었습니다.');
            loadTeamUsers(teamId);
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '멤버 삭제에 실패했습니다.');
        }
    };

    // ── 이벤트 설정 ──
    const handleSaveEventSettings = async () => {
        try {
            await api.post('/api/admin/event-settings', eventSettings);
            showMessage('success', '이벤트 설정이 저장되었습니다!');
        } catch {
            showMessage('error', '이벤트 설정 저장에 실패했습니다.');
        }
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div>
                    <h1>⚙️ 시스템 설정</h1>
                    <p className="subtitle">팀 · 멤버 · 이벤트 관리</p>
                </div>
                <button className="btn btn-back" onClick={onBack}>
                    ← 대시보드로 돌아가기
                </button>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>{message.text}</div>
            )}

            {/* 탭 네비게이션 */}
            <div className="settings-tabs">
                <button className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>
                    🏛️ 팀 관리
                </button>
                <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
                    👤 멤버 관리
                </button>
                <button className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
                    🎉 이벤트 설정
                </button>
            </div>

            {/* ══════════ 팀 관리 탭 ══════════ */}
            {activeTab === 'teams' && (
                <>
                    <div className="settings-stats">
                        <div className="stat-box">
                            <div className="stat-icon">🏛️</div>
                            <div className="stat-info">
                                <div className="stat-number">{teams.length}</div>
                                <div className="stat-label">총 팀 수</div>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon">💰</div>
                            <div className="stat-info">
                                <div className="stat-number">{teams.reduce((s, t) => s + t.coins, 0)}</div>
                                <div className="stat-label">총 코인</div>
                            </div>
                        </div>
                    </div>

                    <div className="create-team-section">
                        {!isCreating ? (
                            <button className="btn btn-create-new" onClick={() => setIsCreating(true)}>
                                ➕ 새 팀 생성
                            </button>
                        ) : (
                            <div className="create-team-form">
                                <h3>새 팀 생성</h3>
                                <form onSubmit={handleCreateTeam}>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>팀명 *</label>
                                            <input type="text" value={newTeam.name}
                                                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                                placeholder="예: 1조" required />
                                        </div>
                                        <div className="form-group">
                                            <label>팀 비밀번호 *</label>
                                            <input type="password" value={newTeam.password}
                                                onChange={(e) => setNewTeam({ ...newTeam, password: e.target.value })}
                                                placeholder="팀 비밀번호" required />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>초기 코인</label>
                                            <input type="number" value={newTeam.coins}
                                                onChange={(e) => setNewTeam({ ...newTeam, coins: parseInt(e.target.value) })}
                                                min="0" />
                                        </div>
                                        <div className="form-group">
                                            <label>국가 (선택)</label>
                                            <input type="text" value={newTeam.country}
                                                onChange={(e) => setNewTeam({ ...newTeam, country: e.target.value })}
                                                placeholder="예: 대한민국" />
                                        </div>
                                    </div>
                                    <div className="form-actions">
                                        <button type="submit" className="btn btn-submit">생성</button>
                                        <button type="button" className="btn btn-cancel"
                                            onClick={() => { setIsCreating(false); setNewTeam({ name: '', password: '', coins: 80, country: '' }); }}>
                                            취소
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    <div className="teams-list-section">
                        <h2>📋 팀 목록 ({teams.length}개)</h2>
                        <div className="teams-table">
                            <div className="table-header">
                                <div className="col-name">팀명</div>
                                <div className="col-coins">코인</div>
                                <div className="col-country">국가</div>
                                <div className="col-keywords">키워드</div>
                                <div className="col-actions">관리</div>
                            </div>
                            {teams.map((team) => (
                                <div key={team.id} className="table-row">
                                    {editingTeam?.id === team.id ? (
                                        <form onSubmit={handleUpdateTeam} className="edit-row">
                                            <div className="col-name">
                                                <input type="text" value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                                            </div>
                                            <div className="col-coins">
                                                <input type="number" value={editForm.coins}
                                                    onChange={(e) => setEditForm({ ...editForm, coins: parseInt(e.target.value) })} min="0" />
                                            </div>
                                            <div className="col-country">
                                                <input type="text" value={editForm.country}
                                                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} placeholder="국가" />
                                            </div>
                                            <div className="col-keywords">
                                                <input type="password" value={editForm.password}
                                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                                    placeholder="새 비밀번호 (선택)" />
                                            </div>
                                            <div className="col-actions">
                                                <button type="submit" className="btn-icon btn-save" title="저장">💾</button>
                                                <button type="button" className="btn-icon btn-cancel-edit"
                                                    onClick={() => setEditingTeam(null)} title="취소">❌</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="col-name"><strong>{team.name}</strong></div>
                                            <div className="col-coins">💰 {team.coins}</div>
                                            <div className="col-country">{team.country || '-'}</div>
                                            <div className="col-keywords">
                                                {Object.values(team.keywords_by_category).reduce((a, b) => a + b, 0)}개
                                            </div>
                                            <div className="col-actions">
                                                <button className="btn-icon btn-edit" onClick={() => handleEditTeam(team)} title="수정">✏️</button>
                                                <button className="btn-icon btn-delete" onClick={() => handleDeleteTeam(team.id, team.name)} title="삭제">🗑️</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* ══════════ 멤버 관리 탭 ══════════ */}
            {activeTab === 'members' && (
                <div className="members-section">
                    <div className="members-header-info">
                        <p className="members-description">
                            각 팀을 펼쳐서 멤버를 추가·수정·삭제하세요. 멤버는 개인 아이디로 로그인하며, 같은 팀의 여러 명이 동시에 접속할 수 있습니다.
                        </p>
                    </div>

                    {teams.length === 0 ? (
                        <div className="members-empty">팀이 없습니다. 먼저 팀을 생성하세요.</div>
                    ) : (
                        teams.map((team) => {
                            const members = teamUsers[team.id] || [];
                            const isExpanded = expandedTeam === team.id;
                            return (
                                <div key={team.id} className={`team-member-card ${isExpanded ? 'expanded' : ''}`}>
                                    {/* 팀 헤더 */}
                                    <div className="team-member-header" onClick={() => toggleTeamExpand(team.id)}>
                                        <div className="team-member-title">
                                            <span className="team-member-name">{team.name}</span>
                                            <span className="team-member-count">
                                                멤버 {isExpanded ? members.length : '?'}명
                                            </span>
                                            <span className="team-member-coins">💰 {team.coins}</span>
                                        </div>
                                        <span className="expand-arrow">{isExpanded ? '▲' : '▼'}</span>
                                    </div>

                                    {/* 멤버 목록 */}
                                    {isExpanded && (
                                        <div className="team-member-body">
                                            {/* 멤버 목록 테이블 */}
                                            {members.length > 0 && (
                                                <div className="member-table">
                                                    <div className="member-table-header">
                                                        <div>표시 이름</div>
                                                        <div>아이디</div>
                                                        <div>관리</div>
                                                    </div>
                                                    {members.map((user) => (
                                                        <div key={user.id} className="member-table-row">
                                                            {editingUser?.id === user.id ? (
                                                                <form onSubmit={(e) => handleUpdateUser(e, team.id)} className="member-edit-row">
                                                                    <input
                                                                        type="text"
                                                                        value={editUserForm.display_name}
                                                                        onChange={(e) => setEditUserForm({ ...editUserForm, display_name: e.target.value })}
                                                                        placeholder="표시 이름" required
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={editUserForm.username}
                                                                        onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                                                                        placeholder="아이디" required
                                                                    />
                                                                    <input
                                                                        type="password"
                                                                        value={editUserForm.password}
                                                                        onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                                                                        placeholder="새 비밀번호 (선택)"
                                                                    />
                                                                    <div className="member-edit-actions">
                                                                        <button type="submit" className="btn-icon btn-save" title="저장">💾</button>
                                                                        <button type="button" className="btn-icon btn-cancel-edit"
                                                                            onClick={() => setEditingUser(null)} title="취소">❌</button>
                                                                    </div>
                                                                </form>
                                                            ) : (
                                                                <>
                                                                    <div className="member-display-name">{user.display_name}</div>
                                                                    <div className="member-username">{user.username}</div>
                                                                    <div className="member-actions">
                                                                        <button className="btn-icon btn-edit" onClick={() => handleEditUser(user)} title="수정">✏️</button>
                                                                        <button className="btn-icon btn-delete"
                                                                            onClick={() => handleDeleteUser(user.id, user.display_name, team.id)} title="삭제">🗑️</button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {members.length === 0 && (
                                                <div className="member-empty">이 팀에 아직 멤버가 없습니다.</div>
                                            )}

                                            {/* 멤버 추가 */}
                                            {creatingMemberFor === team.id ? (
                                                <form className="member-create-form" onSubmit={(e) => handleCreateMember(e, team.id)}>
                                                    <h4>새 멤버 추가</h4>
                                                    <div className="member-form-row">
                                                        <div className="form-group">
                                                            <label>표시 이름 *</label>
                                                            <input type="text" value={newMember.display_name}
                                                                onChange={(e) => setNewMember({ ...newMember, display_name: e.target.value })}
                                                                placeholder="예: 홍길동" required />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>아이디 *</label>
                                                            <input type="text" value={newMember.username}
                                                                onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
                                                                placeholder="로그인 아이디" required />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>비밀번호 *</label>
                                                            <input type="password" value={newMember.password}
                                                                onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                                                                placeholder="비밀번호" required />
                                                        </div>
                                                    </div>
                                                    <div className="form-actions">
                                                        <button type="submit" className="btn btn-submit">추가</button>
                                                        <button type="button" className="btn btn-cancel"
                                                            onClick={() => { setCreatingMemberFor(null); setNewMember({ username: '', password: '', display_name: '' }); }}>
                                                            취소
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <button
                                                    className="btn-add-member"
                                                    onClick={() => { setCreatingMemberFor(team.id); setEditingUser(null); }}
                                                >
                                                    ➕ 멤버 추가
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════ 이벤트 설정 탭 ══════════ */}
            {activeTab === 'events' && (
                <div className="event-settings-section">
                    <h2>🎉 이벤트 설정</h2>
                    <p className="section-description">이벤트에서 지급되는 코인 수를 조정할 수 있습니다.</p>

                    <div className="event-settings-grid">
                        <div className="event-setting-card">
                            <div className="event-card-header">
                                <div className="event-card-icon">🎁</div>
                                <h3>전체 보너스</h3>
                            </div>
                            <p className="event-card-description">모든 팀에게 동일한 코인을 지급하는 이벤트</p>
                            <div className="event-input-group">
                                <label>지급 코인 수</label>
                                <input type="number" value={eventSettings.bonus_coins}
                                    onChange={(e) => setEventSettings({ ...eventSettings, bonus_coins: parseInt(e.target.value) || 0 })}
                                    min="1" max="100" />
                                <span className="input-suffix">코인</span>
                            </div>
                        </div>

                        <div className="event-setting-card">
                            <div className="event-card-header">
                                <div className="event-card-icon">🍀</div>
                                <h3>행운의 보너스</h3>
                            </div>
                            <p className="event-card-description">랜덤으로 선정된 한 팀에게 큰 보너스를 지급</p>
                            <div className="event-input-group">
                                <label>최소 코인</label>
                                <input type="number" value={eventSettings.random_min}
                                    onChange={(e) => setEventSettings({ ...eventSettings, random_min: parseInt(e.target.value) || 0 })}
                                    min="1" max="200" />
                                <span className="input-suffix">코인</span>
                            </div>
                            <div className="event-input-group">
                                <label>최대 코인</label>
                                <input type="number" value={eventSettings.random_max}
                                    onChange={(e) => setEventSettings({ ...eventSettings, random_max: parseInt(e.target.value) || 0 })}
                                    min="1" max="200" />
                                <span className="input-suffix">코인</span>
                            </div>
                            <div className="event-preview">
                                당첨 시: {eventSettings.random_min} ~ {eventSettings.random_max} 코인
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-save-event-settings" onClick={handleSaveEventSettings}>
                        💾 이벤트 설정 저장
                    </button>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
