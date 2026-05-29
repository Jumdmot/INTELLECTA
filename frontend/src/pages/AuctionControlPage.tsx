import React, { useState, useEffect } from 'react';
import { Keyword, Team } from '../types';
import api, { keywordAPI, teamAPI } from '../utils/api';
import './AuctionControlPage.css';

interface AuctionControlPageProps {
    onBack: () => void;
    onStartAuction: (keywordId: number) => void;
}

const AuctionControlPage: React.FC<AuctionControlPageProps> = ({ onBack, onStartAuction }) => {
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
    const [isAuctionActive, setIsAuctionActive] = useState(false);
    const [currentBids, setCurrentBids] = useState<any[]>([]);
    const [isGamblingActive, setIsGamblingActive] = useState(false);

    useEffect(() => {
        loadData();
        checkAuctionStatus();
        checkGamblingStatus();

        const interval = setInterval(() => {
            checkAuctionStatus();
            checkGamblingStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkAuctionStatus = async () => {
        try {
            const { data: state } = await api.get('/api/auction/state');
            setIsAuctionActive(state.is_active);

            if (state.is_active) {
                const { data: bidsData } = await api.get('/api/auction/current-bids');
                setCurrentBids(bidsData.bids || []);
            }
        } catch (err) {
            console.error('상태 확인 실패:', err);
        }
    };

    const checkGamblingStatus = async () => {
        try {
            const { data: state } = await api.get('/api/gambling/state');
            setIsGamblingActive(state.is_active);
        } catch (err) {
            console.error('도박 상태 확인 실패:', err);
        }
    };

    const loadData = async () => {
        try {
            const [keywordsData, teamsData] = await Promise.all([
                keywordAPI.getAvailable(),
                teamAPI.getAll()
            ]);
            setKeywords(keywordsData);
            setTeams(teamsData);
        } catch (err) {
            console.error('데이터 로드 실패:', err);
        }
    };

    const handleStartAuction = async () => {
        if (!selectedKeyword) return;

        try {
            await api.post('/api/auction/start', { keyword_id: selectedKeyword.id });

            const screenWindow = window.open(
                '/auction-screen',
                'AuctionScreen',
                'width=1920,height=1080,menubar=no,toolbar=no,location=no'
            );

            if (screenWindow) {
                alert('경매가 시작되었습니다! 스크린 창을 확인하세요.');
                setIsAuctionActive(true);
                checkAuctionStatus();
            } else {
                alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
            }
        } catch (err) {
            console.error('경매 시작 실패:', err);
            alert('경매 시작에 실패했습니다.');
        }
    };

    const handleStartGambling = async () => {
        if (!window.confirm('도박을 시작하시겠습니까?\n참가자들은 15초 동안 동전 앞/뒤면을 선택할 수 있습니다.')) {
            return;
        }

        try {
            await api.post('/api/gambling/start');

            const screenWindow = window.open(
                '/auction-screen',
                'AuctionScreen',
                'width=1920,height=1080,menubar=no,toolbar=no,location=no'
            );

            if (screenWindow) {
                alert('도박이 시작되었습니다! 15초 후 자동으로 결과가 발표됩니다.');
                setIsGamblingActive(true);

                // 15초 후 자동 종료
                setTimeout(async () => {
                    await handleEndGambling();
                }, 15000);
            } else {
                alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
            }
        } catch (err) {
            console.error('도박 시작 실패:', err);
            alert('도박 시작에 실패했습니다.');
        }
    };

    const handleEndGambling = async () => {
        try {
            const { data: result } = await api.post('/api/gambling/end');
            alert(`도박이 종료되었습니다!\n결과: ${result.result === 'heads' ? '앞면' : '뒷면'}\n승자: ${result.winners.length}명\n패자: ${result.losers.length}명`);
            setIsGamblingActive(false);
        } catch (err) {
            console.error('도박 종료 실패:', err);
            alert('도박 종료에 실패했습니다.');
        }
    };

    const handleEndAuction = async () => {
        if (currentBids.length === 0) {
            alert('입찰자가 없습니다.');
            return;
        }

        const highestBid = currentBids[0];
        const winnerTeam = teams.find(t => t.name === highestBid.team_name);

        if (!winnerTeam) {
            alert('낙찰 팀을 찾을 수 없습니다.');
            return;
        }

        if (!window.confirm(`${highestBid.team_name}에게 ${highestBid.bid_amount}코인으로 낙찰하시겠습니까?`)) {
            return;
        }

        try {
            await api.post('/api/auction/end', {
                winner_team_id: winnerTeam.id,
                final_bid: highestBid.bid_amount
            });

            alert('경매가 종료되었습니다!');
            setIsAuctionActive(false);
            loadData();
        } catch (err) {
            console.error('경매 종료 실패:', err);
            alert('경매 종료에 실패했습니다.');
        }
    };

    const handlePassAuction = async () => {
        if (!window.confirm('정말로 이 경매를 유찰 처리하시겠습니까?\n키워드는 다시 경매에 부칠 수 있습니다.')) {
            return;
        }

        try {
            await api.post('/api/auction/pass');

            alert('경매가 유찰 처리되었습니다.');
            setIsAuctionActive(false);
            loadData();
        } catch (err) {
            console.error('유찰 처리 실패:', err);
            alert('유찰 처리에 실패했습니다.');
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

    return (
        <div className="auction-control-page">
            <div className="control-header">
                <div>
                    <h1>🎯 경매 관리</h1>
                    <p className="subtitle">경매할 키워드를 선택하거나 도박을 시작하세요</p>
                </div>
                <button className="btn btn-back" onClick={onBack}>
                    ← 대시보드로 돌아가기
                </button>
            </div>

            {/* 도박 시작 버튼 */}
            <div className="gambling-control-section">
                <button
                    className="btn btn-start-gambling"
                    onClick={handleStartGambling}
                    disabled={isGamblingActive || isAuctionActive}
                >
                    {isGamblingActive ? '🎰 도박 진행 중...' : '🎰 도박 시작하기'}
                </button>
                {isGamblingActive && (
                    <p className="gambling-status">도박이 진행 중입니다. 15초 후 자동으로 결과가 발표됩니다.</p>
                )}
            </div>

            <div className="control-content">
                <div className="keyword-selection-panel">
                    <h2>📦 경매 가능한 키워드 ({keywords.length}개)</h2>
                    <div className="keyword-grid">
                        {keywords.map((kw) => (
                            <div
                                key={kw.id}
                                className={`keyword-select-card ${selectedKeyword?.id === kw.id ? 'selected' : ''}`}
                                onClick={() => setSelectedKeyword(kw)}
                            >
                                <span
                                    className="keyword-badge"
                                    style={{ backgroundColor: getCategoryColor(kw.category) }}
                                >
                                    {kw.category}
                                </span>
                                <div className="keyword-info">
                                    <div className="keyword-name">{kw.name}</div>
                                    <div className="keyword-min-bid">최소 {kw.min_bid}코인</div>
                                </div>
                                {selectedKeyword?.id === kw.id && (
                                    <div className="selected-indicator">✓</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="auction-start-panel">
                    {selectedKeyword ? (
                        <>
                            <h2>🎯 선택된 키워드</h2>
                            <div className="selected-keyword-display">
                                <div
                                    className="large-badge"
                                    style={{ backgroundColor: getCategoryColor(selectedKeyword.category) }}
                                >
                                    {selectedKeyword.category}
                                </div>
                                <h3>{selectedKeyword.name}</h3>
                                <p className="min-bid-info">최소 입찰가: {selectedKeyword.min_bid}코인</p>
                            </div>

                            <div className="teams-ready-status">
                                <h3>👥 참가 팀 현황</h3>
                                <div className="teams-status-grid">
                                    {teams.map((team) => (
                                        <div key={team.id} className="team-status-card">
                                            <div className="team-status-name">{team.name}</div>
                                            <div className="team-status-coins">💰 {team.coins}코인</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                className="btn btn-start-auction"
                                onClick={handleStartAuction}
                                disabled={isAuctionActive || isGamblingActive}
                            >
                                {isAuctionActive ? '⏸️ 경매 진행 중...' : '🚀 경매 시작하기'}
                            </button>

                            {isAuctionActive && (
                                <div className="auction-action-buttons">
                                    <button
                                        className="btn btn-end-auction"
                                        onClick={handleEndAuction}
                                    >
                                        🏁 낙찰
                                    </button>
                                    <button
                                        className="btn btn-pass-auction"
                                        onClick={handlePassAuction}
                                    >
                                        ⏭️ 유찰
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-selection-message">
                            <div className="empty-icon">📦</div>
                            <p>왼쪽에서 경매할 키워드를 선택하세요</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuctionControlPage;