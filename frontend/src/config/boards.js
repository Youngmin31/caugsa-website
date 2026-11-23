/**
 * config/boards.js
 * ================
 * 신규 사이트의 메뉴 4개 / 하위 페이지 구조. (figma 화면/ 시안 기준)
 *
 * slug 는 DB 의 `Board.slug` 와 반드시 일치해야 한다. API 는 이 slug 로 게시판을
 * 지정한다. (예: GET /api/posts?board=minutes)
 *
 * type
 *   'board' : 게시글 목록/상세가 있는 게시판
 *   'page'  : 정적 페이지 (게시글 없음)
 *
 * view (type === 'board' 일 때 목록 표현 방식)
 *   'table'     : 번호/제목/등록일/첨부파일/조회수 표     (회의록, 회칙 및 세칙, 회계 자료, 대관)
 *   'card'      : 포스터 썸네일 3열 카드 그리드           (참여 행사, 제휴)
 *   'gallery'   : 가로로 긴 이미지 1열                    (공약 이행 보고)
 *   'accordion' : 질문 클릭 시 답변이 펼쳐지는 목록        (FAQ)
 */

export const MENUS = [
    {
        key: "introduction",
        title: "총학생회 소개",
        boards: [
            { slug: "greeting", name: "총학생회 회장단 인사말", type: "page" },
            { slug: "organization", name: "조직 및 업무", type: "page" },
            { slug: "location", name: "오시는 길", type: "page" },
        ],
    },
    {
        key: "board",
        title: "총학생회 게시판",
        boards: [
            { slug: "projects", name: "참여 행사", type: "board", view: "card", isEvent: true },
            { slug: "pledges", name: "공약 이행 보고", type: "board", view: "gallery", hideSearch: true },
        ],
    },
    {
        key: "autonomy",
        title: "학생자치",
        boards: [
            // 회의록/자치활동보고/회계자료는 목록만 공개, 글 상세는 로그인해야 볼 수 있다.
            // 회칙 및 세칙은 비회원도 글 상세까지 열람할 수 있다.
            // 서버도 같은 슬러그를 따로 검사한다 (api_v2/routes/posts.py 의
            // LOGIN_REQUIRED_BOARD_SLUGS) — 여기서 빼면 화면만 막히고 API 는 열려 있게 되니
            // 둘 다 같이 고쳐야 한다.
            { slug: "minutes", name: "회의록", type: "board", view: "table", requiresLogin: true },
            { slug: "activity-report", name: "자치활동보고", type: "board", view: "table", requiresLogin: true },
            // 회칙 및 세칙은 DB 상 3개 게시판이지만 화면은 한 페이지 안의 탭이다.
            // tabs[].slug 가 실제 API 의 board 파라미터로 쓰인다.
            {
                slug: "rules",
                name: "회칙 및 세칙",
                type: "board",
                view: "table",
                tabs: [
                    { slug: "rules-council", name: "총학생회" },
                    { slug: "rules-club-union", name: "동아리연합회" },
                    { slug: "rules-college", name: "단과대학" },
                ],
            },
            { slug: "accounting", name: "회계 자료", type: "board", view: "table", requiresLogin: true },
        ],
    },
    {
        key: "info",
        title: "정보 마당",
        boards: [
            { slug: "affiliate", name: "제휴", type: "board", view: "card" },
            { slug: "venue", name: "대관", type: "board", view: "table" },
            // 시안상 안내 페이지지만, 레거시 사물함 신청/철거 글 338건이
            // 이 게시판에 이관돼 있어 /info/rental/list 로 목록을 볼 수 있게 한다.
            { slug: "rental", name: "대여", type: "page", hasArchive: true, view: "table", hideSearch: true },
            { slug: "faq", name: "FAQ", type: "board", view: "accordion", hideSearch: true },
        ],
    },
];

/** 게시판 경로: /autonomy/minutes */
export const boardPath = (menuKey, slug) => `/${menuKey}/${slug}`;

/** 메뉴의 첫 항목 경로 (메뉴 클릭 시 이동할 기본 위치) */
export const menuDefaultPath = (menu) => boardPath(menu.key, menu.boards[0].slug);

/** key 로 메뉴 찾기 */
export const findMenu = (menuKey) => MENUS.find((menu) => menu.key === menuKey) || null;

/**
 * slug 로 게시판 찾기 (메뉴 정보까지 함께 반환)
 *
 * 탭 게시판(회칙 및 세칙)은 DB 상 독립 게시판이라 상세 페이지 URL 에
 * 탭 slug 가 그대로 실린다(/autonomy/rules-council/123). 그래서 탭 slug 로도
 * 찾을 수 있어야 하고, 이때는 부모 페이지 정보를 함께 얹어 돌려준다.
 */
export const findBoard = (slug) => {
    for (const menu of MENUS) {
        for (const board of menu.boards) {
            if (board.slug === slug) {
                return {
                    ...board,
                    menuKey: menu.key,
                    menuTitle: menu.title,
                    path: boardPath(menu.key, slug),
                };
            }
            const tab = (board.tabs || []).find((item) => item.slug === slug);
            if (tab) {
                return {
                    ...board,
                    slug: tab.slug,
                    name: `${board.name} - ${tab.name}`,
                    tabName: tab.name,
                    parentSlug: board.slug,
                    menuKey: menu.key,
                    menuTitle: menu.title,
                    // 목록으로 돌아갈 때는 부모 페이지로 보낸다
                    path: boardPath(menu.key, board.slug),
                };
            }
        }
    }
    return null;
};

/** 게시글 목록/상세가 있는 게시판만 */
export const listBoards = () =>
    MENUS.flatMap((menu) =>
        menu.boards
            .filter((board) => board.type === "board")
            .map((board) => ({ ...board, menuKey: menu.key, path: boardPath(menu.key, board.slug) }))
    );

/**
 * 구 URL -> 신 URL.
 * 기존에 공유된 링크나 북마크가 깨지지 않도록 라우터에서 리다이렉트에 쓴다.
 */
export const LEGACY_PATH_MAP = {
    // 총학생회 소식 -> 참여 행사
    "/news/student-council": "/board/projects",
    "/news/culture-committee": "/board/projects",
    "/news/welfare-committee": "/board/projects",
    "/news/human-rights-committee": "/board/projects",
    "/news/graduation-committee": "/board/projects",
    "/news/club-union": "/board/projects",
    "/news/edu-council": "/board/projects",
    "/news/unity-council": "/board/projects",
    "/news/life-council": "/board/projects",
    "/news/strategy-council": "/board/projects",
    "/news/promo-council": "/board/projects",
    "/news/accounting": "/autonomy/accounting",
    // 학생 자치
    "/student-autonomy/activity": "/autonomy/activity-report",
    "/student-autonomy/central-committee": "/autonomy/minutes",
    "/student-autonomy/council-rules": "/autonomy/rules",
    "/student-autonomy/department-rules": "/autonomy/rules",
    "/student-autonomy/space-adjustment": "/info/venue",
    // 편의 정보 -> 정보 마당
    "/convenience-info/affiliate": "/info/affiliate",
    "/convenience-info/resident-business": "/info/rental",
    "/convenience-info/space-adjustment": "/info/venue",
    // 소개
    "/introduction/executive": "/introduction/organization",
    "/introduction/committees": "/introduction/organization",
    "/introduction/orgchart": "/introduction/organization",
};

export default MENUS;
