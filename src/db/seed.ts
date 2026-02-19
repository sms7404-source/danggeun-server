import { db } from './index';
import { regions, categories } from './schema';

async function seed() {
  console.log('Seeding database...');

  // ── 지역 시드 데이터 ──
  const regionData = [
    { name: '다산동', fullName: '경기도 남양주시 다산동' },
    { name: '화도읍', fullName: '경기도 남양주시 화도읍' },
    { name: '진접읍', fullName: '경기도 남양주시 진접읍' },
    { name: '별내동', fullName: '경기도 남양주시 별내동' },
    { name: '호평동', fullName: '경기도 남양주시 호평동' },
    { name: '오남읍', fullName: '경기도 남양주시 오남읍' },
    { name: '퇴계원읍', fullName: '경기도 남양주시 퇴계원읍' },
    { name: '도농동', fullName: '경기도 남양주시 도농동' },
    { name: '금곡동', fullName: '경기도 남양주시 금곡동' },
    { name: '평내동', fullName: '경기도 남양주시 평내동' },
    { name: '가평읍', fullName: '경기도 가평군 가평읍' },
    { name: '설악면', fullName: '경기도 가평군 설악면' },
    { name: '청평면', fullName: '경기도 가평군 청평면' },
    { name: '상면', fullName: '경기도 가평군 상면' },
    { name: '조종면', fullName: '경기도 가평군 조종면' },
    { name: '구리시', fullName: '경기도 구리시' },
    { name: '의정부시', fullName: '경기도 의정부시' },
    { name: '하남시', fullName: '경기도 하남시' },
    { name: '양평군', fullName: '경기도 양평군' },
    { name: '포천시', fullName: '경기도 포천시' },
    { name: '강남구', fullName: '서울특별시 강남구' },
    { name: '서초구', fullName: '서울특별시 서초구' },
    { name: '송파구', fullName: '서울특별시 송파구' },
    { name: '강동구', fullName: '서울특별시 강동구' },
    { name: '마포구', fullName: '서울특별시 마포구' },
    { name: '용산구', fullName: '서울특별시 용산구' },
    { name: '성동구', fullName: '서울특별시 성동구' },
    { name: '광진구', fullName: '서울특별시 광진구' },
    { name: '중랑구', fullName: '서울특별시 중랑구' },
    { name: '노원구', fullName: '서울특별시 노원구' },
    { name: '도봉구', fullName: '서울특별시 도봉구' },
    { name: '강북구', fullName: '서울특별시 강북구' },
    { name: '성북구', fullName: '서울특별시 성북구' },
    { name: '동대문구', fullName: '서울특별시 동대문구' },
    { name: '종로구', fullName: '서울특별시 종로구' },
    { name: '중구', fullName: '서울특별시 중구' },
    { name: '영등포구', fullName: '서울특별시 영등포구' },
    { name: '동작구', fullName: '서울특별시 동작구' },
    { name: '관악구', fullName: '서울특별시 관악구' },
    { name: '금천구', fullName: '서울특별시 금천구' },
    { name: '구로구', fullName: '서울특별시 구로구' },
    { name: '양천구', fullName: '서울특별시 양천구' },
    { name: '강서구', fullName: '서울특별시 강서구' },
    { name: '은평구', fullName: '서울특별시 은평구' },
    { name: '서대문구', fullName: '서울특별시 서대문구' },
    { name: '수원시', fullName: '경기도 수원시' },
    { name: '성남시', fullName: '경기도 성남시' },
    { name: '고양시', fullName: '경기도 고양시' },
    { name: '용인시', fullName: '경기도 용인시' },
    { name: '부천시', fullName: '경기도 부천시' },
  ];

  // ── 카테고리 시드 데이터 ──
  const categoryData = [
    { name: '디지털기기', sortOrder: 1 },
    { name: '생활가전', sortOrder: 2 },
    { name: '가구·인테리어', sortOrder: 3 },
    { name: '생활·주방', sortOrder: 4 },
    { name: '유아동', sortOrder: 5 },
    { name: '유아도서', sortOrder: 6 },
    { name: '여성의류', sortOrder: 7 },
    { name: '남성의류', sortOrder: 8 },
    { name: '스포츠·레저', sortOrder: 9 },
    { name: '여성잡화', sortOrder: 10 },
    { name: '게임·취미', sortOrder: 11 },
    { name: '뷰티·미용', sortOrder: 12 },
    { name: '반려동물용품', sortOrder: 13 },
    { name: '도서·티켓·음반', sortOrder: 14 },
    { name: '식물', sortOrder: 15 },
    { name: '기타 중고물품', sortOrder: 16 },
  ];

  // Insert regions
  await db.insert(regions).values(regionData).onConflictDoNothing();
  console.log(`✓ ${regionData.length}개 지역 시드 완료`);

  // Insert categories
  await db.insert(categories).values(categoryData).onConflictDoNothing();
  console.log(`✓ ${categoryData.length}개 카테고리 시드 완료`);

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
