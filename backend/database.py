import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# DATA_DIR 환경변수로 DB 경로 설정 (Railway 볼륨: /data, 로컬: 현재 디렉토리)
DATA_DIR = os.environ.get("DATA_DIR", ".")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATA_DIR}/auction.db"

# 데이터베이스 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # SQLite용 설정
)

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