/**
 * Home (메인)
 * ===========
 * figma 화면/중대중심 최종 (1).png (1920x6459) 을 픽셀 단위로 재서 옮긴 화면.
 *
 *   히어로       : 전면 사진 + ca:ble 워드마크 + 카피 + CTA (내비게이션이 위에 뜬다)
 *   참여 행사    : 패널 안에 포스터 카드 3장 + 페이지 점
 *   학생 자치    : 회의록 프로모 카드 + 회칙 목록 표
 *   대관 / 대여  : 바로가기 카드 2장
 *   연간 일정    : 달력 패널
 *   오시는 길    : 캠퍼스 지도 + 총학생회실 안내
 *
 * 시안 좌표(1920 기준)와 실제 CSS 값의 대응은 각 스타일 주석에 남겼다.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import InfoLinkCard from "../../components/info/InfoLinkCard";
import HomeCalendar from "../../components/main/HomeCalendar";
import { fetchPosts } from "../../services/boardService";
import { colors, font, layout, media, radius, homePx } from "../../styles/theme";

import heroSlide1 from "../../assets/images/main/hero/hero_01.jpg";
import heroSlide2 from "../../assets/images/main/hero/hero_02.jpg";
import heroSlide3 from "../../assets/images/main/hero/hero_03.jpg";
import heroSlide4 from "../../assets/images/main/hero/hero_04.jpg";
import wordmark from "../../assets/images/main/cable_wordmark.png";
import campusMap from "../../assets/images/main/campus_map.png";
import minutesPromo from "../../assets/images/main/minutes_promo.png";

/* 히어로 배경 슬라이드. 순서를 바꾸거나 장수를 늘리려면 이 배열만 고치면 된다. */
const heroSlides = [heroSlide1, heroSlide2, heroSlide3, heroSlide4];

/* 자동 전환 간격(ms) */
const HERO_INTERVAL = 6000;

/*
 * 참여 행사는 "공지로 지정한 행사"(is_notice) 만 메인에 올린다.
 * 몇 개가 지정될지 모르니 넉넉히 받아 와서 거르고, 3장씩 끊어 페이지를 만든다.
 * 목록 API 가 공지를 앞에 정렬해 주므로 앞쪽만 받아도 충분하다.
 */
const EVENTS_PER_PAGE = 3;
const EVENT_FETCH_COUNT = 30;

/* 참여 행사 자동 슬라이드 간격(ms) */
const EVENT_INTERVAL = 6000;

/*
 * 회의록 게시판 최신 글 중 "제목에 회의록이 들어간" 글을 찾아야 해서
 * 앞쪽 목록만으로는 부족할 수 있어 넉넉히 받아 온다.
 */
const MINUTES_FETCH_COUNT = 30;

/* 히어로 아래부터 푸터 위까지, 콘텐츠 사이 간격을 전부 이 값 하나로 통일한다 (1920 기준 px). */
const SECTION_GAP = 300;

const Page = styled.div`
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: ${colors.pageBg};
    display: flex;
    flex-direction: column;
`;

/* =========================================================================
 * 히어로 — 시안 y48~1133 (사진이 내비게이션 뒤까지 올라온다)
 * ====================================================================== */

const Hero = styled.section`
    position: relative;
    width: 100%;
    /* 시안: 상단바(48) 아래에서 시작해 1085px. 1920 기준 56.5vw 와 같다.
       (데스크탑/노트북 전용 — 아래 media.mobile 은 건드리지 않는다. 사진이
       3:2 가로 비율이라 56.5vw 보다 좁으면 cover 가 상하를 더 많이 잘라낸다) */
    margin-top: ${layout.topBarHeight};
    height: 56.5vw;
    max-height: 1085px;
    min-height: 420px;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    background: ${colors.navy};

    ${media.mobile} {
        height: 78vw;
        min-height: 340px;
    }
`;

/* 배경 이미지 한 장. 전부 겹쳐 두고 활성 슬라이드만 페이드인시킨다. */
const HeroSlide = styled.div`
    position: absolute;
    inset: 0;
    background-image: url(${(props) => props.$image});
    background-size: cover;
    background-position: center;
    opacity: ${(props) => (props.$active ? 1 : 0)};
    transition: opacity 0.9s ease-in-out;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const HeroInner = styled.div`
    position: relative;
    z-index: 1;
    width: 100%;
    /* 시안: 왼쪽 163px, 아래 184px (1920 기준 8.5vw / 9.6vw) */
    padding: 0 8.5vw 9.6vw;
    color: ${colors.white};

    ${media.mobile} {
        padding: 0 24px 40px;
    }
`;

const HeroLogo = styled.img`
    display: block;
    /* 시안 높이 63px */
    height: 4.2vw;
    max-height: 75px;
    min-height: 24px;
    width: auto;
    /* 밝은 사진 위에서도 읽히도록 (시안도 옅은 그림자가 있다) */
    filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.28));
    /* 시안: 워드마크 아래 40px */
    margin-bottom: 1.4vw;
`;

const HeroTitle = styled.h1`
    /* 시안: 98px / 행간 1.0 */
    margin: 0;
    font-family: ${font.family};
    font-size: 4.0vw;
    font-weight: ${font.weight.bold};
    line-height: 1.15;
    letter-spacing: -0.02em;
    /* 히어로 사진에 흰 텐트처럼 밝은 부분이 있어 흰 글씨가 묻힌다.
       세 겹으로 나눠 건다 — 글자 가장자리를 또렷하게 잡는 짧은 그림자,
       배경과 떼어 놓는 중간 그림자, 글자 뒤를 은은히 눌러 주는 넓은 그림자. */
    text-shadow:
        0 1px 2px rgba(4, 8, 26, 0.5),
        0 3px 12px rgba(4, 8, 26, 0.42),
        0 10px 38px rgba(4, 8, 26, 0.34);

    ${media.mobile} {
        font-size: 30px;
        line-height: 1.15;
    }
`;

const HeroCta = styled(Link)`
    display: inline-flex;
    align-items: center;
    /* 시안: 타이틀 아래 32px, 버튼 239x55 */
    margin-top: 1.7vw;
    padding: 0.85vw 1.5vw;
    border-radius: ${radius.pill};
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.85);
    color: ${colors.white};
    font-family: ${font.family};
    font-size: 1.05vw;
    font-weight: ${font.weight.semibold};
    text-decoration: none;
    backdrop-filter: blur(3px);
    white-space: nowrap;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    transition: background-color 0.2s ease, border-color 0.2s ease;

    &:hover {
        background: rgba(18, 24, 80, 0.55);
        border-color: rgba(18, 24, 80, 0.85);
    }

    ${media.mobile} {
        margin-top: 16px;
        padding: 9px 18px;
        font-size: 13px;
    }
`;

const HeroDots = styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    z-index: 2;
    display: flex;
    justify-content: center;
    gap: 10px;

    ${media.mobile} {
        bottom: 12px;
    }
`;

const HeroDot = styled.button`
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${(props) => (props.$active ? colors.white : "rgba(255, 255, 255, 0.45)")};
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
        transition: background 0.2s ease;
    }

    &:hover::before {
        background: ${colors.white};
    }
`;

/* =========================================================================
 * 공통 레이아웃
 * ====================================================================== */

/* 히어로~푸터 사이 섹션 간격을 전부 이 값 하나로 통일한다 (SECTION_GAP 과 동일). */
const Main = styled.main`
    flex: 1;
    width: 100%;
    /* 시안 컨테이너 1440 도 같은 배율로 줄인다 */
    max-width: ${homePx(1440)};
    margin: 0 auto;
    /* 히어로 → 첫 섹션, 마지막 섹션 → 푸터 간격도 섹션 사이 간격과 같게 맞춘다 */
    padding: ${homePx(SECTION_GAP)} ${homePx(24)} ${homePx(SECTION_GAP)};

    ${media.tablet} {
        padding: ${homePx(SECTION_GAP * 0.45)} ${homePx(24)} ${homePx(SECTION_GAP * 0.45)};
    }

    ${media.mobile} {
        padding: ${homePx(SECTION_GAP * 0.45)} ${homePx(16)} ${homePx(SECTION_GAP * 0.45)};
    }
`;

/** 옅은 패널. 시안에서 배경(#F5F7FC)과 거의 같은 색 + 그림자로만 떠 보인다. */
const Panel = styled.section`
    background: ${colors.panel};
    border-radius: ${homePx(24)};
    box-shadow: 0 5px 40px rgba(18, 24, 80, 0.15);

    ${media.mobile} {
        border-radius: ${homePx(14)};
    }
`;

const SectionTitle = styled.h2`
    margin: 0;
    font-family: ${font.family};
    /* 시안 ${homePx(40)} */
    font-size: ${homePx(40)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    letter-spacing: -0.02em;
    line-height: 1.1;

    ${media.mobile} {
        font-size: ${homePx(22)};
    }
`;

/** 제목 + 더보기. 더보기 버튼이 구분선을 걸치고 앉는다(시안). */
const SectionHead = styled.div`
    display: flex;
    /* 더보기 버튼을 섹션 제목과 같은 높이(세로 가운데)에 둔다 */
    align-items: center;
    justify-content: space-between;
    gap: ${homePx(16)};
    padding: 0 ${homePx(22)} ${homePx(22)};
    border-bottom: 2px solid ${colors.rule};
`;

const MoreLink = styled(Link)`
    position: relative;
    z-index: 1;
    padding: ${homePx(16)} ${homePx(26)};
    border-radius: ${radius.pill};
    background: ${colors.white};
    box-shadow: 0 3px 10px rgba(18, 24, 80, 0.1);
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    text-decoration: none;
    white-space: nowrap;

    &:hover {
        box-shadow: 0 5px 14px rgba(18, 24, 80, 0.18);
    }

    ${media.mobile} {
        padding: ${homePx(10)} ${homePx(14)};
        font-size: ${homePx(13)};
    }
`;

/* =========================================================================
 * 참여 행사
 * ====================================================================== */

const EventPanel = styled(Panel)`
    /* 시안: 패널 안쪽 여백 위 48 / 좌우 98 / 아래 43.
       카드를 인스타 비율(3:4)로 키우려고 좌우를 86 으로 좁혔다. */
    padding: ${homePx(48)} ${homePx(86)} ${homePx(43)};

    ${media.tablet} {
        padding: ${homePx(40)} ${homePx(40)} ${homePx(34)};
    }

    ${media.mobile} {
        padding: ${homePx(24)} ${homePx(18)} ${homePx(20)};
    }
`;

/**
 * 카드가 옆으로 흐르는 창.
 * overflow: clip + clip-margin 은 가로만 자르고 카드 그림자는 살려 둔다.
 * (지원하지 않는 브라우저는 앞줄의 hidden 으로 떨어진다)
 */
const EventViewport = styled.div`
    /* 좌우 여백 중 일부는 아래 EventRow 의 padding 이 맡는다 (그림자 자리).
       카드를 키우려고 40 -> 34 로 줄였다. */
    margin: ${homePx(55)} ${homePx(34)} 0;
    overflow: hidden;

    ${media.tablet} {
        margin: ${homePx(34)} 0 0;
    }

    ${media.mobile} {
        margin-top: ${homePx(22)};
    }
`;

const EventTrack = styled.div`
    display: flex;
    transform: translateX(-${(props) => props.$index * 100}%);
    transition: transform 0.6s ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const EventRow = styled.div`
    flex: 0 0 100%;
    display: grid;
    /* 카드를 인스타 비율(3:4)로 키우려고 간격을 61 -> 40 으로 줄였다.
       장수가 3장보다 적으면 남는 칸은 비워 둔다. */
    grid-template-columns: repeat(3, 1fr);
    gap: ${homePx(40)};
    align-items: start;
    /* 카드 그림자가 잘리지 않도록 페이지 안쪽에 여유를 둔다.
       바깥을 hidden 으로 자르므로 옆 페이지는 비치지 않는다. */
    padding: 0 16px;

    ${media.tablet} {
        gap: ${homePx(26)};
    }

    ${media.mobile} {
        /* 데스크탑처럼 가로 3개를 유지한다. 간격만 좁혀서 카드가 들어가게 한다. */
        gap: ${homePx(10)};
        padding: 0 10px;
    }
`;

const EventCard = styled(Link)`
    position: relative;
    display: block;
    /* 인스타그램 사진 비율(1080 x 1440)에 맞춘 카드 */
    aspect-ratio: 1080 / 1440;
    border-radius: ${homePx(12)};
    overflow: hidden;
    background: linear-gradient(160deg, #cddcf5 0%, #a9c2ea 100%);
    box-shadow: 0 8px 22px rgba(18, 24, 80, 0.1);
    text-decoration: none;
    transition: box-shadow 0.18s ease, transform 0.18s ease;

    &:hover {
        box-shadow: 0 14px 30px rgba(18, 24, 80, 0.18);
        transform: translateY(-2px);
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    /* 공지가 3개보다 적어 채워 넣은 칸은 모바일에서도 숨긴다(중복 카드 방지).
       모바일도 데스크탑처럼 3열을 유지하므로 폭 제한은 더 필요 없다. */
    ${media.mobile} {
        display: ${(props) => (props.$filler ? "none" : "block")};
    }
`;

/** 썸네일이 없을 때 예전처럼 제목을 얹은 파란 배경으로 되돌린다. */
const EventFallback = styled.span`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${homePx(26)};
    text-align: center;
    font-family: ${font.family};
    font-size: ${homePx(17)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    line-height: 1.5;
    word-break: keep-all;
`;

const DdayBadge = styled.em`
    position: absolute;
    /* 시안: 카드 왼쪽에서 20, 위에서 13, 73x37 */
    top: ${homePx(13)};
    left: ${homePx(20)};
    font-style: normal;
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: ${colors.white};
    background: ${colors.navy};
    border-radius: ${radius.pill};
    padding: ${homePx(5)} ${homePx(16)};

    ${media.mobile} {
        top: ${homePx(10)};
        left: ${homePx(12)};
        font-size: ${homePx(14)};
        padding: 3px ${homePx(11)};
    }
`;

const PageDots = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: ${homePx(9)};
    /* 시안: 카드 아래 ${homePx(67)} */
    margin-top: ${homePx(67)};

    ${media.mobile} {
        margin-top: ${homePx(28)};
    }
`;

const PageDot = styled.button`
    width: ${homePx(12)};
    height: ${homePx(12)};
    padding: 0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    background: ${(props) => (props.$active ? colors.navy : "#C9CFDE")};
    transition: background 0.2s ease;
`;

const EmptyBox = styled.p`
    grid-column: 1 / -1;
    margin: 0;
    padding: ${homePx(90)} 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${homePx(17)};
    color: ${colors.textLight};
`;

/* =========================================================================
 * 학생 자치
 * ====================================================================== */

/* $gap(px, 1920 기준)만큼 위 섹션과 띄운다. 다들 SECTION_GAP 을 넘겨 간격을 통일한다. */
const Section = styled.section`
    margin-top: ${(props) => homePx(props.$gap)};

    ${media.tablet} {
        margin-top: ${(props) => homePx(props.$gap * 0.45)};
    }

    ${media.mobile} {
        margin-top: ${(props) => homePx(props.$gap * 0.45)};
    }
`;

const AutonomyGrid = styled.div`
    display: grid;
    /* 시안: 프로모 470 + 간격 130 + 목록 나머지 */
    grid-template-columns: ${homePx(470)} minmax(0, 1fr);
    gap: ${homePx(130)};
    margin-top: ${homePx(68)};

    ${media.tablet} {
        grid-template-columns: 1fr;
        gap: ${homePx(30)};
        margin-top: ${homePx(34)};
    }

    /* 태블릿에서는 세로로 쌓이지만, 모바일에서는 큰 화면처럼 다시 나란히 둔다.
       프로모 칸이 고정폭(470 기준)이면 좁은 화면에서 목록이 밀려 비율로 바꾼다. */
    ${media.mobile} {
        grid-template-columns: 1fr 1.3fr;
        gap: ${homePx(16)};
        margin-top: ${homePx(20)};
    }
`;

/*
 * 카드 자체(썸네일 영역)를 누르면 회의록 게시판 목록으로, "최신 회의록
 * 바로가기" 버튼을 누르면 최신 글로 가야 해서 링크를 두 개로 나눈다.
 * a 태그는 중첩할 수 없으므로 카드 전체를 덮는 링크를 배경으로 깔고
 * 버튼 링크를 그 위에 얹어 클릭을 가로채게 한다.
 */
const PromoCard = styled.div`
    position: relative;
    display: block;
    padding: ${homePx(14)};
    border-radius: ${homePx(16)};
    background: ${colors.panel};
    box-shadow: 0 14px 34px rgba(18, 24, 80, 0.08);
    transition: box-shadow 0.18s ease;

    &:hover {
        box-shadow: 0 18px 40px rgba(18, 24, 80, 0.16);
    }

    /* 모바일에서 AutonomyGrid 두 칸은 기본값(stretch)대로 같은 높이로
       맞춘다 — 옆 회칙 목록과 세로 길이가 달라 보이지 않게. 다만 카드가
       옆 칸보다 길어지면 썸네일(고정 비율) 아래로 빈 공간이 남으므로,
       세로 가운데 정렬해 그 여백을 위아래로 나눠 가진다(썸네일 자체는
       늘리거나 자르지 않는다). */
    ${media.mobile} {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
`;

/** 카드 전체를 덮는 배경 링크 (목록으로 이동). 버튼 아래에 깔린다. */
const PromoCardLink = styled(Link)`
    position: absolute;
    inset: 0;
    z-index: 0;
`;

const PromoThumb = styled.div`
    position: relative;
    aspect-ratio: 442 / 580;
    border-radius: ${homePx(8)};
    overflow: hidden;
    background: linear-gradient(170deg, #29346f 0%, #151f52 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: ${colors.white};
    line-height: 1.5;
    word-break: keep-all;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
`;

const PromoButton = styled(Link)`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${homePx(10)};
    height: ${homePx(44)};
    margin-top: ${homePx(12)};
    padding: 0 ${homePx(16)};
    border: 1px solid #b9c6e6;
    border-radius: ${homePx(6)};
    background: ${colors.white};
    font-family: ${font.family};
    font-size: ${homePx(17)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
    text-decoration: none;

    /* 모바일에서는 프로모 칸이 좁아져 한 줄 고정 높이면 글자가 잘릴 수 있어
       줄바꿈을 허용하고 글자/여백을 줄인다. */
    ${media.mobile} {
        height: auto;
        min-height: ${homePx(36)};
        gap: ${homePx(6)};
        padding: ${homePx(8)} ${homePx(10)};
        font-size: ${homePx(13)};
        white-space: normal;
        line-height: 1.3;
    }
`;

const ListPanel = styled.div`
    background: ${colors.panel};
    border-radius: ${homePx(16)};
    box-shadow: 0 14px 34px rgba(18, 24, 80, 0.08);
    /* 시안: 패널 위 ${homePx(75)} 지점에 제목, 표 머리띠는 그 아래 */
    padding: ${homePx(58)} 0 ${homePx(26)};
    overflow: hidden;
`;

const ListHead = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${homePx(14)};
    padding: 0 ${homePx(40)} ${homePx(30)};

    h3 {
        margin: 0;
        font-family: ${font.family};
        font-size: ${homePx(28)};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
    }

    ${media.mobile} {
        padding: 0 ${homePx(18)} ${homePx(18)};

        h3 {
            font-size: ${homePx(18)};
        }
    }
`;

const MiniTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-family: ${font.family};
    table-layout: fixed;

    th {
        padding: ${homePx(18)} ${homePx(6)};
        background: #fdfdfe;
        font-size: ${homePx(17)};
        font-weight: ${font.weight.medium};
        color: #6e738c;
        text-align: center;
    }

    td {
        height: ${homePx(76)};
        padding: 0 ${homePx(6)};
        vertical-align: middle; /* reset.js 의 baseline 을 덮는다 */
        font-size: ${homePx(17)};
        color: ${colors.navy};
        text-align: center;
        border-bottom: 1px solid #e6eaf3;
    }

    tr:last-child td {
        border-bottom: none;
    }

    /* 제목 칸(번호 다음 칸)의 본문은 왼쪽 정렬한다. 번호는 숫자라 가운데가 자연스럽다.
       머리글 "제목" 글자는 짧아서 왼쪽 정렬이면 뜨 보이므로 가운데로 둔다. */
    td:last-child {
        text-align: left;
    }

    a {
        color: inherit;
        text-decoration: none;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 ${homePx(10)};

        &:hover {
            text-decoration: underline;
        }
    }

    /* 번호 칸만 내용 길이가 뻔하니 고정폭을 주고, 나머지는 전부 제목에 준다.
       작성일 칸을 없애 확보한 폭도 전부 제목으로 간다(table-layout: fixed
       라 명시적으로 폭을 지정한 칸 외에는 남는 폭을 가져간다). */
    th:first-child {
        width: 90px;
    }

    ${media.mobile} {
        th {
            padding: ${homePx(12)} ${homePx(4)};
            font-size: ${homePx(12)};
        }

        th:first-child {
            width: 46px;
        }

        td {
            height: ${homePx(48)};
            font-size: ${homePx(12)};
        }
    }
`;

/* =========================================================================
 * 대관 / 대여, 오시는 길
 * ====================================================================== */

const TwoCol = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    /* 시안: 카드 593 + 간격 28 */
    gap: ${homePx(28)};

    /* 모바일에서도 큰 화면처럼 두 칸을 나란히 둔다 (간격만 좁힌다). */
    ${media.mobile} {
        gap: ${homePx(12)};
    }
`;

const CalendarPanel = styled(Panel)`
    padding: ${homePx(56)} ${homePx(118)} ${homePx(64)};

    ${media.tablet} {
        padding: ${homePx(36)} ${homePx(34)} ${homePx(40)};
    }

    ${media.mobile} {
        padding: ${homePx(22)} ${homePx(16)} ${homePx(26)};
    }
`;

const MapGrid = styled.div`
    display: grid;
    /* 시안: 지도 810 + 안내 카드 나머지 */
    grid-template-columns: ${homePx(810)} minmax(0, 1fr);
    gap: ${homePx(30)};
    align-items: start;

    ${media.tablet} {
        grid-template-columns: 1fr;
        gap: ${homePx(24)};
    }
`;

const MapImage = styled.img`
    display: block;
    width: 100%;
    height: auto;
`;

const OfficePanel = styled.div`
    background: ${colors.panel};
    border-radius: ${homePx(12)};
    box-shadow: 0 14px 34px rgba(18, 24, 80, 0.08);
    padding: ${homePx(44)} ${homePx(46)} ${homePx(40)};

    h3 {
        margin: 0 0 ${homePx(26)};
        font-family: ${font.family};
        font-size: ${homePx(28)};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
        line-height: 1.45;
    }

    hr {
        margin: 0 0 ${homePx(30)};
        border: none;
        border-top: 2px solid ${colors.navy};
    }

    dl {
        margin: 0;
        display: grid;
        grid-template-columns: ${homePx(120)} 1fr;
        row-gap: ${homePx(26)};
        font-family: ${font.family};
        font-size: ${homePx(19)};
    }

    dt {
        color: ${colors.navy};
        font-weight: ${font.weight.bold};
    }

    dd {
        margin: 0;
        color: ${colors.navy};
        line-height: 1.55;
    }

    ${media.mobile} {
        padding: ${homePx(26)} ${homePx(20)};

        h3 {
            font-size: ${homePx(19)};
        }

        dl {
            grid-template-columns: ${homePx(84)} 1fr;
            row-gap: ${homePx(16)};
            font-size: ${homePx(14)};
        }
    }
`;

const OfficeContact = styled.div`
    display: flex;
    align-items: center;
    gap: ${homePx(34)};
    margin-top: ${homePx(44)};
    padding-top: ${homePx(26)};
    border-top: 1px dotted #b9c1d8;
    font-family: ${font.family};
    font-size: ${homePx(18)};
    color: ${colors.navy};

    ${media.mobile} {
        gap: ${homePx(16)};
        margin-top: ${homePx(24)};
        font-size: ${homePx(13)};
        flex-wrap: wrap;
    }
`;

/**
 * 전화번호/이메일. 예전 span 과 크기·간격이 똑같이 보이도록 버튼 기본 스타일을
 * 지우고 그 값을 그대로 옮겼다. "복사됨" 안내는 자리를 차지하지 않도록 절대
 * 위치로 얹어서, 떴다 사라져도 옆 항목이 밀리지 않는다.
 */
const CopyButton = styled.button`
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: ${homePx(9)};
    margin: 0;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: opacity 0.15s ease;

    &:hover {
        opacity: 0.68;
    }
`;

/** 복사 직후 버튼 위에 잠깐 뜨는 안내. 절대 위치라 레이아웃에 영향을 주지 않는다. */
const CopyHint = styled.span`
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    background: ${colors.navy};
    white-space: nowrap;
    font-size: 12px;
    font-weight: ${font.weight.semibold};
    color: ${colors.white};
    pointer-events: none;
    opacity: ${(props) => (props.$show ? 1 : 0)};
    transition: opacity 0.15s ease;
`;

/* =========================================================================
 * 아이콘
 * ====================================================================== */

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.6" y="5" width="16.8" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.6 9.4h16.8M8 3.4v3M16 3.4v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9.4 13.8l1.8 1.8 3.4-3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const BoxIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.4l8 3.6v10L12 20.6 4 17V7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M4 7l8 3.6L20 7M12 10.6v10" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
);

const ChevronIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PhoneIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M6.2 3.6h3l1.5 3.7-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 3.7 1.5v3a1.6 1.6 0 0 1-1.8 1.6C10.6 17.9 6.1 13.4 4.6 5.4A1.6 1.6 0 0 1 6.2 3.6z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
    </svg>
);

const MailIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5.6" width="18" height="12.8" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.8 7l8.2 6 8.2-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/* =========================================================================
 * 표시용 헬퍼
 * ====================================================================== */

/** "YYYY-MM-DD" -> 그날 자정의 Date. 형식이 이상하면 null. */
const midnight = (value) => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 행사 시작일 기준 D-day.
 * 시작일이 지난 뒤에는 종료일까지는 "진행 중", 그 뒤로는 "종료" 로 바꾼다.
 * 시작일이 없으면(캘린더에 올리지 않은 행사) 뱃지를 달지 않는다.
 */
const ddayLabel = (startDate, endDate) => {
    const start = midnight(startDate);
    if (!start) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((start - today) / 86400000);

    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return "D-DAY";

    const end = midnight(endDate) || start;
    return today <= end ? "진행 중" : "종료";
};

/**
 * 참여 행사 카드 하나.
 *
 * 썸네일(본문 첫 이미지)이 없거나 파일이 없어 로드가 실패하면 제목을 얹은
 * 파란 배경으로 되돌린다. 레거시 이관 글은 파일명만 있고 실제 파일이 없는
 * 경우가 있어 폴백이 필요하다.
 */
const EventPosterCard = ({ post, filler = false }) => {
    const [showImage, setShowImage] = useState(Boolean(post.thumbnailUrl));

    // D-day 는 행사 시작일 기준이다 (신청 마감일이 아니다).
    // 참여 신청 링크는 붙이지 않는다 — 신청 폼 주소를 DB 에 두지 않기로 했다.
    const dday = ddayLabel(post.startDate, post.endDate);

    return (
        <EventCard
            to={`/board/projects/detail/${post.id}`}
            $filler={filler}
            // 같은 글을 두 번 읽어 주지 않도록 채움 카드는 보조기기에서 제외한다
            aria-hidden={filler ? "true" : undefined}
            tabIndex={filler ? -1 : undefined}
        >
            {showImage ? (
                <img src={post.thumbnailUrl} alt="" onError={() => setShowImage(false)} />
            ) : (
                <EventFallback>{post.title}</EventFallback>
            )}
            {dday && <DdayBadge>{dday}</DdayBadge>}
        </EventCard>
    );
};

const Home = () => {
    const [events, setEvents] = useState([]);
    const [rules, setRules] = useState([]);
    const [latestMinutesId, setLatestMinutesId] = useState(null);
    const [heroIndex, setHeroIndex] = useState(0);
    const [eventPage, setEventPage] = useState(0);
    // 방금 복사한 항목("phone"/"email")을 잠깐 표시했다가 지운다
    const [copiedField, setCopiedField] = useState(null);

    const handleCopy = async (text, field) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error("복사 실패:", err);
            return;
        }
        setCopiedField(field);
        setTimeout(() => {
            setCopiedField((current) => (current === field ? null : current));
        }, 1500);
    };

    /* 히어로 자동 전환. heroIndex 가 바뀔 때마다 타이머를 다시 걸어서,
       점을 눌러 직접 넘긴 직후에 곧바로 다음 장으로 튀지 않게 한다. */
    useEffect(() => {
        const timer = setTimeout(() => {
            setHeroIndex((current) => (current + 1) % heroSlides.length);
        }, HERO_INTERVAL);
        return () => clearTimeout(timer);
    }, [heroIndex]);

    // 공지로 지정된 개수에 맞춰 페이지를 만든다 (4개면 2페이지, 3개 이하면 1페이지)
    const eventPageCount = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));

    /* 참여 행사도 히어로처럼 한 페이지씩 옆으로 넘긴다.
       페이지가 하나뿐이면 타이머를 걸지 않는다. */
    useEffect(() => {
        if (eventPageCount <= 1) return undefined;
        const timer = setTimeout(() => {
            setEventPage((current) => (current + 1) % eventPageCount);
        }, EVENT_INTERVAL);
        return () => clearTimeout(timer);
    }, [eventPage, eventPageCount]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [eventResult, ruleResult, minutesResult] = await Promise.all([
                    fetchPosts({ board: "projects", offset: 0, limit: EVENT_FETCH_COUNT })
                        .catch(() => ({ posts: [] })),
                    fetchPosts({ board: "rules", offset: 0, limit: 6 }).catch(() => ({ posts: [] })),
                    fetchPosts({ board: "minutes", offset: 0, limit: MINUTES_FETCH_COUNT })
                        .catch(() => ({ posts: [] })),
                ]);
                if (cancelled) return;
                // 메인에 올리는 기준은 "공지로 지정된 행사" 다
                setEvents((eventResult.posts || []).filter((post) => post.isNotice));
                setRules(ruleResult.posts || []);
                // 제목에 "회의록"이 들어간 글 중 등록일이 가장 최신인 것을 찾는다
                // (목록 맨 위가 항상 최신 등록순은 아닐 수 있어 직접 비교한다)
                const latestMinutes = (minutesResult.posts || [])
                    .filter((post) => post.title?.includes("회의록"))
                    .reduce((latest, post) => {
                        if (!latest) return post;
                        return new Date(post.createdAt) > new Date(latest.createdAt) ? post : latest;
                    }, null);
                setLatestMinutesId(latestMinutes?.id ?? null);
            } catch (err) {
                console.error("메인 데이터 로드 오류:", err);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    /*
     * 한 줄은 항상 3칸이다. 공지가 1~2개뿐이면 빈 칸이 생기므로
     * 앞에서부터 다시 끌어와 채운다 (1개 -> A A A, 2개 -> A B A).
     * 채워 넣은 카드는 $filler 로 표시해 좁은 화면에서는 숨긴다.
     */
    const eventPages =
        events.length === 0
            ? []
            : Array.from({ length: eventPageCount }, (_, pageIndex) =>
                  Array.from({ length: EVENTS_PER_PAGE }, (_, slot) => {
                      const index = pageIndex * EVENTS_PER_PAGE + slot;
                      return { post: events[index % events.length], filler: index >= events.length };
                  })
              );
    const safePage = Math.min(eventPage, eventPageCount - 1);

    return (
        <Page>
            {/* 메인에서는 내비게이션이 히어로 사진 위에 반투명으로 뜬다 (시안) */}
            <SiteHeader overlay />

            <Hero>
                {heroSlides.map((slide, index) => (
                    <HeroSlide
                        key={slide}
                        $image={slide}
                        $active={index === heroIndex}
                        aria-hidden="true"
                    />
                ))}

                <HeroInner>
                    <HeroLogo src={wordmark} alt="ca:ble" />
                    <HeroTitle>
                        가능성을 이어
                        <br />
                        하나 된 중앙으로
                    </HeroTitle>
                    <HeroCta to="/introduction/greeting">총학생회 소개 바로가기</HeroCta>
                </HeroInner>

                <HeroDots>
                    {heroSlides.map((slide, index) => (
                        <HeroDot
                            key={slide}
                            type="button"
                            $active={index === heroIndex}
                            onClick={() => setHeroIndex(index)}
                            aria-label={`메인 이미지 ${index + 1}번 보기`}
                            aria-current={index === heroIndex}
                        />
                    ))}
                </HeroDots>
            </Hero>

            <Main>
                {/* 참여 행사 */}
                <EventPanel>
                    <SectionHead>
                        <SectionTitle>참여 행사</SectionTitle>
                        <MoreLink to="/board/projects">더보기 +</MoreLink>
                    </SectionHead>

                    {events.length === 0 ? (
                        <EventRow>
                            <EmptyBox>등록된 행사가 없습니다.</EmptyBox>
                        </EventRow>
                    ) : (
                        <EventViewport>
                            <EventTrack $index={safePage}>
                                {eventPages.map((page, index) => (
                                    <EventRow key={index} aria-hidden={index !== safePage}>
                                        {page.map((slot, slotIndex) => (
                                            <EventPosterCard
                                                key={`${slot.post.id}-${slotIndex}`}
                                                post={slot.post}
                                                filler={slot.filler}
                                            />
                                        ))}
                                    </EventRow>
                                ))}
                            </EventTrack>
                        </EventViewport>
                    )}

                    {eventPageCount > 1 && (
                        <PageDots>
                            {Array.from({ length: eventPageCount }, (_, index) => (
                                <PageDot
                                    key={index}
                                    type="button"
                                    $active={index === safePage}
                                    onClick={() => setEventPage(index)}
                                    aria-label={`참여 행사 ${index + 1}페이지 보기`}
                                    aria-current={index === safePage}
                                />
                            ))}
                        </PageDots>
                    )}
                </EventPanel>

                {/* 학생 자치 */}
                <Section $gap={SECTION_GAP}>
                    <SectionHead>
                        <SectionTitle>학생자치</SectionTitle>
                        <MoreLink to="/autonomy/rules">더보기 +</MoreLink>
                    </SectionHead>

                    <AutonomyGrid>
                        <PromoCard>
                            {/* 특정 글의 썸네일이 아니라 회의록 대표 이미지(고정) 다 */}
                            <PromoThumb>
                                <img src={minutesPromo} alt="" />
                            </PromoThumb>
                            {/* 카드(썸네일 포함) 전체를 누르면 회의록 게시판 목록으로 이동한다.
                                z-index 가 같은 레벨(0)에서는 DOM 순서가 나중인 쪽이 위로 그려지므로,
                                썸네일 위에 클릭을 받으려면 이 링크가 썸네일보다 뒤에 와야 한다. */}
                            <PromoCardLink to="/autonomy/minutes" aria-label="회의록 게시판" />
                            {/* 최신 회의록이 아직 안 왔으면(로딩/오류) 목록으로라도 보낸다 */}
                            <PromoButton
                                to={
                                    latestMinutesId
                                        ? `/autonomy/minutes/detail/${latestMinutesId}`
                                        : "/autonomy/minutes"
                                }
                            >
                                최신 회의록 바로가기
                                <ChevronIcon />
                            </PromoButton>
                        </PromoCard>

                        <ListPanel>
                            <ListHead>
                                <h3>총학생회 회칙 및 세칙</h3>
                                
                            </ListHead>
                            <MiniTable>
                                <thead>
                                    <tr>
                                        <th>번호</th>
                                        <th>제목</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={2}
                                                style={{ color: colors.textLight, textAlign: "center" }}
                                            >
                                                등록된 게시글이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                    {rules.map((post) => (
                                        <tr key={post.id}>
                                            <td>{post.displayNumber}</td>
                                            <td>
                                                <Link to={`/autonomy/rules/detail/${post.id}`}>
                                                    {post.title}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </MiniTable>
                        </ListPanel>
                    </AutonomyGrid>
                </Section>

                {/* 대관 / 대여 */}
                <Section $gap={SECTION_GAP}>
                    <TwoCol>
                        <InfoLinkCard
                            title="대관"
                            description="온라인 공간 대여"
                            icon={<CalendarIcon />}
                            to="/info/venue"
                        />
                        <InfoLinkCard
                            title="대여"
                            description={"상시 대여, 학위복/졸업소품\n학술정보원 사물함"}
                            icon={<BoxIcon />}
                            to="/info/rental"
                        />
                    </TwoCol>
                </Section>

                {/* 연간 일정 — 시안에는 섹션 제목 없이 패널만 있다 */}
                <Section $gap={SECTION_GAP}>
                    <CalendarPanel as="div">
                        <HomeCalendar />
                    </CalendarPanel>
                </Section>

                {/* 오시는 길 */}
                <Section $gap={SECTION_GAP}>
                    <MapGrid>
                        <MapImage
                            src={campusMap}
                            alt="중앙대학교 서울캠퍼스 107관 학생회관 위치 안내 지도"
                        />
                        <OfficePanel>
                            <h3>
                                총학생회실
                                <br />
                                업무 시간 안내
                            </h3>
                            <hr />
                            <dl>
                                <dt>주 소</dt>
                                <dd>
                                    서울특별시 동작구 흑석로 84
                                    <br />
                                    중앙대학교 107관 208호
                                </dd>
                                <dt>업무 시간</dt>
                                <dd>
                                    월-금 11:00 - 18:00
                                    <br />
                                    (토, 일, 공휴일 휴무)
                                </dd>
                            </dl>
                            <OfficeContact>
                                <CopyButton
                                    type="button"
                                    onClick={() => handleCopy("02-881-7371", "phone")}
                                    title="클릭하면 전화번호가 복사됩니다"
                                >
                                    <PhoneIcon />
                                    02-881-7371
                                    <CopyHint $show={copiedField === "phone"}>복사됨</CopyHint>
                                </CopyButton>
                                <CopyButton
                                    type="button"
                                    onClick={() => handleCopy("cau.68.cable@gmail.com", "email")}
                                    title="클릭하면 이메일 주소가 복사됩니다"
                                >
                                    <MailIcon />
                                    cau.68.cable@gmail.com
                                    <CopyHint $show={copiedField === "email"}>복사됨</CopyHint>
                                </CopyButton>
                            </OfficeContact>
                        </OfficePanel>
                    </MapGrid>
                </Section>
            </Main>

            <SiteFooter />
        </Page>
    );
};

export default Home;
