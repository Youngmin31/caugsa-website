/**
 * PasswordField
 * =============
 * 비밀번호 입력칸 + 오른쪽 눈 아이콘.
 *
 * 아이콘을 누르면 input 의 type 을 password <-> text 로 바꿔 값이 보인다.
 * 기본은 가려진 상태이고, 이때 아이콘은 사선이 그어진 눈이다.
 *
 * 로그인과 회원가입이 같은 모양이라 입력칸 스타일까지 여기서 들고 있는다.
 * (두 화면의 Input 과 같은 값이다 — 한쪽만 바뀌어 어긋나지 않게 하려면
 *  두 화면 모두 비밀번호 칸은 이 컴포넌트를 쓰면 된다)
 */

import React, { useState } from "react";
import styled from "styled-components";

import { colors, font, radius, clampW, clampH } from "../../styles/theme";

const Wrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`;

const Field = styled.input`
    width: 100%;
    line-height: 1.4;
    /* 오른쪽은 아이콘 자리를 비워 둔다 */
    padding: ${clampH(14)} ${clampW(48)} ${clampH(14)} ${clampW(16)};
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    outline: none;
    transition: border-color 0.15s ease;

    &::placeholder {
        color: ${colors.textLight};
    }

    &:focus {
        border-color: ${colors.navy};
    }

    /* 엣지/IE 가 넣는 자체 눈 아이콘은 중복이라 숨긴다 */
    &::-ms-reveal,
    &::-ms-clear {
        display: none;
    }
`;

const Toggle = styled.button`
    position: absolute;
    right: ${clampW(8)};
    width: ${clampW(34, 0.15)};
    height: ${clampW(34, 0.15)};
    padding: 0;
    border: none;
    border-radius: ${radius.sm};
    background: none;
    color: ${(props) => (props.$on ? colors.navy : colors.textLight)};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;

    &:hover {
        color: ${colors.navy};
        background: rgba(18, 24, 80, 0.06);
    }

    &:focus-visible {
        outline: 2px solid ${colors.navy};
        outline-offset: 1px;
    }
`;

/** 보이는 상태 */
const EyeIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
);

/** 가려진 상태 — 눈에 사선 */
const EyeOffIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 20L20 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const PasswordField = ({ id, name, value, onChange, placeholder, autoComplete, ...rest }) => {
    const [visible, setVisible] = useState(false);

    return (
        <Wrapper>
            <Field
                type={visible ? "text" : "password"}
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
                {...rest}
            />
            <Toggle
                type="button"
                $on={visible}
                onClick={() => setVisible((prev) => !prev)}
                aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
                aria-pressed={visible}
                title={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
                {visible ? <EyeIcon /> : <EyeOffIcon />}
            </Toggle>
        </Wrapper>
    );
};

export default PasswordField;
