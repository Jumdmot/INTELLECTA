import axios from 'axios';
import { Team, Keyword, AuctionState, LoginResponse, User } from '../types';

// API 베이스 URL
// - REACT_APP_API_URL 설정 시: Vercel+Render 배포 (백엔드 URL 직접 지정)
// - 미설정 + non-localhost: Railway 배포 (같은 서버, 상대경로)
// - localhost: 로컬 개발
const getApiBaseUrl = () => {
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    if (window.location.hostname !== 'localhost') {
        return '';
    }
    return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

console.log('🌐 API Base URL:', API_BASE_URL);

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// API 함수들
export const teamAPI = {
    // 모든 팀 조회
    getAll: async (): Promise<Team[]> => {
        const response = await api.get('/api/teams');
        return response.data;
    },

    // 특정 팀 조회
    getById: async (teamId: number): Promise<Team> => {
        const response = await api.get(`/api/teams/${teamId}`);
        return response.data;
    },

    // 팀 로그인 (관리자 설정용으로 유지)
    login: async (name: string, password: string): Promise<LoginResponse> => {
        const response = await api.post('/api/teams/login', { name, password });
        return response.data;
    },

    // 팀 수정 (관리자용)
    update: async (teamId: number, data: Partial<Team>) => {
        const response = await api.put(`/api/teams/${teamId}`, data);
        return response.data;
    },

    // 팀 생성 (관리자용)
    create: async (name: string, password: string, coins: number, country?: string) => {
        const response = await api.post('/api/teams/create', {
            name,
            password,
            coins,
            country
        });
        return response.data;
    },

    // 팀 삭제 (관리자용)
    delete: async (teamId: number) => {
        const response = await api.delete(`/api/teams/${teamId}`);
        return response.data;
    },
};

export const userAPI = {
    // 개별 사용자 로그인
    login: async (username: string, password: string): Promise<LoginResponse> => {
        const response = await api.post('/api/users/login', { username, password });
        return response.data;
    },

    // 모든 사용자 조회
    getAll: async (): Promise<User[]> => {
        const response = await api.get('/api/users');
        return response.data;
    },

    // 팀별 사용자 조회
    getByTeam: async (teamId: number): Promise<User[]> => {
        const response = await api.get(`/api/teams/${teamId}/users`);
        return response.data;
    },

    // 사용자 생성
    create: async (username: string, password: string, display_name: string, team_id: number) => {
        const response = await api.post('/api/users/create', { username, password, display_name, team_id });
        return response.data;
    },

    // 사용자 수정
    update: async (userId: number, data: Partial<User> & { password?: string }) => {
        const response = await api.put(`/api/users/${userId}`, data);
        return response.data;
    },

    // 사용자 삭제
    delete: async (userId: number) => {
        const response = await api.delete(`/api/users/${userId}`);
        return response.data;
    },
};

export const keywordAPI = {
    // 모든 키워드 조회
    getAll: async (): Promise<Keyword[]> => {
        const response = await api.get('/api/keywords');
        return response.data;
    },

    // 구매 가능한 키워드만 조회
    getAvailable: async (): Promise<Keyword[]> => {
        const response = await api.get('/api/keywords/available');
        return response.data;
    },

    // 새 키워드 생성 (관리자용)
    create: async (name: string, category: string, min_bid: number) => {
        const response = await api.post('/api/keywords', {
            name,
            category,
            min_bid,
        });
        return response.data;
    },

    // 키워드 삭제 (관리자용)
    delete: async (keywordId: number) => {
        const response = await api.delete(`/api/keywords/${keywordId}`);
        return response.data;
    },
};

export const bidAPI = {
    // 입찰하기
    place: async (team_id: number, keyword_id: number, bid_amount: number) => {
        const response = await api.post('/api/bids', {
            team_id,
            keyword_id,
            bid_amount,
        });
        return response.data;
    },
};

export const auctionAPI = {
    // 경매 상태 조회
    getState: async (): Promise<AuctionState> => {
        const response = await api.get('/api/auction/state');
        return response.data;
    },

    // 경매 시작
    start: async (keywordId: number) => {
        const response = await api.post('/api/auction/start', { keyword_id: keywordId });
        return response.data;
    },

    // 경매 종료
    end: async (winnerTeamId: number, finalBid: number) => {
        const response = await api.post('/api/auction/end', {
            winner_team_id: winnerTeamId,
            final_bid: finalBid
        });
        return response.data;
    },

    // 현재 입찰 현황 조회
    getCurrentBids: async () => {
        const response = await api.get('/api/auction/current-bids');
        return response.data;
    },
};

// SSE 연결 함수 (Server-Sent Events, WebSocket 대체)
export const connectWebSocket = (
    onMessage: (message: any) => void,
    onError?: (error: Event) => void
): EventSource => {
    const backendUrl = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
    const sseUrl = backendUrl
        ? `${backendUrl}/api/events`
        : window.location.hostname !== 'localhost'
            ? '/api/events'
            : 'http://localhost:8000/api/events';

    console.log('📡 SSE URL:', sseUrl);

    const es = new EventSource(sseUrl);

    es.onopen = () => {
        console.log('✅ SSE 연결됨');
    };

    es.onmessage = (event) => {
        const message = JSON.parse(event.data);
        onMessage(message);
    };

    es.onerror = (error) => {
        console.error('❌ SSE 에러 (자동 재연결 시도):', error);
        if (onError) onError(error);
    };

    return es;
};

export default api;