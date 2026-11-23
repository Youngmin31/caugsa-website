/**
 * Pagination
 * ==========
 * « ‹ 1 2 3 4 5 › »  — 현재 페이지는 네이비 원.
 * 페이지가 많아도 한 번에 최대 5개 블록만 보여준다.
 */

import React from "react";
import styled from "styled-components";

import { colors, font, media, radius, clampW, clampH } from "../../styles/theme";

const BLOCK_SIZE = 5;

const Nav = styled.nav`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${clampW(4)};
    margin-top: ${clampH(46)};
`;

/** 화살표 묶음과 숫자 사이를 조금 띄운다 */
const Gap = styled.span`
    width: ${clampW(8)};
    flex: 0 0 auto;
`;

const Button = styled.button`
    /* reset.js 가 button 에 width: 100% 를 걸어 두어, 그냥 두면 버튼이
       줄 전체를 나눠 갖고 동그라미가 납작한 타원이 된다. */
    width: auto;
    flex: 0 0 auto;
    /* width 기준(vw) 으로만 늘고 줄어야 동그란 모양이 안 찌그러진다 */
    min-width: ${clampW(36, 0.15)};
    height: ${clampW(36, 0.15)};
    /* 세 자리 이상이어도 글자가 잘리지 않도록 알약 모양으로 늘어난다 */
    padding: 0 ${clampW(11)};
    border: none;
    border-radius: ${radius.pill};
    background: ${(props) => (props.$active ? colors.navy : "transparent")};
    color: ${(props) => {
        if (props.$active) return colors.onNavy;
        return props.disabled ? "#C2C7D6" : colors.textMuted;
    }};
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${(props) => (props.$active ? font.weight.bold : font.weight.medium)};
    font-variant-numeric: tabular-nums;
    line-height: 1;
    cursor: ${(props) => (props.disabled ? "default" : "pointer")};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: ${(props) => (props.$active ? "0 3px 10px rgba(18, 24, 80, 0.28)" : "none")};
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &:hover:not(:disabled) {
        background: ${(props) => (props.$active ? colors.navy : "rgba(18, 24, 80, 0.07)")};
        color: ${(props) => (props.$active ? colors.onNavy : colors.navy)};
    }

    &:focus-visible {
        outline: 2px solid ${colors.navy};
        outline-offset: 2px;
    }

    ${media.mobile} {
        min-width: ${clampW(32, 0.15)};
        height: ${clampW(32, 0.15)};
        padding: 0 ${clampW(8)};
        font-size: ${font.size.sm};
    }
`;

/** 화살표는 숫자보다 한 톤 옅게 */
const ArrowButton = styled(Button)`
    font-size: ${font.size.md};
    color: ${(props) => (props.disabled ? "#D3D7E2" : colors.textLight)};
`;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (!totalPages || totalPages < 1) return null;

    const blockIndex = Math.floor((currentPage - 1) / BLOCK_SIZE);
    const start = blockIndex * BLOCK_SIZE + 1;
    const end = Math.min(start + BLOCK_SIZE - 1, totalPages);
    const pages = [];
    for (let page = start; page <= end; page += 1) pages.push(page);

    const go = (page) => {
        if (page < 1 || page > totalPages || page === currentPage) return;
        onPageChange(page);
    };

    return (
        <Nav aria-label="페이지 이동">
            <ArrowButton
                type="button"
                onClick={() => go(1)}
                disabled={currentPage === 1}
                aria-label="첫 페이지"
            >
                «
            </ArrowButton>
            <ArrowButton
                type="button"
                onClick={() => go(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
            >
                ‹
            </ArrowButton>
            <Gap aria-hidden="true" />
            {pages.map((page) => (
                <Button
                    key={page}
                    type="button"
                    $active={page === currentPage}
                    onClick={() => go(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                >
                    {page}
                </Button>
            ))}
            <Gap aria-hidden="true" />
            <ArrowButton
                type="button"
                onClick={() => go(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
            >
                ›
            </ArrowButton>
            <ArrowButton
                type="button"
                onClick={() => go(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="마지막 페이지"
            >
                »
            </ArrowButton>
        </Nav>
    );
};

export default Pagination;
