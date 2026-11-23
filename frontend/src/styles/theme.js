/**
 * styles/theme.js
 * ===============
 * Figma 시안(figma 화면/)에서 뽑은 디자인 토큰.
 * 색상·간격·타이포를 여기 한 곳에서 관리한다.
 */

export const colors = {
    // 브랜드 네이비 (상단바 / 푸터 / 강조)
    navy: "#121850",
    navyDeep: "#101838",
    navySoft: "#25306B",
    navyHover: "#1E2A64",

    // 포인트
    red: "#E8352A", // 로고의 빨간 사각형
    blue: "#3D5AF1",

    // 배경
    pageBg: "#F5F7FC", // 본문 영역 연한 블루그레이
    panel: "#F4F7FC",  // 카드 / 섹션 패널. 배경과 거의 같고 그림자로만 떠 보인다
    rule: "#000000",   // 섹션 제목 아래 구분선 (시안은 검정 2px)
    footerNavy: "#050A3A", // 푸터는 상단바보다 어두운 네이비
    white: "#FFFFFF",
    cardBg: "#FFFFFF",
    tableHeadBg: "#F3F4F8",
    accordionBg: "#EEF0F6",
    navBg: "#EFF2F9", // 네비게이션 바 (아주 옅은 그라데이션 느낌)

    // 텍스트
    text: "#1B1F2A",
    textStrong: "#151F52",
    textMuted: "#6B7280",
    textLight: "#9AA1AE",
    onNavy: "#FFFFFF",

    // 선
    border: "#E2E5EC",
    borderStrong: "#151F52",
    divider: "#E8EAF0",
};

/**
 * px -> vw/vh 변환.
 * ==========================
 * 시안(figma 화면/) 은 1920x1080 캔버스 기준이다. 그 캔버스에서 잰 px 값을
 * 같은 비율의 뷰포트 단위(vw/vh)로 바꿔 주면, 창 크기가 달라져도 시안과
 * 같은 비율로 커지고 작아진다.
 *
 * clampW/clampH 는 값 하나만 넘기면 "원래 px 의 80%~120% 사이에서
 * 뷰포트 크기에 비례해 움직이는" clamp() 문자열을 만들어 준다.
 * (양 끝을 막아 두어 창이 아주 작거나 아주 커도 글자/여백이 깨지지 않는다)
 *
 *   width: ${clampW(120)};   // 가로 관련 값 (너비, 좌우 여백, 폰트 크기 등)
 *   height: ${clampH(80)};   // 세로 관련 값 (높이, 상하 여백 등)
 */
const VW_BASE = 1920;
const VH_BASE = 1080;

export const vw = (px) => `${+((px / VW_BASE) * 100).toFixed(3)}vw`;
export const vh = (px) => `${+((px / VH_BASE) * 100).toFixed(3)}vh`;

/** px 가 음수여도(마이너스 마진 등) clamp() 순서가 안 깨지도록 두 경계 중 작은/큰 쪽을 고른다. */
const bounds = (px, spread) => {
    const a = Math.round(px * (1 - spread));
    const b = Math.round(px * (1 + spread));
    return [Math.min(a, b), Math.max(a, b)];
};

export const clampW = (px, spread = 0.2) => {
    const [lo, hi] = bounds(px, spread);
    return `clamp(${lo}px, ${vw(px)}, ${hi}px)`;
};

export const clampH = (px, spread = 0.2) => {
    const [lo, hi] = bounds(px, spread);
    return `clamp(${lo}px, ${vh(px)}, ${hi}px)`;
};

/**
 * 메인 화면 축소 배율.
 *
 * 시안(figma 화면/중대중심 최종)은 1920 캔버스 기준이라 잰 값을 그대로 쓰면
 * 실제 브라우저에서 크게 느껴진다. 시안에서 잰 px 에 이 비율을 곱해
 * 메인 화면 전체를 한 번에 줄인다. 1 로 두면 시안 그대로가 된다.
 *
 * 여기 숫자 하나만 바꾸면 메인의 여백 / 글자 / 카드가 같은 비율로 따라 움직인다.
 */
export const HOME_SCALE = 0.8;

/**
 * 시안 px -> 뷰포트 폭에 비례해 움직이는 clamp() 문자열.
 * 예: homePx(98) -> "clamp(63px, 4.083vw, 94px)" (98 * 0.8 을 vw 로 환산)
 * 메인 화면 전체가 이 함수로 치수를 잡으므로, 창 크기가 바뀌면 시안과 같은
 * 비율로 같이 커지고 작아진다.
 */
export const homePx = (figmaPx) => clampW(figmaPx * HOME_SCALE);

export const layout = {
    maxWidth: clampW(1200),   // 본문 컨테이너
    sidebarWidth: clampW(210),
    gutter: clampW(56),
    homeWidth: clampW(1440),    // 메인 화면 컨테이너 (시안 1920 기준 좌우 240 여백)
    homeInner: clampW(1245),    // 패널 안쪽 콘텐츠 폭
    heroHeight: clampH(390),
    heroHeightMobile: clampH(180),
    topBarHeight: clampH(43),
    navHeight: clampH(80),
};

export const radius = {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    pill: "999px",
};

export const shadow = {
    card: "0 2px 10px rgba(21, 31, 82, 0.06)",
    cardHover: "0 6px 20px rgba(21, 31, 82, 0.12)",
    sidebar: "0 2px 8px rgba(21, 31, 82, 0.08)",
};

export const font = {
    // 시안은 Pretendard 계열. 없으면 시스템 한글 폰트로 대체된다.
    family: `'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont,
             'Malgun Gothic', '맑은 고딕', sans-serif`,
    // 글자 크기는 창 폭에 비례하되(vw), 너무 작아지거나 커지지 않게 좁은 범위로 묶어 둔다.
    size: {
        xs: clampW(12, 0.15),
        sm: clampW(13, 0.15),
        base: clampW(14, 0.15),
        md: clampW(15, 0.15),
        lg: clampW(17, 0.15),
        xl: clampW(20, 0.15),
        h3: clampW(22, 0.15),
        h2: clampW(26, 0.15),
        h1: clampW(34, 0.15),
    },
    weight: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },
};

export const breakpoints = {
    mobile: "768px",
    tablet: "1024px",
    desktop: "1280px",
};

export const media = {
    mobile: `@media all and (max-width: ${breakpoints.mobile})`,
    tablet: `@media all and (max-width: ${breakpoints.tablet})`,
    desktop: `@media all and (max-width: ${breakpoints.desktop})`,
};

const theme = { colors, layout, radius, shadow, font, breakpoints, media };
export default theme;
