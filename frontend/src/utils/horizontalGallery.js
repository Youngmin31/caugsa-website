/**
 * utils/horizontalGallery.js
 * ===========================
 * 공약 이행 보고(gallery 뷰) 게시판의 "가로형으로 보기" 옵션.
 *
 * 카드뉴스(인스타그램 3분할 게시글) 표지 3장을 간격 없이 이어 붙여
 * 하나의 긴 가로 이미지처럼 보여주기 위한 표시다. DB 스키마나 백엔드는
 * 건드리지 않고, 본문(content) 끝에 눈에 보이지 않는 HTML 주석을 붙이는
 * 것으로 대신한다.
 *
 * 왜 마커 방식인가 (첨부 이미지 개수 자동 판별 대신)
 * ---------------------------------------------------
 * "첨부 이미지가 정확히 3장이면 자동으로 가로형"으로 판별하면, 과거에
 * 우연히 이미지 3장을 올린 글까지 의도치 않게 가로형으로 바뀐다. 마커는
 * 지금까지 어떤 글의 본문에도 존재한 적 없는 새 문자열이라 기존 글은
 * 전혀 영향을 받지 않는다.
 *
 * 왜 HTML 주석인가
 * -----------------
 * 브라우저가 주석을 화면에 그리지 않으므로 "화면에서 숨기는" 처리가
 * 따로 필요 없다. 그리고 이 마커는 RichTextEditor(contentEditable) 안에는
 * 절대 넣지 않는다 — 저장 직전에 문자열로만 덧붙이고, 수정 화면에서 글을
 * 불러올 때 편집기에 넣기 전에 떼어낸다. 편집 가능한 영역 밖에서만
 * 다루므로, 브라우저가 편집 중에 주석 노드를 지워버릴 걱정이 없다.
 */

export const HORIZONTAL_MARKER = "<!--horizontal-gallery-->";

/** 본문에 가로형 마커가 있는지. */
export const hasHorizontalMarker = (content) =>
    typeof content === "string" && content.includes(HORIZONTAL_MARKER);

/** 저장 직전: 체크돼 있으면 마커를 붙인다(중복 방지 후 덧붙임). */
export const appendHorizontalMarker = (content, checked) => {
    const base = (content || "").split(HORIZONTAL_MARKER).join("");
    return checked ? base + HORIZONTAL_MARKER : base;
};

/** 불러오기/렌더링 직전: 마커를 항상 떼어낸다. */
export const stripHorizontalMarker = (content) =>
    typeof content === "string" ? content.split(HORIZONTAL_MARKER).join("") : content;
