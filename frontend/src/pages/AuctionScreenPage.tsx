import React, { useState, useEffect } from 'react';
import { Keyword } from '../types';
import api, { connectWebSocket, keywordAPI, auctionAPI } from '../utils/api';
import './AuctionScreenPage.css';

interface BidData {
    team_name: string;
    bid_amount: number;
    timestamp: string;
}

const AuctionScreenPage: React.FC = () => {
    const [keyword, setKeyword] = useState<Keyword | null>(null);
    const [bids, setBids] = useState<BidData[]>([]);
    const [highestBid, setHighestBid] = useState<BidData | null>(null);
    const [showWinnerEffect, setShowWinnerEffect] = useState(false);
    const [winnerData, setWinnerData] = useState<{ team: string; keyword: string; amount: number } | null>(null);

    // 도박 상태
    const [isGambling, setIsGambling] = useState(false);
    const [countdown, setCountdown] = useState(15);
    const [participantCount, setParticipantCount] = useState(0);
    const [showCoinFlip, setShowCoinFlip] = useState(false);
    const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null);
    const [gamblingResult, setGamblingResult] = useState<any>(null);

    useEffect(() => {
        loadAuctionState();
        checkGamblingState();

        const ws = connectWebSocket((msg) => {
            console.log('📨 경매 스크린 메시지:', msg);

            if (msg.type === 'auction_started') {
                setKeyword(msg.keyword);
                setBids([]);
                setHighestBid(null);
                setShowWinnerEffect(false);
                setWinnerData(null);
                setIsGambling(false);
            } else if (msg.type === 'new_bid') {
                const newBid: BidData = {
                    team_name: msg.team_name,
                    bid_amount: msg.bid_amount,
                    timestamp: msg.timestamp
                };

                setBids(prev => {
                    const filtered = prev.filter(b => b.team_name !== newBid.team_name);
                    const updated = [...filtered, newBid].sort((a, b) => b.bid_amount - a.bid_amount);

                    if (updated.length > 0) {
                        setHighestBid(updated[0]);
                    }

                    return updated;
                });
            } else if (msg.type === 'auction_ended') {
                setWinnerData({
                    team: msg.winner_team,
                    keyword: msg.keyword,
                    amount: msg.final_bid
                });
                setShowWinnerEffect(true);

                setTimeout(() => {
                    setShowWinnerEffect(false);
                    setKeyword(null);
                    setBids([]);
                    setHighestBid(null);
                    setWinnerData(null);
                }, 5000);
            } else if (msg.type === 'gambling_started') {
                console.log('🎰 도박 시작 메시지 수신 (스크린)');
                // 도박 시작
                setIsGambling(true);
                setCountdown(15);
                setParticipantCount(0);
                setShowCoinFlip(false);
                setCoinResult(null);
                setGamblingResult(null);
                setKeyword(null);
                setBids([]);
            } else if (msg.type === 'gambling_participant_update') {
                console.log('🎰 참가자 수 업데이트:', msg.count);
                // 참가자 수 업데이트
                setParticipantCount(msg.count);
            } else if (msg.type === 'gambling_ended') {
                console.log('🎰 도박 종료 메시지 수신 (스크린)');
                console.log('결과:', msg.result);
                console.log('승자:', msg.winners);
                console.log('패자:', msg.losers);

                // 동전 던지기 애니메이션 시작
                setShowCoinFlip(true);

                // 3초 후 결과 표시
                setTimeout(() => {
                    setCoinResult(msg.result);
                    setGamblingResult(msg);

                    // 5초 후 초기화
                    setTimeout(() => {
                        setIsGambling(false);
                        setShowCoinFlip(false);
                        setCoinResult(null);
                        setGamblingResult(null);
                        setCountdown(15);
                        setParticipantCount(0);
                    }, 5000);
                }, 3000);
            }
        });

        return () => {
            ws.close();
        };
    }, []);

    useEffect(() => {
        if (isGambling && countdown > 0 && !showCoinFlip) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown, isGambling, showCoinFlip]);

    const checkGamblingState = async () => {
        try {
            const { data: state } = await api.get('/api/gambling/state');

            if (state.is_active) {
                console.log('도박이 이미 진행중입니다');
                setIsGambling(true);
                setCountdown(15);
                setParticipantCount(0);
            }
        } catch (err) {
            console.error('도박 상태 확인 실패:', err);
        }
    };

    const loadAuctionState = async () => {
        try {
            const state = await auctionAPI.getState();

            if (state.is_active && state.current_keyword_id) {
                const keywords = await keywordAPI.getAll();
                const currentKeyword = keywords.find(k => k.id === state.current_keyword_id);

                if (currentKeyword) {
                    setKeyword(currentKeyword);
                }

                const bidsData = await auctionAPI.getCurrentBids();
                if (bidsData.bids && bidsData.bids.length > 0) {
                    const sortedBids = bidsData.bids.sort((a: BidData, b: BidData) => b.bid_amount - a.bid_amount);
                    setBids(sortedBids);
                    setHighestBid(sortedBids[0]);
                }
            }
        } catch (err) {
            console.error('경매 상태 로드 실패:', err);
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

    // 도박 화면 (최우선)
    if (isGambling) {
        console.log('도박 화면 렌더링 - showCoinFlip:', showCoinFlip, 'coinResult:', coinResult, 'gamblingResult:', gamblingResult);

        if (gamblingResult && coinResult) {
            console.log('결과 화면 표시');
            return (
                <div className="auction-screen-page">
                    <div className="gambling-result-screen">
                        <h1 className="gambling-result-title">🎰 도박 결과</h1>

                        <div className="coin-result-display">
                            <div className={`coin-final ${coinResult}`}>
                                {coinResult === 'heads' ? '👑' : '🌟'}
                            </div>
                            <h2>{coinResult === 'heads' ? '앞면!' : '뒷면!'}</h2>
                        </div>

                        <div className="gambling-results-grid">
                            <div className="winners-section">
                                <h3>🎉 승자 ({gamblingResult.winners.length}명)</h3>
                                {gamblingResult.winners.length === 0 ? (
                                    <p className="no-participants">승자가 없습니다</p>
                                ) : (
                                    gamblingResult.winners.map((winner: any, idx: number) => (
                                        <div key={idx} className="result-item winner">
                                            <span className="team-name">{winner.team_name}</span>
                                            <span className="amount">+{winner.won_amount} 코인</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="losers-section">
                                <h3>😢 패자 ({gamblingResult.losers.length}명)</h3>
                                {gamblingResult.losers.length === 0 ? (
                                    <p className="no-participants">패자가 없습니다</p>
                                ) : (
                                    gamblingResult.losers.map((loser: any, idx: number) => (
                                        <div key={idx} className="result-item loser">
                                            <span className="team-name">{loser.team_name}</span>
                                            <span className="amount">-{loser.lost_amount} 코인</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (showCoinFlip) {
            console.log('동전 던지기 애니메이션 표시');
            return (
                <div className="auction-screen-page">
                    <div className="coin-flip-screen">
                        <h1 className="flip-title">🎰 동전 던지는 중...</h1>
                        <div className="coin-container">
                            <div className="coin-3d">
                                <div className="coin-side front">👑</div>
                                <div className="coin-side back">🌟</div>
                            </div>
                        </div>
                        <p className="flip-message">결과를 확인하는 중...</p>
                    </div>
                </div>
            );
        }

        console.log('카운트다운 화면 표시 - countdown:', countdown, 'participantCount:', participantCount);
        return (
            <div className="auction-screen-page">
                <div className="gambling-countdown-screen">
                    <h1 className="gambling-title">🎰 동전 던지기 도박</h1>
                    <div className="countdown-display">
                        <div className="countdown-number">{countdown}</div>
                        <p>참가자들이 선택하는 중...</p>
                    </div>
                    <div className="participant-info">
                        <p className="participant-count">현재 참가자: {participantCount}명</p>
                    </div>
                    <div className="gambling-instructions">
                        <p>앞면(👑) 또는 뒷면(🌟)을 선택하고 베팅하세요!</p>
                        <p>성공 시 2배, 실패 시 50% 차감</p>
                    </div>
                </div>
            </div>
        );
    }

    // 낙찰자 축하 화면
    if (showWinnerEffect && winnerData) {
        return (
            <div className="auction-screen-page">
                <div className="winner-celebration">
                    <div className="confetti-container">
                        {[...Array(50)].map((_, i) => (
                            <div key={i} className="confetti" style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`
                            }} />
                        ))}
                    </div>
                    <div className="winner-content">
                        <div className="winner-trophy">🏆</div>
                        <h1 className="winner-title">낙찰 성공!</h1>
                        <div className="winner-team-name">{winnerData.team}</div>
                        <div className="winner-keyword">{winnerData.keyword}</div>
                        <div className="winner-amount">{winnerData.amount} 코인</div>
                        <div className="winner-message">축하합니다! 🎉</div>
                    </div>
                </div>
            </div>
        );
    }

    // 경매 대기 화면
    if (!keyword) {
        return (
            <div className="auction-screen-page">
                <div className="waiting-screen">
                    <div className="waiting-icon">⏳</div>
                    <h1>경매 대기 중...</h1>
                    <p>관리자가 경매를 시작할 때까지 기다려주세요</p>
                </div>
            </div>
        );
    }

    // 경매 진행 화면
    return (
        <div className="auction-screen-page">
            <div className="screen-layout">
                <div className="keyword-display-panel">
                    <div className="auction-status-badge">🔴 경매 진행 중</div>

                    <div className="keyword-showcase">
                        <div
                            className="showcase-badge"
                            style={{ backgroundColor: getCategoryColor(keyword.category) }}
                        >
                            {keyword.category}
                        </div>
                        <h1 className="showcase-name">{keyword.name}</h1>
                        <p className="showcase-minbid">최소 입찰가: {keyword.min_bid}코인</p>
                    </div>

                    {highestBid && (
                        <div className="current-winner">
                            <div className="winner-label">👑 현재 최고 입찰</div>
                            <div className="winner-team">{highestBid.team_name}</div>
                            <div className="winner-amount">{highestBid.bid_amount} 코인</div>
                        </div>
                    )}
                </div>

                <div className="bids-display-panel">
                    <h2>💰 실시간 입찰 현황</h2>

                    <div className="bids-list">
                        {bids.length === 0 ? (
                            <div className="no-bids-message">
                                <div className="waiting-icon">⏳</div>
                                <p>입찰을 기다리는 중...</p>
                            </div>
                        ) : (
                            bids.map((bid, index) => (
                                <div
                                    key={index}
                                    className={`bid-card ${index === 0 ? 'highest' : ''}`}
                                >
                                    <div className="bid-rank">
                                        {index === 0 ? '👑' : `#${index + 1}`}
                                    </div>
                                    <div className="bid-info">
                                        <div className="bid-team">{bid.team_name}</div>
                                        <div className="bid-time">
                                            {new Date(bid.timestamp).toLocaleTimeString('ko-KR')}
                                        </div>
                                    </div>
                                    <div className="bid-amount-display">
                                        {bid.bid_amount} 코인
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuctionScreenPage;