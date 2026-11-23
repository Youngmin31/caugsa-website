/**
 * utils/auth.js
 * =============
 * 로그인/권한 상태를 브라우저 저장소에서 읽는 헬퍼.
 *
 * 로그인 시 access_token, user_role, user_role_detail 을 저장해 두고 여기서 읽는다.
 * 화면 노출을 거르는 용도일 뿐이고, 실제 권한은 서버가 JWT 로 다시 검사한다.
 * (백엔드 helpers.py 의 @admin_required)
 */

const read = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);

export const isLoggedIn = () => Boolean(read("access_token"));

export const isAdminUser = () => read("user_role") === "admin";

/**
 * ADMIN / MANAGER 세부 구분. 명세 호환 때문에 user_role 은 "admin"/"user" 로만
 * 저장되므로, 로그인 응답의 roleDetail(ADMIN/MANAGER/USER 원본값)을 따로 둔다.
 * 매니저는 게시판 글 작성 + 캘린더 수정만 할 수 있어, 그 밖의 관리자 화면
 * (섹션 이미지, 고정 콘텐츠, 권한 관리)을 가리는 데 쓴다.
 */
export const isAdminOnlyUser = () => read("user_role_detail") === "ADMIN";
export const isManagerUser = () => read("user_role_detail") === "MANAGER";

/**
 * 다른 탭에서 로그인/로그아웃하면 이 탭에도 반영되도록 storage 이벤트를 듣는다.
 * useEffect 안에서 호출하고 반환된 정리 함수를 그대로 돌려주면 된다.
 */
export const watchAuthChange = (handler) => {
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
};
