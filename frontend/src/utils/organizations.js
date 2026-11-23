/**
 * utils/organizations.js
 * ======================
 * 캘린더 일정의 주관 구분.
 *
 * 화면에는 "총학생회 / 학사일정" 두 갈래로만 보여 준다.
 * 반면 DB 에는 나중에 기관별로 따로 뽑아 볼 수 있도록 organization_id 를
 * 그대로 남긴다 (총학생회 산하 13개 기관 + 학사일정 = 14가지).
 *
 * 기관 id 는 Organization 테이블의 PK 이고 마이그레이션이 순서대로 넣으므로
 * 1~13 이 고정이다 (utils/organizationColors.js 와 같은 기준).
 * 학사일정은 Organization 에 대응하는 행이 없어 organization_id 를 비워 둔다.
 */

/** 총학생회 산하 기관 (Organization.id 1~13) */
export const ORGANIZATIONS = [
    { id: 1, name: "총학생회" },
    { id: 2, name: "중앙집행위원회" },
    { id: 3, name: "교육자치국" },
    { id: 4, name: "연대사업국" },
    { id: 5, name: "일상사업국" },
    { id: 6, name: "전략정책국" },
    { id: 7, name: "홍보소통국" },
    { id: 8, name: "회계사무국" },
    { id: 9, name: "문화위원회" },
    { id: 10, name: "졸업준비위원회" },
    { id: 11, name: "학생복지위원회" },
    { id: 12, name: "학생인권위원회" },
    { id: 13, name: "동아리연합회" },
];

export const ACADEMIC_LABEL = "학사일정";
export const COUNCIL_LABEL = "총학생회";

/**
 * 관리자 입력용 선택지 14개.
 * value 는 <select> 가 문자열만 다루므로 문자열이고, 학사일정은 빈 문자열이다.
 * (빈 문자열 -> organization_id = null 로 저장된다)
 */
export const ORGANIZATION_OPTIONS = [
    { value: "", label: ACADEMIC_LABEL },
    ...ORGANIZATIONS.map((org) => ({ value: String(org.id), label: org.name })),
];

/** 화면에 보여 줄 두 갈래 구분. 기관이 지정돼 있으면 전부 총학생회로 묶는다. */
export const categoryOf = (organizationId) =>
    organizationId === null || organizationId === undefined ? ACADEMIC_LABEL : COUNCIL_LABEL;

/**
 * 구분별 색. 시안 기준으로 학사일정은 네이비, 총학생회는 주황이다.
 * 점과 세로 막대처럼 얇은 요소에 쓰므로 진한 색을 쓴다.
 * (utils/organizationColors.js 의 파스텔은 글자 뒤 배경용이라 여기 쓰면 안 보인다)
 */
export const CATEGORY_COLORS = {
    [ACADEMIC_LABEL]: "#121850",
    [COUNCIL_LABEL]: "#F26B3A",
};

export const categoryColor = (organizationId) => CATEGORY_COLORS[categoryOf(organizationId)];

/** id -> 기관 이름 (없으면 학사일정) */
export const organizationName = (organizationId) => {
    if (organizationId === null || organizationId === undefined) return ACADEMIC_LABEL;
    const found = ORGANIZATIONS.find((org) => org.id === Number(organizationId));
    return found ? found.name : `기관 ${organizationId}`;
};
