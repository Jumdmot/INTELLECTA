import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict
import json
import random
import asyncio
from datetime import datetime

from database import get_db, engine
from models import Base, Team, Keyword, Bid, AuctionState, User

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(title="실시간 경매 시스템")

# CORS 설정 (프론트엔드와 통신하기 위해 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 출처 허용 (로컬 네트워크용)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket 연결 관리자
class ConnectionManager:
    """
    WebSocket 연결을 관리하는 클래스
    여러 클라이언트의 연결을 저장하고 브로드캐스트 기능 제공
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ 새 연결: 총 {len(self.active_connections)}명 접속 중")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"❌ 연결 종료: 총 {len(self.active_connections)}명 접속 중")
    
    async def broadcast(self, message: dict):
        """모든 연결된 클라이언트에게 메시지 전송"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        # 연결이 끊긴 클라이언트 제거
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

# 이벤트 설정 저장
event_settings = {
    "bonus_coins": 10,
    "random_min": 20,
    "random_max": 50
}

# 도박 상태 관리
gambling_state = {
    "is_active": False,
    "start_time": None,
    "participants": {}  # {team_id: {"choice": "heads/tails", "bet_amount": int}}
}

# ============================================
# API 엔드포인트들
# ============================================

@app.get("/")
async def root():
    """서버 상태 확인용 엔드포인트"""
    return {
        "message": "실시간 경매 시스템 API",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/teams")
async def get_teams(db: Session = Depends(get_db)):
    """모든 팀 정보 조회"""
    teams = db.query(Team).all()
    return [
        {
            "id": team.id,
            "name": team.name,
            "coins": team.coins,
            "country": team.country,
            "keywords_by_category": team.keywords_by_category
        }
        for team in teams
    ]

@app.get("/api/teams/{team_id}")
async def get_team(team_id: int, db: Session = Depends(get_db)):
    """특정 팀 정보 조회"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    
    return {
        "id": team.id,
        "name": team.name,
        "coins": team.coins,
        "country": team.country,
        "keywords_by_category": team.keywords_by_category
    }

@app.put("/api/teams/{team_id}")
async def update_team(team_id: int, team_data: dict, db: Session = Depends(get_db)):
    """팀 정보 수정 (관리자용)"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    
    # 수정 가능한 필드들
    if "name" in team_data:
        team.name = team_data["name"]
    if "password" in team_data:
        team.password = team_data["password"]
    if "coins" in team_data:
        team.coins = team_data["coins"]
    if "country" in team_data:
        team.country = team_data["country"]
    
    db.commit()
    db.refresh(team)
    
    return {"success": True, "message": "팀 정보가 수정되었습니다"}

@app.post("/api/teams/create")
async def create_team(team_data: dict, db: Session = Depends(get_db)):
    """새 팀 생성 (관리자용)"""
    team = Team(
        name=team_data["name"],
        password=team_data.get("password", "default123"),
        coins=team_data.get("coins", 80),
        country=team_data.get("country"),
        keywords_by_category={
            "물리": 0,
            "화학": 0,
            "생명": 0,
            "수학": 0,
            "인문": 0
        }
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    
    return {"success": True, "team_id": team.id}

@app.delete("/api/teams/{team_id}")
async def delete_team(team_id: int, db: Session = Depends(get_db)):
    """팀 삭제 (관리자용)"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    
    db.delete(team)
    db.commit()
    
    return {"success": True, "message": "팀이 삭제되었습니다"}

@app.post("/api/teams/login")
async def team_login(credentials: dict, db: Session = Depends(get_db)):
    """팀 로그인"""
    team = db.query(Team).filter(
        Team.name == credentials.get("name"),
        Team.password == credentials.get("password")
    ).first()
    
    if not team:
        raise HTTPException(status_code=401, detail="팀명 또는 비밀번호가 올바르지 않습니다")
    
    return {
        "success": True,
        "team_id": team.id,
        "team_name": team.name,
        "coins": team.coins
    }

@app.post("/api/users/login")
async def user_login(credentials: dict, db: Session = Depends(get_db)):
    """개별 사용자 로그인 (팀 내 멤버용)"""
    user = db.query(User).filter(
        User.username == credentials.get("username"),
        User.password == credentials.get("password")
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    team = db.query(Team).filter(Team.id == user.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="소속 팀을 찾을 수 없습니다")

    return {
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "team_id": team.id,
        "team_name": team.name,
        "coins": team.coins
    }

@app.get("/api/users")
async def get_users(db: Session = Depends(get_db)):
    """모든 사용자 조회 (관리자용)"""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "team_id": u.team_id
        }
        for u in users
    ]

@app.get("/api/teams/{team_id}/users")
async def get_team_users(team_id: int, db: Session = Depends(get_db)):
    """특정 팀의 멤버 목록 조회"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    users = db.query(User).filter(User.team_id == team_id).all()
    return [
        {"id": u.id, "username": u.username, "display_name": u.display_name}
        for u in users
    ]

@app.post("/api/users/create")
async def create_user(user_data: dict, db: Session = Depends(get_db)):
    """사용자 생성 (관리자용)"""
    existing = db.query(User).filter(User.username == user_data.get("username")).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다")

    team = db.query(Team).filter(Team.id == user_data.get("team_id")).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")

    user = User(
        username=user_data["username"],
        password=user_data["password"],
        display_name=user_data.get("display_name", user_data["username"]),
        team_id=user_data["team_id"]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "user_id": user.id}

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, user_data: dict, db: Session = Depends(get_db)):
    """사용자 정보 수정 (관리자용)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if "username" in user_data:
        conflict = db.query(User).filter(
            User.username == user_data["username"],
            User.id != user_id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다")
        user.username = user_data["username"]
    if "password" in user_data and user_data["password"]:
        user.password = user_data["password"]
    if "display_name" in user_data:
        user.display_name = user_data["display_name"]
    if "team_id" in user_data:
        team = db.query(Team).filter(Team.id == user_data["team_id"]).first()
        if not team:
            raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
        user.team_id = user_data["team_id"]

    db.commit()
    return {"success": True}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """사용자 삭제 (관리자용)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    db.delete(user)
    db.commit()
    return {"success": True}

@app.post("/api/admin/login")
async def admin_login(credentials: dict):
    """관리자 로그인"""
    # 관리자 계정: admin / admin2024!
    if (credentials.get("username") == "admin" and 
        credentials.get("password") == "admin2024!"):
        return {
            "success": True,
            "role": "admin",
            "username": "admin"
        }
    raise HTTPException(status_code=401, detail="관리자 인증에 실패했습니다")

@app.get("/api/keywords")
async def get_keywords(db: Session = Depends(get_db)):
    """모든 키워드 조회"""
    keywords = db.query(Keyword).all()
    return [
        {
            "id": kw.id,
            "name": kw.name,
            "category": kw.category,
            "min_bid": kw.min_bid,
            "sold": kw.sold,
            "owner_team_id": kw.owner_team_id
        }
        for kw in keywords
    ]

@app.get("/api/keywords/available")
async def get_available_keywords(db: Session = Depends(get_db)):
    """구매 가능한 키워드 조회 (미판매 키워드만)"""
    keywords = db.query(Keyword).filter(Keyword.sold == False).all()
    return [
        {
            "id": kw.id,
            "name": kw.name,
            "category": kw.category,
            "min_bid": kw.min_bid
        }
        for kw in keywords
    ]

@app.post("/api/keywords")
async def create_keyword(keyword_data: dict, db: Session = Depends(get_db)):
    """새 키워드 생성 (관리자용)"""
    keyword = Keyword(
        name=keyword_data["name"],
        category=keyword_data["category"],
        min_bid=keyword_data["min_bid"]
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    
    # 모든 클라이언트에게 새 키워드 알림
    await manager.broadcast({
        "type": "keyword_created",
        "keyword": {
            "id": keyword.id,
            "name": keyword.name,
            "category": keyword.category,
            "min_bid": keyword.min_bid
        }
    })
    
    return {"success": True, "keyword_id": keyword.id}

@app.delete("/api/keywords/{keyword_id}")
async def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    """키워드 삭제 (관리자용)"""
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    
    # 이미 판매된 키워드는 삭제 불가
    if keyword.sold:
        raise HTTPException(status_code=400, detail="이미 판매된 키워드는 삭제할 수 없습니다")
    
    db.delete(keyword)
    db.commit()
    
    # 모든 클라이언트에게 키워드 삭제 알림
    await manager.broadcast({
        "type": "keyword_deleted",
        "keyword_id": keyword_id
    })
    
    return {"success": True, "message": "키워드가 삭제되었습니다"}

@app.post("/api/keywords/{keyword_id}/restore")
async def restore_keyword(keyword_id: int, db: Session = Depends(get_db)):
    """키워드 복구 (낙찰 취소, 관리자용)"""
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    
    if not keyword.sold:
        raise HTTPException(status_code=400, detail="판매되지 않은 키워드입니다")
    
    # 팀 정보 업데이트
    if keyword.owner_team_id:
        team = db.query(Team).filter(Team.id == keyword.owner_team_id).first()
        if team:
            # 계열별 키워드 개수 감소
            category_counts = team.keywords_by_category or {}
            if keyword.category in category_counts and category_counts[keyword.category] > 0:
                category_counts[keyword.category] -= 1
                team.keywords_by_category = category_counts
    
    # 키워드 복구
    keyword.sold = False
    keyword.owner_team_id = None
    
    db.commit()
    
    # 모든 클라이언트에게 알림
    await manager.broadcast({
        "type": "keyword_restored",
        "keyword_id": keyword_id,
        "keyword_name": keyword.name
    })
    
    return {"success": True, "message": "키워드가 복구되었습니다"}

@app.post("/api/admin/broadcast")
async def broadcast_message(data: dict):
    """전체 메시지 전송 (관리자용)"""
    message = data.get("message", "")
    
    if not message:
        raise HTTPException(status_code=400, detail="메시지가 비어있습니다")
    
    # 모든 클라이언트에게 메시지 전송
    await manager.broadcast({
        "type": "admin_message",
        "message": message
    })
    
    return {"success": True, "message": "메시지가 전송되었습니다"}

@app.post("/api/admin/reset")
async def reset_system(db: Session = Depends(get_db)):
    """전체 시스템 초기화 (관리자용)"""
    try:
        # 모든 팀 코인 리셋 및 키워드 초기화
        teams = db.query(Team).all()
        for team in teams:
            team.coins = 80
            team.keywords_by_category = {
                "물리": 0,
                "화학": 0,
                "생명": 0,
                "수학": 0,
                "인문": 0
            }
        
        # 모든 키워드 복구
        keywords = db.query(Keyword).all()
        for keyword in keywords:
            keyword.sold = False
            keyword.owner_team_id = None
        
        # 모든 입찰 기록 삭제
        db.query(Bid).delete()
        
        # 경매 상태 초기화
        auction_state = db.query(AuctionState).first()
        if auction_state:
            auction_state.is_active = False
            auction_state.current_keyword_id = None
            auction_state.current_round = 1
        
        db.commit()
        
        # 모든 클라이언트에게 알림
        await manager.broadcast({
            "type": "system_reset",
            "message": "시스템이 초기화되었습니다"
        })
        
        return {"success": True, "message": "시스템이 초기화되었습니다"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"초기화 실패: {str(e)}")

@app.get("/api/admin/event-settings")
async def get_event_settings():
    """이벤트 설정 조회"""
    return event_settings

@app.post("/api/admin/event-settings")
async def update_event_settings(settings: dict):
    """이벤트 설정 업데이트"""
    if "bonus_coins" in settings:
        event_settings["bonus_coins"] = settings["bonus_coins"]
    if "random_min" in settings:
        event_settings["random_min"] = settings["random_min"]
    if "random_max" in settings:
        event_settings["random_max"] = settings["random_max"]
    
    return {"success": True, "settings": event_settings}

@app.post("/api/admin/event/bonus-coins")
async def give_bonus_coins(data: dict, db: Session = Depends(get_db)):
    """모든 팀에게 보너스 코인 지급 (관리자용)"""
    bonus_amount = event_settings["bonus_coins"]
    
    try:
        teams = db.query(Team).all()
        for team in teams:
            team.coins += bonus_amount
        
        db.commit()
        
        # 모든 클라이언트에게 알림
        await manager.broadcast({
            "type": "event_bonus_coins",
            "amount": bonus_amount,
            "message": f"🎁 모든 팀에게 {bonus_amount}코인 보너스 지급!"
        })
        
        return {"success": True, "message": f"모든 팀에게 {bonus_amount}코인이 지급되었습니다"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"보너스 지급 실패: {str(e)}")

@app.post("/api/admin/event/random-bonus")
async def random_team_bonus(db: Session = Depends(get_db)):
    """랜덤 팀에게 큰 보너스 지급 (관리자용)"""
    try:
        teams = db.query(Team).all()
        if not teams:
            raise HTTPException(status_code=404, detail="팀이 없습니다")
        
        # 설정에서 보너스 금액 가져오기
        bonus_amount = random.randint(event_settings["random_min"], event_settings["random_max"])
        
        # 먼저 슬롯머신 시작 알림 (모든 팀 이름 전송)
        team_names = [team.name for team in teams]
        await manager.broadcast({
            "type": "event_slot_start",
            "team_names": team_names,
            "duration": 5000  # 5초간 슬롯머신
        })
        
        # 5초 대기
        await asyncio.sleep(5)
        
        # 랜덤 팀 선택
        lucky_team = random.choice(teams)
        lucky_team.coins += bonus_amount
        db.commit()
        
        # 당첨자 발표
        await manager.broadcast({
            "type": "event_random_bonus",
            "lucky_team_id": lucky_team.id,
            "lucky_team_name": lucky_team.name,
            "amount": bonus_amount,
            "message": f"🍀 행운의 팀! {lucky_team.name}이(가) {bonus_amount}코인 보너스 획득!"
        })
        
        return {
            "success": True,
            "lucky_team": lucky_team.name,
            "bonus_amount": bonus_amount
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"랜덤 보너스 실패: {str(e)}")

@app.post("/api/admin/event/steal-coins")
async def steal_coins_event(data: dict, db: Session = Depends(get_db)):
    """상위 팀 코인 일부를 하위 팀에게 분배"""
    try:
        teams = db.query(Team).order_by(Team.coins.desc()).all()
        if len(teams) < 2:
            raise HTTPException(status_code=400, detail="팀이 부족합니다")
        
        # 상위 50% 팀에서 코인 수집
        mid_point = len(teams) // 2
        rich_teams = teams[:mid_point]
        poor_teams = teams[mid_point:]
        
        total_stolen = 0
        for team in rich_teams:
            steal_amount = int(team.coins * 0.1)  # 10% 가져가기
            team.coins -= steal_amount
            total_stolen += steal_amount
        
        # 하위 팀들에게 균등 분배
        bonus_per_team = 0
        if poor_teams:
            bonus_per_team = total_stolen // len(poor_teams)
            for team in poor_teams:
                team.coins += bonus_per_team
        
        db.commit()
        
        # 모든 클라이언트에게 알림
        await manager.broadcast({
            "type": "event_redistribute",
            "total_amount": total_stolen,
            "bonus_per_team": bonus_per_team,
            "message": f"⚖️ 부의 재분배! 상위 팀에서 총 {total_stolen}코인을 하위 팀에게 분배!"
        })
        
        return {"success": True, "redistributed": total_stolen}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"재분배 실패: {str(e)}")

@app.post("/api/bids")
async def place_bid(bid_data: dict, db: Session = Depends(get_db)):
    """입찰하기"""
    team_id = bid_data["team_id"]
    keyword_id = bid_data["keyword_id"]
    bid_amount = bid_data["bid_amount"]
    
    # 팀 정보 확인
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    
    # 키워드 정보 확인
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    
    # 이미 판매된 키워드인지 확인
    if keyword.sold:
        raise HTTPException(status_code=400, detail="이미 판매된 키워드입니다")
    
    # 최소 입찰가 확인
    if bid_amount < keyword.min_bid:
        raise HTTPException(status_code=400, detail=f"최소 입찰가는 {keyword.min_bid}코인입니다")
    
    # 보유 코인 확인
    if team.coins < bid_amount:
        raise HTTPException(status_code=400, detail="보유 코인이 부족합니다")
    
    # 입찰 기록 생성
    bid = Bid(
        team_id=team_id,
        keyword_id=keyword_id,
        bid_amount=bid_amount,
        round=1
    )
    db.add(bid)
    db.commit()
    
    # 실시간 알림
    await manager.broadcast({
        "type": "new_bid",
        "team_name": team.name,
        "keyword_name": keyword.name,
        "bid_amount": bid_amount,
        "timestamp": datetime.now().isoformat()
    })
    
    return {"success": True, "bid_id": bid.id}

@app.get("/api/auction/state")
async def get_auction_state(db: Session = Depends(get_db)):
    """현재 경매 상태 조회"""
    state = db.query(AuctionState).first()
    if not state:
        # 상태가 없으면 생성
        state = AuctionState()
        db.add(state)
        db.commit()
    
    return {
        "is_active": state.is_active,
        "current_keyword_id": state.current_keyword_id,
        "current_round": state.current_round
    }

@app.post("/api/auction/start")
async def start_auction(data: dict, db: Session = Depends(get_db)):
    """경매 시작 (관리자용)"""
    keyword_id = data.get("keyword_id")
    
    # 키워드 확인
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    
    if keyword.sold:
        raise HTTPException(status_code=400, detail="이미 판매된 키워드입니다")
    
    # 경매 상태 업데이트
    state = db.query(AuctionState).first()
    if not state:
        state = AuctionState()
        db.add(state)
    
    state.is_active = True
    state.current_keyword_id = keyword_id
    state.current_round = 1
    db.commit()
    
    # 모든 클라이언트에게 경매 시작 알림
    await manager.broadcast({
        "type": "auction_started",
        "keyword": {
            "id": keyword.id,
            "name": keyword.name,
            "category": keyword.category,
            "min_bid": keyword.min_bid
        }
    })
    
    return {"success": True, "message": "경매가 시작되었습니다"}

@app.post("/api/auction/end")
async def end_auction(data: dict, db: Session = Depends(get_db)):
    """경매 종료 및 낙찰 처리 (관리자용)"""
    winner_team_id = data.get("winner_team_id")
    final_bid = data.get("final_bid")
    
    state = db.query(AuctionState).first()
    if not state or not state.is_active:
        raise HTTPException(status_code=400, detail="진행 중인 경매가 없습니다")
    
    keyword = db.query(Keyword).filter(Keyword.id == state.current_keyword_id).first()
    team = db.query(Team).filter(Team.id == winner_team_id).first()
    
    if not keyword or not team:
        raise HTTPException(status_code=404, detail="키워드 또는 팀을 찾을 수 없습니다")
    
    # 낙찰 처리
    keyword.sold = True
    keyword.owner_team_id = winner_team_id
    team.coins -= final_bid
    
    # 계열별 키워드 개수 업데이트
    category_counts = team.keywords_by_category or {}
    category_counts[keyword.category] = category_counts.get(keyword.category, 0) + 1
    team.keywords_by_category = category_counts
    
    # 경매 상태 초기화
    state.is_active = False
    state.current_keyword_id = None
    
    db.commit()
    
    # 모든 클라이언트에게 경매 종료 알림
    await manager.broadcast({
        "type": "auction_ended",
        "winner_team": team.name,
        "keyword": keyword.name,
        "final_bid": final_bid
    })
    
    return {"success": True, "message": "경매가 종료되었습니다"}

@app.post("/api/auction/pass")
async def pass_auction(db: Session = Depends(get_db)):
    """경매 유찰 처리 (관리자용)"""
    state = db.query(AuctionState).first()
    if not state or not state.is_active:
        raise HTTPException(status_code=400, detail="진행 중인 경매가 없습니다")
    
    keyword = db.query(Keyword).filter(Keyword.id == state.current_keyword_id).first()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    
    # 경매 상태 초기화 (키워드는 판매되지 않은 상태로 유지)
    state.is_active = False
    state.current_keyword_id = None
    
    db.commit()
    
    # 모든 클라이언트에게 유찰 알림
    await manager.broadcast({
        "type": "auction_passed",
        "keyword": keyword.name,
        "message": f"{keyword.name} 키워드가 유찰되었습니다"
    })
    
    return {"success": True, "message": "경매가 유찰 처리되었습니다"}

@app.get("/api/auction/current-bids")
async def get_current_bids(db: Session = Depends(get_db)):
    """현재 진행 중인 경매의 입찰 현황 조회"""
    state = db.query(AuctionState).first()
    if not state or not state.is_active:
        return {"bids": []}
    
    # 현재 키워드에 대한 입찰 조회 (team 관계 함께 로드)
    bids = db.query(Bid).options(joinedload(Bid.team)).filter(
        Bid.keyword_id == state.current_keyword_id,
        Bid.round == state.current_round
    ).order_by(Bid.bid_amount.desc()).all()

    result = [
        {
            "team_name": bid.team.name if bid.team else "Unknown",
            "bid_amount": bid.bid_amount,
            "timestamp": bid.timestamp.isoformat()
        }
        for bid in bids
    ]

    return {"bids": result}

# ============================================
# 도박 API
# ============================================

@app.get("/api/gambling/state")
async def get_gambling_state():
    """도박 상태 조회"""
    return {
        "is_active": gambling_state["is_active"],
        "start_time": gambling_state["start_time"]
    }

@app.post("/api/gambling/start")
async def start_gambling():
    """도박 시작 (관리자용)"""
    global gambling_state
    
    gambling_state = {
        "is_active": True,
        "start_time": datetime.now().isoformat(),
        "participants": {}
    }
    
    # 모든 클라이언트에게 도박 시작 알림
    await manager.broadcast({
        "type": "gambling_started",
        "duration": 15000  # 15초로 변경
    })
    
    return {"success": True, "message": "도박이 시작되었습니다"}

@app.post("/api/gambling/bet")
async def place_gambling_bet(data: dict, db: Session = Depends(get_db)):
    """도박 참여"""
    team_id = data.get("team_id")
    choice = data.get("choice")  # "heads" or "tails"
    bet_amount = data.get("bet_amount")
    
    if not gambling_state["is_active"]:
        raise HTTPException(status_code=400, detail="진행 중인 도박이 없습니다")
    
    # 팀 정보 확인
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    
    # 보유 코인 확인
    if team.coins < bet_amount:
        raise HTTPException(status_code=400, detail="보유 코인이 부족합니다")
    
    # 도박 참여 저장
    gambling_state["participants"][team_id] = {
        "team_name": team.name,
        "choice": choice,
        "bet_amount": bet_amount
    }
    
    # 참가자 수 업데이트 브로드캐스트
    await manager.broadcast({
        "type": "gambling_participant_update",
        "count": len(gambling_state["participants"])
    })
    
    return {"success": True, "message": "도박 참여가 완료되었습니다"}
@app.get("/api/gambling/participants")
async def get_gambling_participants():
    """도박 참가자 수 조회 (금액과 선택은 비공개)"""
    return {
        "count": len(gambling_state["participants"]),
        "participants": [
            {"team_name": p["team_name"]} 
            for p in gambling_state["participants"].values()
        ]
    }

@app.post("/api/gambling/end")
async def end_gambling(db: Session = Depends(get_db)):
    """도박 종료 및 결과 처리 (관리자용)"""
    if not gambling_state["is_active"]:
        raise HTTPException(status_code=400, detail="진행 중인 도박이 없습니다")
    
    # 동전 던지기 결과 (heads 또는 tails)
    result = random.choice(["heads", "tails"])
    
    winners = []
    losers = []
    
    # 각 참가자의 결과 처리
    for team_id, participant in gambling_state["participants"].items():
        team = db.query(Team).filter(Team.id == int(team_id)).first()
        if not team:
            continue
        
        bet_amount = participant["bet_amount"]
        choice = participant["choice"]
        
        if choice == result:
            # 성공: 2배 지급
            team.coins += bet_amount
            winners.append({
                "team_name": team.name,
                "bet_amount": bet_amount,
                "won_amount": bet_amount * 2
            })
        else:
            # 실패: 50% 차감
            loss = int(bet_amount * 0.5)
            team.coins -= loss
            losers.append({
                "team_name": team.name,
                "bet_amount": bet_amount,
                "lost_amount": loss
            })
    
    db.commit()
    
    # 도박 상태 초기화
    gambling_state["is_active"] = False
    gambling_state["participants"] = {}
    
    # 결과 브로드캐스트
    await manager.broadcast({
        "type": "gambling_ended",
        "result": result,
        "winners": winners,
        "losers": losers
    })
    
    return {
        "success": True,
        "result": result,
        "winners": winners,
        "losers": losers
    }

# ============================================
# WebSocket 엔드포인트
# ============================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    실시간 통신용 WebSocket 엔드포인트
    클라이언트는 이 엔드포인트로 연결하여 실시간 업데이트를 받습니다
    """
    await manager.connect(websocket)
    try:
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 메시지를 모든 클라이언트에게 브로드캐스트
            await manager.broadcast({
                "type": "message",
                "data": message,
                "timestamp": datetime.now().isoformat()
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast({
            "type": "user_left",
            "connections": len(manager.active_connections)
        })

# React 빌드 정적 파일 서빙 (프로덕션 환경에서 Dockerfile이 /app/static에 빌드 결과물 복사)
STATIC_DIR = "static"
if os.path.exists(STATIC_DIR):
    # React 빌드의 /static/ 하위 JS/CSS 파일 서빙
    if os.path.exists(f"{STATIC_DIR}/static"):
        app.mount("/static", StaticFiles(directory=f"{STATIC_DIR}/static"), name="react-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(_full_path: str = ""):
        return FileResponse(f"{STATIC_DIR}/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)