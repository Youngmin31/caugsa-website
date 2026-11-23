import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

// Layouts
import SubLayout from "./layouts/SubLayout";

// 신규 메뉴/게시판 구조
import { MENUS, LEGACY_PATH_MAP, menuDefaultPath } from "./config/boards";

// Pages
import Home from "./pages/01_home";
import Policy from "./pages/00_footer/policy";
import Privacy from "./pages/00_footer/privacy";
import Login from "./pages/00_intro/login";
import Signup from "./pages/00_intro/signup";
import IdSearch from "./pages/00_intro/id_search";
import PwSearch from "./pages/00_intro/pw_search";
// 기존 회원 계정 활성화 — 한시적. 끝나면 이 import 와 아래 Route 한 줄만 지운다.
import Reactivate from "./pages/00_intro/reactivate";

// 총학생회 소개 (정적 페이지)
import PresidentGreeting from "./pages/02_introduction/president_greeting";
import OrganizationChart from "./pages/02_introduction/organization_chart";
import Location from "./pages/02_introduction/location";

// 정보 마당 > 대여 (안내 페이지)
import RentalPage from "./pages/info/RentalPage";

// 게시판 공용 페이지 (게시판마다 파일을 두지 않는다)
import BoardListPage from "./pages/board/BoardListPage";
import BoardDetailPage from "./pages/board/BoardDetailPage";
import BoardFormPage from "./pages/board/BoardFormPage";

// 연간 일정
import CalendarNews from "./pages/03_news/calendar";

// 내 정보
import ModifyPersonalInfo from "./pages/08_mypage/modify_personal_info";

// 관리자
import AdminDashboard from "./pages/09_admin/dashboard";
import AdminManageContent from "./pages/09_admin/manage_content";
import ManageRoles from "./pages/09_admin/manage_roles";
import ModifySchedule from "./pages/09_admin/modify_schedule";

// type: 'page' 인 항목의 slug -> 컴포넌트 매핑
const STATIC_PAGES = {
    greeting: <PresidentGreeting />,
    organization: <OrganizationChart />,
    location: <Location />,
    rental: <RentalPage />,
};

/**
 * 메뉴 4개를 config 로부터 라우트로 펼친다.
 * 게시판이 늘어나도 config/boards.js 만 고치면 된다.
 */
const menuRoutes = MENUS.map((menu) => (
    <Route key={menu.key} path={`/${menu.key}`}>
        <Route index element={<Navigate replace to={menuDefaultPath(menu)} />} />
        {menu.boards.map((board) =>
            board.type === "page" ? (
                <React.Fragment key={board.slug}>
                    <Route
                        path={board.slug}
                        element={STATIC_PAGES[board.slug] || <Navigate replace to="/home" />}
                    />
                    {/* 안내 페이지지만 이관된 게시글이 있는 경우 (예: 대여) */}
                    {board.hasArchive && (
                        <Route path={`${board.slug}/list`} element={<BoardListPage slug={board.slug} />} />
                    )}
                </React.Fragment>
            ) : (
                // 경로가 리터럴(":board" 파라미터가 아님)이라 slug 를 직접 넘긴다
                <Route key={board.slug} path={board.slug} element={<BoardListPage slug={board.slug} />} />
            )
        )}
        {/* 게시판 공통 하위 경로 */}
        <Route path=":board/detail/:id" element={<BoardDetailPage />} />
        <Route path=":board/write" element={<BoardFormPage mode="create" />} />
        <Route path=":board/edit/:id" element={<BoardFormPage mode="edit" />} />
    </Route>
));

/** 기존에 공유된 링크가 깨지지 않도록 구 URL 을 새 URL 로 보낸다. */
const legacyRedirects = Object.entries(LEGACY_PATH_MAP).map(([from, to]) => (
    <Route key={from} path={from} element={<Navigate replace to={to} />} />
));

/**
 * 링크로 페이지를 옮기면 브라우저는 스크롤 위치를 그대로 둔다.
 * 헤더가 fixed 라 아래쪽에서 이동하면 새 페이지가 헤더에 붙은 채로 시작한다.
 * 경로가 바뀔 때마다 맨 위로 올려 준다. (해시 링크는 건드리지 않는다)
 */
const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    React.useEffect(() => {
        if (hash) return;
        window.scrollTo(0, 0);
    }, [pathname, hash]);

    return null;
};

const Router = () => {
    return (
        <BrowserRouter>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Navigate replace to="/home" />} />
                <Route path="/home" element={<Home />} />

                {/* navbar + banner + submenus + contents + footer 구조 */}
                <Route element={<SubLayout />}>
                    {menuRoutes}
                    {legacyRedirects}

                    {/* 구 게시판 상세/작성 링크도 진행사업으로 보낸다 */}
                    <Route path="/news/*" element={<Navigate replace to="/board/projects" />} />
                    <Route path="/student-autonomy/*" element={<Navigate replace to="/autonomy/minutes" />} />
                    <Route path="/convenience-info/*" element={<Navigate replace to="/info/affiliate" />} />

                    {/* 연간 일정 */}
                    <Route path="/calendar" element={<CalendarNews />} />

                    <Route path="/mypage">
                        <Route index element={<Navigate replace to="/mypage/edit" />} />
                        <Route path="edit" element={<ModifyPersonalInfo />} />
                    </Route>

                    <Route path="/admin">
                        {/* 관리자 홈. 예전에는 회원 승인으로 바로 넘겼다. */}
                        <Route index element={<AdminDashboard />} />
                        {/* 게시글 관리와 섹션 이미지 관리를 하나로 합쳤다.
                            예전 주소로 들어와도 새 화면으로 보낸다. */}
                        <Route path="content" element={<AdminManageContent />} />
                        <Route path="posts" element={<Navigate replace to="/admin/content" />} />
                        <Route
                            path="section-images"
                            element={<Navigate replace to="/admin/content" />}
                        />
                        <Route path="modify-schedule" element={<ModifySchedule />} />
                        <Route path="roles" element={<ManageRoles />} />
                    </Route>

                    <Route path="/rules">
                        <Route path="policy" element={<Policy />} />
                        <Route path="privacy" element={<Privacy />} />
                    </Route>

                    <Route path="/intro">
                        <Route path="login" element={<Login />} />
                        <Route path="login/id-search" element={<IdSearch />} />
                        <Route path="login/pw-search" element={<PwSearch />} />
                        {/* 예비 이메일로 찾기 기능 제거. 옛 링크는 일반 비밀번호 찾기로 보낸다. */}
                        <Route
                            path="login/pw-search-by-email"
                            element={<Navigate replace to="/intro/login/pw-search" />}
                        />
                        <Route path="signup" element={<Signup />} />
                        <Route path="reactivate" element={<Reactivate />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate replace to="/home" />} />
            </Routes>
        </BrowserRouter>
    );
};

export default Router;
