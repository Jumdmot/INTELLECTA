from database import engine, SessionLocal, Base
from models import Team, Keyword, AuctionState

def init_database():
    """
    데이터베이스 테이블 생성 및 초기 데이터 입력
    """
    print("🗄️  데이터베이스 테이블 생성 중...")
    Base.metadata.create_all(bind=engine)
    print("✅ 테이블 생성 완료!")
    
    db = SessionLocal()
    
    try:
        # 기존 데이터 확인
        existing_teams = db.query(Team).count()
        if existing_teams > 0:
            print(f"⚠️  이미 {existing_teams}개의 팀이 존재합니다.")
            return
        
        print("\n📝 초기 데이터 생성 중...")
        
        # 10개 팀 생성
        teams = []
        for i in range(1, 11):
            team = Team(
                name=f"팀{i}",
                password=f"team{i}123",  # 간단한 비밀번호
                coins=80,
                keywords_by_category={
                    "물리": 0,
                    "화학": 0,
                    "생명": 0,
                    "수학": 0,
                    "인문": 0
                }
            )
            teams.append(team)
            db.add(team)
        
        # 샘플 키워드 생성
        sample_keywords = [
            # 물리
            {"name": "양자역학", "category": "물리", "min_bid": 15},
            {"name": "상대성이론", "category": "물리", "min_bid": 18},
            {"name": "열역학", "category": "물리", "min_bid": 12},
            {"name": "전자기학", "category": "물리", "min_bid": 14},
            
            # 화학
            {"name": "유기화학", "category": "화학", "min_bid": 13},
            {"name": "무기화학", "category": "화학", "min_bid": 11},
            {"name": "분석화학", "category": "화학", "min_bid": 12},
            {"name": "물리화학", "category": "화학", "min_bid": 16},
            
            # 생명
            {"name": "유전공학", "category": "생명", "min_bid": 17},
            {"name": "세포생물학", "category": "생명", "min_bid": 14},
            {"name": "분자생물학", "category": "생명", "min_bid": 15},
            {"name": "생태학", "category": "생명", "min_bid": 10},
            
            # 수학
            {"name": "미적분학", "category": "수학", "min_bid": 12},
            {"name": "선형대수", "category": "수학", "min_bid": 14},
            {"name": "확률통계", "category": "수학", "min_bid": 13},
            {"name": "정수론", "category": "수학", "min_bid": 16},
            
            # 인문
            {"name": "윤리학", "category": "인문", "min_bid": 10},
            {"name": "사회학", "category": "인문", "min_bid": 11},
            {"name": "철학", "category": "인문", "min_bid": 12},
            {"name": "경제학", "category": "인문", "min_bid": 14},
        ]
        
        for kw_data in sample_keywords:
            keyword = Keyword(**kw_data)
            db.add(keyword)
        
        # 경매 상태 초기화
        auction_state = AuctionState(
            is_active=False,
            current_round=1
        )
        db.add(auction_state)
        
        db.commit()
        
        print(f"✅ {len(teams)}개 팀 생성 완료")
        print(f"✅ {len(sample_keywords)}개 키워드 생성 완료")
        print("✅ 경매 상태 초기화 완료")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()