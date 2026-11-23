/**
 * services/contentService.js
 * ===========================
 * "대여" 안내처럼 게시판이 아니라 화면에 직접 짜 넣은 고정 페이지의
 * 텍스트/링크를 읽고 쓴다. (섹션 이미지와 짝을 이루는, 텍스트용 API)
 *
 *   GET /api/content/<key>          공개 조회
 *   PUT /api/admin/content/<key>    관리자 저장
 */

import useApi, { useAuthApi } from "../hooks/api/axiosInterceptor";

/** key 의 콘텐츠(panelTitle / blocks / cards)를 가져온다. */
export const fetchContent = async (key) => {
    const { data } = await useApi.get(`/content/${key}`);
    return data.data;
};

/** 관리자가 고친 콘텐츠를 저장한다. 저장된(다듬어진) 값을 그대로 돌려받는다. */
export const updateContent = async (key, content) => {
    const { data } = await useAuthApi.put(`/admin/content/${key}`, content);
    return data.data;
};
