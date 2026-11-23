/**
 * services/holidayService.js
 * ===========================
 * 캘린더 날짜 숫자를 빨간색으로 칠할 공휴일 목록.
 *
 *   GET    /api/holidays             공개 조회
 *   POST   /api/admin/holidays       추가 (ADMIN/MANAGER)
 *   DELETE /api/admin/holidays/<date> 삭제 (ADMIN/MANAGER)
 */

import useApi, { useAuthApi } from "../hooks/api/axiosInterceptor";

/** [{date: "YYYY-MM-DD", name}] 목록. */
export const listHolidays = async () => {
    const { data } = await useApi.get("/holidays");
    return data.data || [];
};

export const addHoliday = async (date, name) => {
    const { data } = await useAuthApi.post("/admin/holidays", { date, name });
    return data.data || [];
};

export const deleteHoliday = async (date) => {
    const { data } = await useAuthApi.delete(`/admin/holidays/${date}`);
    return data.data || [];
};
