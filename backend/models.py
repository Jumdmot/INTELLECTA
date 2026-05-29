from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Team(Base):
    """
    팀 정보를 저장하는 모델
    """
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    password = Column(String)  # 간단한 인증용
    coins = Column(Integer, default=80)  # 기본 80코인
    country = Column(String, nullable=True)  # 선택한 국가
    
    # 계열별 키워드 개수 (JSON으로 저장)
    # 예: {"물리": 2, "화학": 1, "생명": 3, "수학": 2, "인문": 2}
    keywords_by_category = Column(JSON, default={
        "물리": 0,
        "화학": 0, 
        "생명": 0,
        "수학": 0,
        "인문": 0
    })
    
    # 관계 설정: 이 팀이 소유한 키워드들
    owned_keywords = relationship("Keyword", back_populates="owner_team")
    
    # 이 팀이 제출한 입찰들
    bids = relationship("Bid", back_populates="team")

    # 팀 소속 멤버들
    members = relationship("User", back_populates="team")


class Keyword(Base):
    """
    경매 키워드 정보를 저장하는 모델
    """
    __tablename__ = "keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    category = Column(String)  # 물리, 화학, 생명, 수학, 인문
    min_bid = Column(Integer)  # 최소 입찰가
    sold = Column(Boolean, default=False)  # 낙찰 여부
    owner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    
    # 관계 설정
    owner_team = relationship("Team", back_populates="owned_keywords")
    bids = relationship("Bid", back_populates="keyword")


class Bid(Base):
    """
    입찰 기록을 저장하는 모델
    """
    __tablename__ = "bids"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    keyword_id = Column(Integer, ForeignKey("keywords.id"))
    bid_amount = Column(Integer)  # 입찰 금액
    timestamp = Column(DateTime, default=datetime.utcnow)
    round = Column(Integer, default=1)  # 경매 라운드 (1: 공개, 2: 비공개, 3: 재경매)
    
    # 관계 설정
    team = relationship("Team", back_populates="bids")
    keyword = relationship("Keyword", back_populates="bids")


class User(Base):
    """
    팀 내 개별 사용자 모델
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)  # 로그인 ID
    password = Column(String)
    display_name = Column(String)  # 화면에 표시될 이름
    team_id = Column(Integer, ForeignKey("teams.id"))

    team = relationship("Team", back_populates="members")


class AuctionState(Base):
    """
    경매 전체 상태를 저장하는 모델
    """
    __tablename__ = "auction_state"
    
    id = Column(Integer, primary_key=True, index=True)
    is_active = Column(Boolean, default=False)  # 경매 진행 중 여부
    current_keyword_id = Column(Integer, ForeignKey("keywords.id"), nullable=True)
    current_round = Column(Integer, default=1)  # 현재 라운드
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)