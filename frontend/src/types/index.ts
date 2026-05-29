// 팀 정보 타입
export interface Team {
    id: number;
    name: string;
    coins: number;
    country: string | null;
    keywords_by_category: {
        물리: number;
        화학: number;
        생명: number;
        수학: number;
        인문: number;
    };
}

// 키워드 정보 타입
export interface Keyword {
    id: number;
    name: string;
    category: string;
    min_bid: number;
    sold: boolean;
    owner_team_id: number | null;
}

// 입찰 정보 타입
export interface Bid {
    id: number;
    team_id: number;
    keyword_id: number;
    bid_amount: number;
    timestamp: string;
    round: number;
}

// 경매 상태 타입
export interface AuctionState {
    is_active: boolean;
    current_keyword_id: number | null;
    current_round: number;
}

// WebSocket 메시지 타입
export interface WebSocketMessage {
    type: string;
    data?: any;
    team_name?: string;
    keyword_name?: string;
    bid_amount?: number;
    timestamp?: string;
}

// 팀 멤버(사용자) 타입
export interface User {
    id: number;
    username: string;
    display_name: string;
    team_id: number;
}

// 로그인 응답 타입
export interface LoginResponse {
    success: boolean;
    user_id: number;
    username: string;
    display_name: string;
    team_id: number;
    team_name: string;
    coins: number;
}