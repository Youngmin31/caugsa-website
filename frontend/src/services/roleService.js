/**
 * services/roleService.js
 * ========================
 * 매니저 권한 부여 화면용. ADMIN 전용 엔드포인트를 호출한다 (서버도 @admin_only
 * 로 다시 검사한다).
 *
 *   GET /api/admin/users?query=        로그인ID/이름으로 사용자 검색
 *   GET /api/admin/users?role=MANAGER  현재 매니저 전체 목록
 *   PUT /api/admin/users/<id>/role     USER <-> MANAGER 역할 변경
 */

import { useAuthApi } from "../hooks/api/axiosInterceptor";

/** 로그인ID 또는 이름으로 사용자를 찾는다. */
export const searchUsers = async (query) => {
    const { data } = await useAuthApi.get("/admin/users", { params: { query } });
    return data.data || [];
};

/** 현재 MANAGER 역할인 사용자 전체 목록. */
export const listManagers = async () => {
    const { data } = await useAuthApi.get("/admin/users", { params: { role: "MANAGER" } });
    return data.data || [];
};

/** role 은 "USER" 또는 "MANAGER" 만 받는다 (ADMIN 계정은 서버가 거절한다). */
export const updateUserRole = async (id, role) => {
    const { data } = await useAuthApi.put(`/admin/users/${id}/role`, { role });
    return data;
};
