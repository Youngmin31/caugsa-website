/**
 * BoardSearch
 * ===========
 * 게시판 검색창. 시안의 알약(pill) 형태.
 *
 * 제목/내용/작성자를 가리지 않고 통째로 검색하는 단일 입력이다.
 */

import React, { useState } from "react";
import styled from "styled-components";

import { colors, font, media, radius, shadow, clampW, clampH } from "../../styles/theme";

const Form = styled.form`
    display: flex;
    align-items: center;
    gap: ${clampW(10)};
    width: ${clampW(310)};
    max-width: 100%;
    /* 예전에는 안쪽 input/select 가 전역 height: 40px 를 받아 알약 높이가
       정해졌다. 그 규칙을 없앴으므로 여기서 직접 잡는다. */
    min-height: ${clampH(58)};
    padding: ${clampH(9)} ${clampW(16)} ${clampH(9)} ${clampW(18)};
    background: ${colors.white};
    border: 1px solid ${colors.border};
    border-radius: ${radius.pill};
    box-shadow: ${shadow.card};

    ${media.mobile} {
        width: 100%;
    }
`;

const Input = styled.input`
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};

    &::placeholder {
        color: ${colors.textLight};
    }
`;

const SubmitButton = styled.button`
    /* flex 아이템이 된 <button> 은 폭이 늘어나 입력창을 밀어내므로 폭을 고정한다 */
    flex: 0 0 auto;
    width: fit-content;
    border: none;
    background: none;
    cursor: pointer;
    color: ${colors.navy};
    display: inline-flex;
    padding: 0;
`;

const SearchIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.6" stroke="currentColor" strokeWidth="1.9" />
        <path d="M16 16l4.2 4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
);

const BoardSearch = ({ onSearch, placeholder }) => {
    const [term, setTerm] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        onSearch(term.trim());
    };

    return (
        <Form onSubmit={handleSubmit} role="search">
            <Input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={placeholder || "검색어를 입력하세요."}
                aria-label="검색어"
            />
            <SubmitButton type="submit" aria-label="검색">
                <SearchIcon />
            </SubmitButton>
        </Form>
    );
};

export default BoardSearch;
