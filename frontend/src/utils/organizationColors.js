/**
 * utils/organizationColors.js
 * ===========================
 * 캘린더에서 행사를 주관 기관(Event.organization_id)별로 다른 색으로 칠한다.
 *
 * 기관 id 는 Organization 테이블의 PK 이고 마이그레이션이 DEFINE.ORGANIZATIONS
 * 순서대로 넣으므로 1~13 이 고정이다. 그래도 id 가 늘거나 바뀔 수 있어
 * 표에 없는 id 는 id 를 해시해 팔레트에서 고르는 방식으로 처리한다.
 *
 * 색은 일정 이름 위에 검은 글씨가 올라가므로 전부 밝은 톤으로 맞췄다.
 */

// 기관 id -> 배경색 (밝은 파스텔)
const ORGANIZATION_COLORS = {
    1: "#D6E4FF", // 총학생회
    2: "#D9F2E6", // 중앙집행위원회
    3: "#FFE8CC", // 교육자치국
    4: "#F3E1FF", // 연대사업국
    5: "#FFE0E6", // 일상사업국
    6: "#D8F3F8", // 전략정책국
    7: "#FFF3C4", // 홍보소통국
    8: "#E2E8D5", // 회계사무국
    9: "#FFDCE5", // 문화위원회
    10: "#E0E7FF", // 졸업준비위원회
    11: "#CFF2EC", // 학생복지위원회
    12: "#FFE4D0", // 학생인권위원회
    13: "#EDE0FF", // 동아리연합회
};

// 표에 없는 기관 id 에 쓸 예비 팔레트
const FALLBACK_PALETTE = Object.values(ORGANIZATION_COLORS);

/** 기관 정보가 아예 없는 일정(레거시 캘린더 이관분 등)의 기본색 */
export const DEFAULT_EVENT_COLOR = "#E8F0FE";

export const getOrganizationColor = (organizationId) => {
    if (organizationId === null || organizationId === undefined) {
        return DEFAULT_EVENT_COLOR;
    }
    if (ORGANIZATION_COLORS[organizationId]) {
        return ORGANIZATION_COLORS[organizationId];
    }
    const index = Math.abs(Number(organizationId) || 0) % FALLBACK_PALETTE.length;
    return FALLBACK_PALETTE[index];
};

/**
 * 캘린더 아래에 띄울 범례용 목록.
 * 실제로 일정이 있는 기관만 보여주려고 events 를 받아서 추린다.
 */
export const legendFromEvents = (events) => {
    const seen = new Map();
    events.forEach((event) => {
        if (!event.organization) return;
        if (!seen.has(event.organization)) {
            seen.set(event.organization, getOrganizationColor(event.organizationId));
        }
    });
    return Array.from(seen, ([name, color]) => ({ name, color }));
};
