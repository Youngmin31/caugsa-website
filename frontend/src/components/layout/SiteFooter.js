/**
 * SiteFooter
 * ==========
 * 네이비 배경 푸터. SNS 아이콘 / 소속 / ca:ble 로고 / 주소·연락처 / 저작권.
 */

import React from "react";
import styled from "styled-components";

import { colors, font, media, clampW, clampH } from "../../styles/theme";
import wordmark from "../../assets/images/main/cable_wordmark.png";

const Wrapper = styled.footer`
    width: 100%;
    background: ${colors.footerNavy};
    color: ${colors.onNavy};
    /* 시안 기준: 위 27px, 아래 46px */
    padding: ${clampH(27)} ${clampW(20)} ${clampH(46)};
    text-align: center;
`;

const Social = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${clampW(13)};
    margin-bottom: ${clampH(35)};

    a {
        color: ${colors.onNavy};
        display: inline-flex;
        opacity: 0.95;

        &:hover {
            opacity: 1;
        }
    }
`;

const Org = styled.p`
    margin: 0 0 ${clampH(34)};
    font-family: ${font.family};
    font-size: ${clampW(27, 0.15)};
    font-weight: ${font.weight.medium};
    letter-spacing: -0.01em;
    line-height: 1;

    ${media.mobile} {
        font-size: ${clampW(22, 0.15)};
        margin-bottom: ${clampH(22)};
    }
`;

/* 시안에서 잘라낸 ca:ble 워드마크(흰색 + 알파). 폭 448px 로 놓으면 시안과 같다. */
const Wordmark = styled.img`
    display: block;
    width: ${clampW(300)};
    max-width: 72%;
    height: auto;
    margin: 0 auto ${clampH(57)};

    ${media.mobile} {
        width: ${clampW(240)};
        margin-bottom: ${clampH(32)};
    }
`;

const Contact = styled.address`
    font-style: normal;
    font-family: ${font.family};
    font-size: ${clampW(14, 0.15)};
    line-height: 1.15;
    color: rgba(255, 255, 255, 0.82);
    margin-bottom: ${clampH(39)};
`;

const Copyright = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${clampW(14, 0.15)};
    line-height: 1;
    color: rgba(255, 255, 255, 0.9);

    ${media.mobile} {
        font-size: ${clampW(13, 0.15)};
    }
`;

const SOCIAL_LINKS = [
    { key: "instagram", label: "인스타그램", href: "https://www.instagram.com/cau.cable/" },
    { key: "kakao", label: "카카오톡", href: "https://pf.kakao.com/_wLfZd" },
    { key: "facebook", label: "페이스북", href: "https://www.facebook.com/caugsa/?locale=ko_KR" },
];

const Icon = ({ name }) => {
    if (name === "instagram") {
        return (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
            </svg>
        );
    }
    if (name === "kakao") {
        return (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z" />
            </svg>
        );
    }
    return (
        <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
        </svg>
    );
};

const SiteFooter = () => (
    <Wrapper>
        <Social>
            {SOCIAL_LINKS.map((item) => (
                <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={item.label}
                >
                    <Icon name={item.key} />
                </a>
            ))}
        </Social>

        <Org>중앙대학교 68대 총학생회 ca:ble</Org>

        <Wordmark src={wordmark} alt="ca:ble" />

        <Contact>
            서울캠퍼스 | 서울특별시 동작구 흑석로 84 중앙대학교
            <br />
            TEL : 02-881-7371
            <br />
            E-MAIL : cau.68.cable@gmail.com
        </Contact>

        <Copyright>COPYRIGHT ⓒ CHUNG-ANG UNIVERSITY ALL RIGHTS RESERVED</Copyright>
    </Wrapper>
);

export default SiteFooter;
