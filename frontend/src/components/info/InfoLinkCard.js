/**
 * InfoLinkCard
 * ============
 * 시안의 "대관 / 대여" 바로가기 카드.
 *
 * 옅은 파랑 → 흰색 그라데이션 배경, 왼쪽 위 원형 아이콘, 오른쪽 위에 같은
 * 아이콘을 크게 흐리게 깐 워터마크, 제목 + 파란 설명, 왼쪽 아래 원형 화살표.
 * 시안(1920) 기준 카드 593x512 이라 그 비율에 맞춰 여백을 잡았다.
 */

import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import { colors, font, media, homePx } from "../../styles/theme";

const Card = styled(Link)`
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: ${homePx(512)};
    padding: ${homePx(92)} ${homePx(80)} ${homePx(78)};
    border-radius: ${homePx(16)};
    background: linear-gradient(158deg, #edf3ff 0%, #f4f8ff 46%, #ffffff 100%);
    box-shadow: 0 14px 34px rgba(18, 24, 80, 0.07);
    text-decoration: none;
    overflow: hidden;
    transition: box-shadow 0.18s ease, transform 0.18s ease;

    &:hover {
        box-shadow: 0 18px 42px rgba(18, 24, 80, 0.13);
        transform: translateY(-2px);
    }

    ${media.tablet} {
        min-height: ${homePx(380)};
        padding: ${homePx(56)} ${homePx(48)} ${homePx(48)};
    }

    ${media.mobile} {
        min-height: ${homePx(260)};
        padding: ${homePx(32)} ${homePx(26)} ${homePx(28)};
        border-radius: ${homePx(12)};
    }
`;

/* 오른쪽 위에 크게 깔리는 흐린 아이콘 */
const Watermark = styled.span`
    position: absolute;
    top: ${homePx(44)};
    right: ${homePx(46)};
    color: #ccd9f2;
    opacity: 0.55;
    pointer-events: none;

    svg {
        width: ${homePx(190)};
        height: ${homePx(190)};
    }

    ${media.tablet} {
        top: ${homePx(28)};
        right: ${homePx(26)};

        svg {
            width: ${homePx(120)};
            height: ${homePx(120)};
        }
    }

    ${media.mobile} {
        svg {
            width: ${homePx(74)};
            height: ${homePx(74)};
        }
    }
`;

const IconBadge = styled.span`
    position: relative;
    width: ${homePx(100)};
    height: ${homePx(100)};
    border-radius: 50%;
    background: linear-gradient(160deg, #f7faff 0%, #d9e6ff 100%);
    color: ${colors.navy};
    display: inline-flex;
    align-items: center;
    justify-content: center;

    svg {
        width: ${homePx(46)};
        height: ${homePx(46)};
    }

    ${media.tablet} {
        width: ${homePx(72)};
        height: ${homePx(72)};

        svg {
            width: ${homePx(34)};
            height: ${homePx(34)};
        }
    }

    ${media.mobile} {
        width: ${homePx(52)};
        height: ${homePx(52)};

        svg {
            width: ${homePx(25)};
            height: ${homePx(25)};
        }
    }
`;

const Title = styled.strong`
    position: relative;
    display: block;
    margin-top: ${homePx(44)};
    font-family: ${font.family};
    font-size: ${homePx(36)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    line-height: 1.2;
    letter-spacing: -0.02em;

    ${media.tablet} {
        margin-top: ${homePx(26)};
        font-size: ${homePx(26)};
    }

    ${media.mobile} {
        margin-top: ${homePx(18)};
        font-size: ${homePx(20)};
    }
`;

const Desc = styled.span`
    position: relative;
    display: block;
    margin-top: ${homePx(28)};
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: #479be5;
    line-height: 1.5;
    white-space: pre-line;

    ${media.tablet} {
        margin-top: ${homePx(16)};
        font-size: ${homePx(16)};
    }

    ${media.mobile} {
        margin-top: ${homePx(10)};
        font-size: ${homePx(13)};
    }
`;

const Arrow = styled.span`
    position: relative;
    margin-top: auto;
    padding-top: ${homePx(42)};
    width: ${homePx(56)};
    height: ${homePx(56)};
    box-sizing: content-box;

    i {
        position: absolute;
        bottom: 0;
        left: 0;
        width: ${homePx(56)};
        height: ${homePx(56)};
        border-radius: 50%;
        background: ${colors.white};
        color: ${colors.navy};
        box-shadow: 0 4px 12px rgba(18, 24, 80, 0.12);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    ${media.mobile} {
        padding-top: ${homePx(20)};
        width: ${homePx(40)};
        height: ${homePx(40)};

        i {
            width: ${homePx(40)};
            height: ${homePx(40)};
        }

        svg {
            width: ${homePx(18)};
            height: ${homePx(18)};
        }
    }
`;

const ArrowIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12h13m0 0l-5-5m5 5l-5 5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/* http(s):// 로 시작하면 외부 주소다 — react-router 의 Link 는 내부 경로만
   다루므로, 이때는 진짜 <a> 로 새 탭에 연다. */
const isExternalLink = (url) => /^https?:\/\//i.test(url || "");

const InfoLinkCard = ({ title, description, icon, to }) => {
    const external = isExternalLink(to);
    const linkProps = external
        ? { as: "a", href: to, target: "_blank", rel: "noreferrer noopener" }
        : { to };

    return (
        <Card {...linkProps}>
            {icon && <Watermark aria-hidden="true">{icon}</Watermark>}
            {icon && <IconBadge aria-hidden="true">{icon}</IconBadge>}
            <Title>{title}</Title>
            {description && <Desc>{description}</Desc>}
            <Arrow aria-hidden="true">
                <i>
                    <ArrowIcon />
                </i>
            </Arrow>
        </Card>
    );
};

export default InfoLinkCard;
