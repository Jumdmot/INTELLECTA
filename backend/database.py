import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# DATABASE_URL 설정:
# - 로컬: SQLite (환경변수 없을 때 기본값)
# - Render: Neon/Supabase PostgreSQL URL을 환경변수로 주입
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./auction.db")

# Neon/Heroku 등 일부 서비스는 postgres:// 로 제공 → postgresql:// 로 변환 필요
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite는 멀티스레드 설정 필요, PostgreSQL은 불필요
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# 세션 생성기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모델 베이스 클래스
Base = declarative_base()

# 데이터베이스 세션 의존성 함수
def get_db():
    """
    FastAPI 의존성 주입용 함수
    각 요청마다 새로운 DB 세션을 생성하고 자동으로 닫음
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()