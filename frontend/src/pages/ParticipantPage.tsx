import React, { useState, useEffect } from 'react';
import { LoginResponse, Team, Keyword } from '../types';
import api, { teamAPI, keywordAPI, bidAPI, auctionAPI, connectWebSocket } from '../utils/api';
import './ParticipantPage.css';
import logo from '../components/fulllogo.png';

interface ParticipantPageProps {
    loginData: LoginResponse;
    onLogout: () => void;
}

type Tab = 'dashboard' | 'auction';

const ParticipantPage: React.FC<ParticipantPageProps> = ({ loginData, onLogout }) => {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [team, setTeam] = useState<Team | null>(null);
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [bidAmount, setBidAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [isAuctionActive, setIsAuctionActive] = useState(false);
    const [currentAuctionKeyword, setCurrentAuctionKeyword] = useState<Keyword | null>(null);

    const [showWinnerEffect, setShowWinnerEffect] = useState(false);
    const [isWinner, setIsWinner] = useState(false);
    const [winnerKeyword, setWinnerKeyword] = useState('');

    // 이벤트 팝업 state
    const [showEventPopup, setShowEventPopup] = useState(false);
    const [eventPopupData, setEventPopupData] = useState<{
        type: string;
        message: string;
        amount?: number;
        isWinner?: boolean;
    } | null>(null);

    // 슬롯머신 state
    const [showSlotMachine, setShowSlotMachine] = useState(false);
    const [slotTeamNames, setSlotTeamNames] = useState<string[]>([]);
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);

    // 도박 state - useRef로 변경하여 WebSocket 핸들러에서 최신값 참조
    const [showGamblingModal, setShowGamblingModal] = useState(false);
    const [gamblingChoice, setGamblingChoice] = useState<'heads' | 'tails' | null>(null);
    const [gamblingBet, setGamblingBet] = useState('');
    const [gamblingCountdown, setGamblingCountdown] = useState(15);
    const [hasPlacedBet, setHasPlacedBet] = useState(false);
    const [gamblingResult, setGamblingResult] = useState<{
        result: 'heads' | 'tails';
        won: boolean;
        amount: number;
    } | null>(null);
    const [showCoinFlip, setShowCoinFlip] = useState(false);

    // 베팅 정보를 저장할 ref
    const betInfoRef = React.useRef<{
        choice: 'heads' | 'tails' | null;
        amount: number;
        placed: boolean;
    }>({
        choice: null,
        amount: 0,
        placed: false
    });

    useEffect(() => {
        loadTeamData();
        loadKeywords();
        checkAuctionStatus();

        const ws = connectWebSocket((msg) => {
            console.log('📨 WebSocket 메시지:', msg);

            if (msg.type === 'auction_started') {
                setIsAuctionActive(true);
                setCurrentAuctionKeyword(msg.keyword);
                setActiveTab('auction');
                showMessage('info', `🎯 경매 시작! ${msg.keyword.name} 키워드에 입찰하세요!`);
            } else if (msg.type === 'new_bid') {
                if (msg.team_name !== loginData.team_name) {
                    showMessage('info', `${msg.team_name}이(가) ${msg.bid_amount}코인 입찰!`);
                }
                loadKeywords();
            } else if (msg.type === 'keyword_created') {
                loadKeywords();
            } else if (msg.type === 'keyword_deleted') {
                loadKeywords();
            } else if (msg.type === 'auction_ended') {
                setIsAuctionActive(false);
                setCurrentAuctionKeyword(null);

                if (msg.winner_team === loginData.team_name) {
                    setIsWinner(true);
                    setWinnerKeyword(msg.keyword);
                    setShowWinnerEffect(true);

                    setTimeout(() => {
                        setShowWinnerEffect(false);
                        setIsWinner(false);
                        setWinnerKeyword('');
                    }, 5000);
                }

                showMessage('success', `경매 종료! ${msg.winner_team}이(가) ${msg.keyword}을(를) ${msg.final_bid}코인에 낙찰!`);
                loadTeamData();
                loadKeywords();
            } else if (msg.type === 'event_slot_start') {
                setSlotTeamNames(msg.team_names);
                setShowSlotMachine(true);
                setCurrentSlotIndex(0);

                let index = 0;
                const slotInterval = setInterval(() => {
                    index = (index + 1) % msg.team_names.length;
                    setCurrentSlotIndex(index);
                }, 100);

                setTimeout(() => {
                    clearInterval(slotInterval);
                }, msg.duration);
            } else if (msg.type === 'event_bonus_coins') {
                setEventPopupData({
                    type: 'bonus',
                    message: msg.message,
                    amount: msg.amount
                });
                setShowEventPopup(true);
                setTimeout(() => {
                    setShowEventPopup(false);
                    setEventPopupData(null);
                }, 5000);
                loadTeamData();
            } else if (msg.type === 'event_random_bonus') {
                setShowSlotMachine(false);

                const isMyTeam = msg.lucky_team_id === loginData.team_id;
                setEventPopupData({
                    type: 'random',
                    message: msg.message,
                    amount: msg.amount,
                    isWinner: isMyTeam
                });
                setShowEventPopup(true);
                setTimeout(() => {
                    setShowEventPopup(false);
                    setEventPopupData(null);
                }, 5000);
                loadTeamData();
            } else if (msg.type === 'event_redistribute') {
                setEventPopupData({
                    type: 'redistribute',
                    message: msg.message,
                    amount: msg.total_amount
                });
                setShowEventPopup(true);
                setTimeout(() => {
                    setShowEventPopup(false);
                    setEventPopupData(null);
                }, 5000);
                loadTeamData();
            } else if (msg.type === 'gambling_started') {
                console.log('🎰 도박 시작 메시지 수신');
                // 도박 시작 - 모든 상태 초기화
                setShowGamblingModal(true);
                setGamblingChoice(null);
                setGamblingBet('');
                setGamblingCountdown(15);
                setHasPlacedBet(false);
                setGamblingResult(null);
                setShowCoinFlip(false);

                // Ref 초기화
                betInfoRef.current = {
                    choice: null,
                    amount: 0,
                    placed: false
                };
            } else if (msg.type === 'gambling_ended') {
                console.log('🎰 도박 종료 메시지 수신');
                console.log('현재 betInfoRef:', betInfoRef.current);

                // 동전 던지기 시작
                setShowCoinFlip(true);

                // 3초 후 결과 표시
                setTimeout(() => {
                    const betInfo = betInfoRef.current;
                    console.log('결과 계산 - betInfo:', betInfo);
                    console.log('결과:', msg.result);

                    if (betInfo.placed && betInfo.choice) {
                        const won = betInfo.choice === msg.result;
                        const resultAmount = won ? betInfo.amount * 2 : Math.floor(betInfo.amount * 0.5);

                        console.log('승패:', won ? '승리' : '패배');
                        console.log('금액:', resultAmount);

                        setGamblingResult({
                            result: msg.result,
                            won: won,
                            amount: resultAmount
                        });
                    } else {
                        console.log('미참여 처리');
                        setGamblingResult({
                            result: msg.result,
                            won: false,
                            amount: 0
                        });
                    }

                    // 5초 후 모달 닫기
                    setTimeout(() => {
                        setShowGamblingModal(false);
                        setGamblingChoice(null);
                        setGamblingBet('');
                        setHasPlacedBet(false);
                        setGamblingResult(null);
                        setShowCoinFlip(false);

                        // Ref 초기화
                        betInfoRef.current = {
                            choice: null,
                            amount: 0,
                            placed: false
                        };

                        loadTeamData();
                    }, 5000);
                }, 3000);
            } else if (msg.type === 'admin_message') {
                showMessage('info', `📢 관리자: ${msg.message}`);
            } else if (msg.type === 'system_reset') {
                showMessage('info', '🔄 시스템이 초기화되었습니다.');
                loadTeamData();
                loadKeywords();
            } else if (msg.type === 'keyword_restored') {
                loadTeamData();
                loadKeywords();
            }
        });

        const interval = setInterval(() => {
            loadTeamData();
            loadKeywords();
            checkAuctionStatus();
        }, 5000);

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, [loginData.team_id, loginData.team_name]);

    useEffect(() => {
        if (showGamblingModal && gamblingCountdown > 0 && !hasPlacedBet && !gamblingResult && !showCoinFlip) {
            const timer = setTimeout(() => {
                setGamblingCountdown(gamblingCountdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [gamblingCountdown, showGamblingModal, hasPlacedBet, gamblingResult, showCoinFlip]);

    const loadTeamData = async () => {
        try {
            const data = await teamAPI.getById(loginData.team_id);
            setTeam(data);
        } catch (err) {
            console.error('팀 데이터 로드 실패:', err);
        }
    };

    const loadKeywords = async () => {
        try {
            const data = await keywordAPI.getAll();
            setKeywords(data);
        } catch (err) {
            console.error('키워드 로드 실패:', err);
        }
    };

    const checkAuctionStatus = async () => {
        try {
            const state = await auctionAPI.getState();
            setIsAuctionActive(state.is_active);

            if (state.is_active && state.current_keyword_id) {
                const allKeywords = await keywordAPI.getAll();
                const currentKw = allKeywords.find(k => k.id === state.current_keyword_id);
                setCurrentAuctionKeyword(currentKw || null);
            } else {
                setCurrentAuctionKeyword(null);
            }
        } catch (err) {
            console.error('경매 상태 확인 실패:', err);
        }
    };

    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleBid = async () => {
        if (!currentAuctionKeyword || !bidAmount) {
            showMessage('error', '입찰 금액을 입력해주세요.');
            return;
        }

        const amount = parseInt(bidAmount);
        if (amount < currentAuctionKeyword.min_bid) {
            showMessage('error', `최소 입찰가는 ${currentAuctionKeyword.min_bid}코인입니다.`);
            return;
        }

        if (team && amount > team.coins) {
            showMessage('error', '보유 코인이 부족합니다.');
            return;
        }

        setLoading(true);
        try {
            await bidAPI.place(loginData.team_id, currentAuctionKeyword.id, amount);
            showMessage('success', '입찰이 완료되었습니다!');
            setBidAmount('');
            loadTeamData();
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '입찰에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleGamblingBet = async () => {
        console.log('🎰 베팅 버튼 클릭');
        console.log('선택:', gamblingChoice);
        console.log('금액:', gamblingBet);

        if (!gamblingChoice) {
            console.error('선택 없음');
            showMessage('error', '앞면 또는 뒷면을 선택해주세요.');
            return;
        }

        const amount = parseInt(gamblingBet);
        if (!amount || amount <= 0) {
            console.error('금액 없음 또는 0');
            showMessage('error', '베팅 금액을 입력해주세요.');
            return;
        }

        if (team && amount > team.coins) {
            console.error('코인 부족');
            showMessage('error', '보유 코인이 부족합니다.');
            return;
        }

        try {
            await api.post('/api/gambling/bet', {
                team_id: loginData.team_id,
                choice: gamblingChoice,
                bet_amount: amount
            });

            betInfoRef.current = {
                choice: gamblingChoice,
                amount: amount,
                placed: true
            };

            setHasPlacedBet(true);
            showMessage('success', '도박 참여가 완료되었습니다!');
        } catch (err: any) {
            showMessage('error', err.response?.data?.detail || '도박 참여에 실패했습니다.');
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

    const myKeywords = keywords.filter(k => k.owner_team_id === loginData.team_id);

    return (
        <div className="participant-page">
            {/* 슬롯머신 오버레이 */}
            {showSlotMachine && (
                <div className="slot-machine-overlay">
                    <div className="slot-machine">
                        <h1 className="slot-title">🍀 행운의 룰렛 🍀</h1>
                        <div className="slot-display">
                            <div className="slot-team-name">
                                {slotTeamNames[currentSlotIndex]}
                            </div>
                        </div>
                        <div className="slot-message">당첨팀을 결정하는 중...</div>
                    </div>
                </div>
            )}

            {/* 낙찰자 이펙트 오버레이 */}
            {showWinnerEffect && isWinner && (
                <div className="winner-overlay">
                    <div className="confetti-container">
                        {[...Array(50)].map((_, i) => (
                            <div key={i} className="confetti" style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`
                            }} />
                        ))}
                    </div>
                    <div className="winner-modal">
                        <div className="winner-trophy">🏆</div>
                        <h1 className="winner-title">축하합니다!</h1>
                        <p className="winner-text">낙찰 성공!</p>
                        <div className="winner-keyword-display">{winnerKeyword}</div>
                        <p className="winner-message">키워드를 획득하셨습니다! 🎉</p>
                    </div>
                </div>
            )}

            {/* 이벤트 팝업 */}
            {showEventPopup && eventPopupData && (
                <div className="event-popup-overlay">
                    <div className="event-popup">
                        {eventPopupData.type === 'bonus' && (
                            <>
                                <div className="event-popup-icon">🎁</div>
                                <h2>전체 보너스!</h2>
                                <p className="event-popup-amount">+{eventPopupData.amount} 코인</p>
                                <p className="event-popup-message">{eventPopupData.message}</p>
                            </>
                        )}
                        {eventPopupData.type === 'random' && (
                            <>
                                <div className="event-popup-icon">
                                    {eventPopupData.isWinner ? '🍀' : '😮'}
                                </div>
                                <h2>{eventPopupData.isWinner ? '행운의 당첨!' : '행운의 보너스'}</h2>
                                {eventPopupData.isWinner && (
                                    <p className="event-popup-amount">+{eventPopupData.amount} 코인</p>
                                )}
                                <p className="event-popup-message">{eventPopupData.message}</p>
                            </>
                        )}
                        {eventPopupData.type === 'redistribute' && (
                            <>
                                <div className="event-popup-icon">⚖️</div>
                                <h2>부의 재분배!</h2>
                                <p className="event-popup-message">{eventPopupData.message}</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 도박 모달 */}
            {showGamblingModal && (
                <div className="gambling-modal-overlay">
                    <div className="gambling-modal">
                        {showCoinFlip ? (
                            gamblingResult ? (
                                // 결과 화면
                                <div className="gambling-result-display">
                                    <div className="result-coin-participant">
                                        {gamblingResult.result === 'heads' ? '👑' : '🌟'}
                                    </div>
                                    <h2>{gamblingResult.result === 'heads' ? '앞면!' : '뒷면!'}</h2>
                                    {betInfoRef.current.placed ? (
                                        <div className={`result-message ${gamblingResult.won ? 'won' : 'lost'}`}>
                                            {gamblingResult.won ? (
                                                <>
                                                    <div className="result-icon">🎉</div>
                                                    <h3>승리!</h3>
                                                    <p className="result-amount">+{gamblingResult.amount} 코인</p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="result-icon">😢</div>
                                                    <h3>패배...</h3>
                                                    <p className="result-amount">-{gamblingResult.amount} 코인</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="result-message">
                                            <div className="result-icon">😶</div>
                                            <h3>미참여</h3>
                                            <p>베팅하지 않았습니다</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // 동전 던지기 애니메이션
                                <div className="coin-flip-animation">
                                    <h2 className="flip-title-small">🎰 동전 던지는 중...</h2>
                                    <div className="coin-container-small">
                                        <div className="coin-3d-small">
                                            <div className="coin-side-small front">👑</div>
                                            <div className="coin-side-small back">🌟</div>
                                        </div>
                                    </div>
                                    <p className="flip-message-small">결과를 확인하는 중...</p>
                                </div>
                            )
                        ) : hasPlacedBet ? (
                            // 베팅 완료 대기 화면
                            <div className="bet-confirmed">
                                <div className="confirmed-icon">✅</div>
                                <h3>베팅 완료!</h3>
                                <p>선택: {betInfoRef.current.choice === 'heads' ? '앞면 👑' : '뒷면 🌟'}</p>
                                <p>베팅액: {betInfoRef.current.amount} 코인</p>
                                <p className="waiting-text">결과를 기다리는 중...</p>
                            </div>
                        ) : (
                            // 베팅 화면
                            <>
                                <h2>🎰 동전 던지기 도박</h2>
                                <div className="gambling-timer">{gamblingCountdown}초</div>

                                <div className="gambling-choice">
                                    <h3>동전 면 선택</h3>
                                    <div className="choice-buttons">
                                        <button
                                            className={`choice-btn ${gamblingChoice === 'heads' ? 'active' : ''}`}
                                            onClick={() => {
                                                console.log('앞면 선택');
                                                setGamblingChoice('heads');
                                            }}
                                        >
                                            <div className="choice-icon">👑</div>
                                            <div>앞면</div>
                                        </button>
                                        <button
                                            className={`choice-btn ${gamblingChoice === 'tails' ? 'active' : ''}`}
                                            onClick={() => {
                                                console.log('뒷면 선택');
                                                setGamblingChoice('tails');
                                            }}
                                        >
                                            <div className="choice-icon">🌟</div>
                                            <div>뒷면</div>
                                        </button>
                                    </div>
                                </div>

                                <div className="gambling-bet">
                                    <h3>베팅 금액</h3>
                                    <input
                                        type="number"
                                        value={gamblingBet}
                                        onChange={(e) => {
                                            console.log('금액 입력:', e.target.value);
                                            setGamblingBet(e.target.value);
                                        }}
                                        placeholder="베팅할 코인 수"
                                        min="1"
                                        max={team?.coins || 0}
                                    />
                                    <div className="gambling-info">
                                        <p>보유 코인: {team?.coins || 0}</p>
                                        <p>성공 시: +{gamblingBet ? parseInt(gamblingBet) * 2 : 0} 코인</p>
                                        <p>실패 시: -{gamblingBet ? Math.floor(parseInt(gamblingBet) * 0.5) : 0} 코인</p>
                                    </div>
                                </div>

                                <button
                                    className="btn-gambling-submit"
                                    onClick={handleGamblingBet}
                                    disabled={!gamblingChoice || !gamblingBet}
                                >
                                    베팅하기
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <button
                className="hamburger-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="메뉴 토글"
            >
                <div className={`hamburger-icon ${isSidebarOpen ? 'open' : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </button>

            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-logo">
                    <img src={logo} alt="로고" className="logo-image" />
                </div>

                <div className="sidebar-header">
                    <div className="team-info">
                        <div className="team-icon">👥</div>
                        <div className="team-details">
                            <h3>{loginData.team_name}</h3>
                            <div className="member-name-display">
                                👤 {loginData.display_name}
                            </div>
                            <div className="coin-display">
                                💰 <strong>{team?.coins || 0}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <span className="nav-icon">📊</span>
                        <span className="nav-text">대시보드</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'auction' ? 'active' : ''} ${isAuctionActive ? 'auction-live' : ''}`}
                        onClick={() => setActiveTab('auction')}
                    >
                        <span className="nav-icon">{isAuctionActive ? '🔴' : '⏸️'}</span>
                        <span className="nav-text">입찰</span>
                        {isAuctionActive && <span className="live-badge">LIVE</span>}
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={onLogout}>
                        <span className="nav-icon">🚪</span>
                        <span className="nav-text">로그아웃</span>
                    </button>
                </div>
            </aside>

            <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <div className="main-header">
                    <img src={logo} alt="로고" className="main-logo" />
                </div>

                {message && (
                    <div className={`message-alert ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="tab-content-wrapper">
                    {activeTab === 'dashboard' ? (
                        <div className="dashboard-tab">
                            {team && (
                                <div className="keywords-status">
                                    <h3>📊 계열별 보유 키워드</h3>
                                    <div className="category-grid">
                                        {Object.entries(team.keywords_by_category).map(([category, count]) => (
                                            <div key={category} className="category-card">
                                                <div
                                                    className="category-badge"
                                                    style={{ backgroundColor: getCategoryColor(category) }}
                                                >
                                                    {category}
                                                </div>
                                                <div className="category-count">{count} / 3개</div>
                                                <div className="category-status">
                                                    {count === 0 ? '⚠️ 필수' : count >= 3 ? '✅ 최대' : '✅'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="owned-keywords-section">
                                <h3>🏆 보유 키워드 ({myKeywords.length}개)</h3>
                                {myKeywords.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">📦</div>
                                        <p>아직 보유한 키워드가 없습니다.</p>
                                        <p>경매에 참여하여 키워드를 획득하세요!</p>
                                    </div>
                                ) : (
                                    <div className="owned-keywords-grid">
                                        {myKeywords.map((kw) => (
                                            <div key={kw.id} className="owned-keyword-card">
                                                <div
                                                    className="keyword-badge"
                                                    style={{ backgroundColor: getCategoryColor(kw.category) }}
                                                >
                                                    {kw.category}
                                                </div>
                                                <div className="keyword-name">{kw.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="team-stats">
                                <h3>📈 팀 통계</h3>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <div className="stat-label">보유 코인</div>
                                        <div className="stat-value">💰 {team?.coins || 0}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-label">보유 키워드</div>
                                        <div className="stat-value">🏷️ {myKeywords.length}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-label">선택 국가</div>
                                        <div className="stat-value">🌍 {team?.country || '미선택'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="auction-tab">
                            {isAuctionActive && currentAuctionKeyword ? (
                                <div className="auction-active-section">
                                    <h3>🎯 현재 경매 진행 중!</h3>
                                    <div className="current-auction-display">
                                        <div
                                            className="auction-keyword-badge"
                                            style={{ backgroundColor: getCategoryColor(currentAuctionKeyword.category) }}
                                        >
                                            {currentAuctionKeyword.category}
                                        </div>
                                        <h2>{currentAuctionKeyword.name}</h2>
                                        <p className="auction-minbid">최소 입찰가: {currentAuctionKeyword.min_bid}코인</p>

                                        <div className="bid-input-section">
                                            <input
                                                type="number"
                                                value={bidAmount}
                                                onChange={(e) => setBidAmount(e.target.value)}
                                                placeholder={`최소 ${currentAuctionKeyword.min_bid}코인`}
                                                min={currentAuctionKeyword.min_bid}
                                                disabled={loading}
                                                className="bid-input-large"
                                            />
                                            <button
                                                className="btn btn-bid-large"
                                                onClick={handleBid}
                                                disabled={loading || !bidAmount}
                                            >
                                                {loading ? '입찰 중...' : '💰 입찰하기'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="waiting-auction-section">
                                    <div className="waiting-icon">⏳</div>
                                    <h3>경매 대기 중...</h3>
                                    <p>관리자가 경매를 시작하면 여기에 키워드가 표시됩니다.</p>
                                    <p className="tip">💡 대기하는 동안 대시보드에서 팀 현황을 확인하세요!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ParticipantPage;