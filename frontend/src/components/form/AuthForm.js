/**
 * AuthForm
 * ========
 * 아이디 찾기 / 비밀번호 찾기 화면이 함께 쓰는 카드 폼 조각들.
 * 로그인 화면과 같은 모양이라 값도 그쪽에 맞췄다.
 *
 * (로그인·회원가입은 아직 각자 같은 스타일을 들고 있다. 나중에 이 파일로
 *  모으면 네 화면이 한곳에서 관리된다)
 */

import { Link } from "react-router-dom";
import styled from "styled-components";

import { colors, font, media, radius, shadow, clampW, clampH } from "../../styles/theme";

export const Card = styled.div`
    max-width: ${clampW(700)};
    margin: ${clampH(40)} auto ${clampH(90)};
    background: ${colors.white};
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: ${clampH(48)} ${clampW(60)} ${clampH(40)};

    ${media.mobile} {
        padding: ${clampH(30)} ${clampW(22)} ${clampH(28)};
        margin: ${clampH(20)} auto ${clampH(50)};
    }
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: ${clampH(28)};
`;

export const Intro = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.textMuted};
    line-height: 1.7;
    white-space: pre-line;

    strong {
        color: ${colors.text};
        font-weight: ${font.weight.bold};
    }
`;

export const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${clampH(10)};
`;

export const Label = styled.label`
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};
`;

export const Input = styled.input`
    width: 100%;
    line-height: 1.4;
    padding: ${clampH(14)} ${clampW(16)};
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
`;

export const ErrorMessage = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: #d14343;
`;

export const ButtonRow = styled.div`
    display: grid;
    grid-template-columns: ${(props) => (props.$single ? "1fr" : "1fr 1fr")};
    gap: ${clampW(14)};
    margin-top: ${clampH(4)};
`;

export const SubmitButton = styled.button`
    padding: ${clampH(14)} 0;
    border: 1px solid ${colors.navy};
    border-radius: ${radius.md};
    background: ${colors.navy};
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:disabled {
        opacity: 0.6;
        cursor: default;
    }
`;

export const SecondaryLink = styled(Link)`
    padding: ${clampH(14)} 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    text-align: center;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: ${colors.pageBg};
    }
`;

export const SecondaryButton = styled.button`
    padding: ${clampH(14)} 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:hover {
        background: ${colors.pageBg};
    }
`;

/** 찾기 결과. 성공은 옅은 파랑, 실패는 옅은 빨강 배경. */
export const ResultBox = styled.div`
    padding: ${clampH(26)} ${clampW(24)};
    border-radius: ${radius.md};
    background: ${(props) => (props.$ok ? "#EEF3FC" : "#FDF0F0")};
    border: 1px solid ${(props) => (props.$ok ? "#CBD9F1" : "#F2CFCF")};
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.text};
    line-height: 1.75;
    text-align: center;

    p {
        margin: 0;
        white-space: pre-line;
    }

    p + p {
        margin-top: 6px;
    }

    strong {
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
    }
`;

export const HelpLinks = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${clampW(22)};
    margin-top: ${clampH(18)};
`;

export const HelpLink = styled(Link)`
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    text-decoration: none;
    white-space: nowrap;

    &:hover {
        color: ${colors.navy};
        text-decoration: underline;
    }
`;
