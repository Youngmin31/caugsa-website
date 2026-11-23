/**
 * SiteHeader
 * ==========
 * TopBar + 글로벌 내비게이션.
 * 메뉴는 config/boards.js 에서 생성하므로 게시판이 늘어도 여기는 고치지 않는다.
 *
 * 스크롤 동작
 *   화면 맨 위  : 상단바 + 내비게이션이 함께 보인다 (메인은 히어로 위에 반투명)
 *   스크롤 후   : 상단바는 접히고 내비게이션만 네이비로 바뀌어 계속 떠 있는다
 *
 * 헤더는 항상 position: fixed 라서 문서 흐름에서 빠진다. 메인 말고 다른
 * 페이지는 그만큼 내용이 위로 올라붙으므로 Spacer 로 자리를 채워 준다.
 * (메인은 히어로 사진이 헤더 뒤로 올라오는 게 시안이라 Spacer 를 두지 않는다)
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styled from "styled-components";

import TopBar from "./TopBar";
import { MENUS, boardPath, menuDefaultPath } from "../../config/boards";
import { colors, font, layout, media, clampW, clampH } from "../../styles/theme";
import logo from "../../assets/images/logo_1.svg";
import logoScrolled from "../../assets/images/logo_scrolled.png";

/** 이 값을 넘게 스크롤하면 네이비 상태로 바뀐다. */
const SCROLL_THRESHOLD = 30;

const Header = styled.header`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 50;
`;

/**
 * 아래로 스크롤하면 상단바를 접고, 위로 스크롤하면(맨 위까지 가지 않아도)
 * 다시 펼친다. 안쪽 TopBar 는 그대로 두고 높이만 깎는다.
 */
const TopBarSlot = styled.div`
    overflow: hidden;
    height: ${(props) => (props.$hidden ? "0px" : layout.topBarHeight)};
    transition: height 0.25s ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }

    ${media.mobile} {
        height: ${(props) => (props.$hidden ? "0px" : "auto")};
    }
`;

/** 헤더가 fixed 라 비는 자리를 메운다. 접히기 전 높이 기준이라 흔들리지 않는다. */
/**
 * 헤더가 fixed 라 비는 자리를 메운다. 접히기 전 높이 기준이라 흔들리지 않는다.
 * 실측 전 첫 렌더에서는 테마 값으로 자리를 잡아 두어 화면이 튀지 않게 한다.
 */
const Spacer = styled.div`
    flex: 0 0 auto;
    width: 100%;
    height: ${(props) =>
        props.$height > 0
            ? `${props.$height}px`
            : `calc(${layout.topBarHeight} + ${layout.navHeight})`};
`;

const NavBar = styled.nav`
    width: 100%;
    height: ${layout.navHeight};
    display: flex;
    align-items: center;
    transition: background 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

    background: ${(props) => {
        if (props.$scrolled) return "rgba(18, 24, 80, 0.94)";
        if (props.$overlay) return "rgba(255, 255, 255, 0.61)";
        return `linear-gradient(180deg, #f7f9fd 0%, ${colors.navBg} 100%)`;
    }};
    backdrop-filter: ${(props) => (props.$scrolled ? "blur(10px)" : props.$overlay ? "blur(2px)" : "none")};
    border-bottom: 1px solid
        ${(props) => (props.$scrolled || props.$overlay ? "transparent" : "rgba(18, 24, 80, 0.08)")};
    box-shadow: ${(props) => (props.$scrolled ? "0 6px 24px rgba(6, 10, 40, 0.26)" : "none")};

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }

    ${media.mobile} {
        height: auto;
        padding: 10px 0;
    }
`;

/**
 * 로고와 메뉴 묶음을 나란히 놓는 줄.
 * 로고는 폭을 고정으로 차지하고, 남는 폭은 전부 메뉴 묶음이 가져간다.
 */
const Inner = styled.div`
    width: 100%;
    max-width: 1920px;
    margin: 0 auto;
    /* 시안: 로고가 화면 왼쪽 28px 에 붙는다 */
    padding: 0 ${clampW(28)};
    display: flex;
    align-items: center;

    ${media.mobile} {
        flex-direction: column;
        gap: ${clampH(10)};
        padding: 0 ${clampW(14)};
    }
`;

/* 로고는 늘지도 줄지도 않는다. 메뉴와 폭을 나눠 갖지 않도록 flex 를 꺼 둔다. */
const LogoLink = styled(Link)`
    position: relative;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
`;

/*
 * 로고 두 장을 같은 자리에 겹쳐 두고 opacity 로 크로스페이드한다.
 *   LogoImg      : 기본 상태(남색 글자, logo_1.svg)
 *   LogoScrolled : 스크롤 상태(흰 글자 + 빨간 포인트, 미리 합성해 둔 PNG)
 *
 * 예전에는 LogoImg 전체에 filter: invert 를 걸어 흰색으로 뒤집고, 빨간
 * 테두리만 오려낸 이미지를 퍼센트 좌표로 겹쳐서 흉내 냈다. 그 좌표가
 * 레이아웃(마진, 반응형 높이 등)과 아주 미세하게라도 어긋나면 빨간 사각형이
 * 엉뚱한 자리에 찍혀 "깨진 것처럼" 보였다. 지금은 스크롤 상태를 색까지
 * 반영해 통짜 이미지로 미리 만들어 두므로 그런 어긋남 자체가 생기지 않는다.
 */
const LogoImg = styled.img`
    position: relative;
    height: ${clampH(60)};
    width: auto;
    margin-left: -8px;
    display: block;
    opacity: ${(props) => (props.$scrolled ? 0 : 1)};
    transition: opacity 0.25s ease;

    ${media.tablet} {
        height: ${clampH(58)};
    }

    ${media.mobile} {
        height: ${clampH(50)};
        margin-left: -6px;
    }
`;

/* logo_1.svg 와 가로세로 비율을 맞춰 합성해 둔 스크롤 상태 전용 로고. */
const LogoScrolled = styled.img`
    position: absolute;
    left: -8px;
    top: 0;
    height: ${clampH(60)};
    width: auto;
    display: block;
    opacity: ${(props) => (props.$scrolled ? 1 : 0)};
    transition: opacity 0.25s ease;
    pointer-events: none;

    ${media.tablet} {
        height: ${clampH(58)};
    }

    ${media.mobile} {
        height: ${clampH(50)};
        left: -6px;
    }
`;

/**
 * 메뉴 4개만 묶은 flex 줄. 로고가 쓰고 남은 폭을 전부 받아
 * 항목을 space-between 으로 흩는다 (각 항목 폭은 글자 길이 그대로).
 *
 * 좌우 안쪽 여백은 시안(1920) 에서 잰 값이다. 오른쪽 233 은 마지막 메뉴 끝을
 * 시안과 같은 1649 에 맞추고, 왼쪽 238 은 로고 오른쪽에서 첫 메뉴까지의 간격이다.
 *
 * 4칸을 같은 폭으로 나누고 싶으면 space-between 을 지우고
 * MenuItem 에 flex: 1 을 주면 된다.
 */
const MenuList = styled.ul`
    flex: 1 1 auto;
    min-width: 0;
    list-style: none;
    margin: 0;
    padding: 0 clamp(0px, 12vw, 233px) 0 clamp(28px, 13vw, 238px);
    display: flex;
    align-items: center;
    justify-content: space-between;

    /* 태블릿 폭에서는 시안의 좌우 여백을 유지할 자리가 없다.
       여백을 걷어 남는 폭을 메뉴가 다 쓰게 한다. */
    ${media.tablet} {
        padding: 0 0 0 ${clampW(24)};
    }

    ${media.mobile} {
        width: 100%;
        padding: 0;
        gap: ${clampW(4)};
    }
`;

const MenuItem = styled.li`
    position: relative;
    padding: ${clampH(22)} 0;

    ${media.mobile} {
        padding: ${clampH(8)} 0;
    }
`;

const MenuLink = styled(Link)`
    display: inline-block;
    font-family: ${font.family};
    font-size: ${font.size.xl};
    font-weight: ${font.weight.bold};
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.25s ease, border-color 0.15s ease;

    color: ${(props) => {
        if (props.$scrolled) return props.$active ? colors.white : "rgba(255, 255, 255, 0.9)";
        return props.$active ? colors.navy : colors.textStrong;
    }};
    border-bottom: 2px solid
        ${(props) => {
            if (!props.$active) return "transparent";
            return props.$scrolled ? colors.white : colors.navy;
        }};

    &:hover {
        color: ${(props) => (props.$scrolled ? colors.white : colors.navy)};
    }

    ${media.tablet} {
        font-size: ${font.size.lg};
    }

    ${media.mobile} {
        font-size: ${font.size.sm};
    }
`;

/**
 * 메뉴 아래로 열리는 패널.
 * 사진 위에 얹히는 반투명 흰 판 + 메뉴를 가리키는 삼각형 (::before).
 * top: 100% 로 붙여 두어 커서가 메뉴에서 패널로 내려오는 동안 hover 가 끊기지 않는다.
 * 항상 메뉴 글자 정가운데에 오도록 맞춘다 (마지막 메뉴도 예외 없이).
 */
const Dropdown = styled.ul`
    position: absolute;
    top: 100%;
    left: 50%;
    min-width: ${clampW(264)};
    margin: 0;
    padding: ${clampH(6)} 0;
    list-style: none;
    background: rgba(255, 255, 255, 0.93);
    backdrop-filter: blur(16px) saturate(1.15);
    box-shadow: 0 20px 44px rgba(8, 14, 45, 0.22);

    opacity: ${(props) => (props.$show ? 1 : 0)};
    visibility: ${(props) => (props.$show ? "visible" : "hidden")};
    transform: translateX(-50%) translateY(${(props) => (props.$show ? "0" : "-6px")});
    transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;

    /* 가리키는 삼각형. 패널과 함께 항상 메뉴 글자 가운데를 향한다. */
    &::before {
        content: "";
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 8px solid rgba(255, 255, 255, 0.93);
    }

    li + li a {
        border-top: 1px solid rgba(18, 24, 80, 0.07);
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }

    ${media.mobile} {
        display: none;
    }
`;

const DropdownLink = styled(Link)`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${clampW(30)};
    padding: ${clampH(19)} ${clampW(28)};
    font-family: ${font.family};
    font-size: ${font.size.lg};
    font-weight: ${font.weight.medium};
    color: #1b2340;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;

    /* 오른쪽 꺾쇠 */
    &::after {
        content: "";
        flex: 0 0 auto;
        width: 9px;
        height: 9px;
        border-top: 1.7px solid #97a0bb;
        border-right: 1.7px solid #97a0bb;
        transform: rotate(45deg);
        transition: border-color 0.15s ease, transform 0.15s ease;
    }

    &:hover,
    &:focus-visible {
        background: rgba(255, 255, 255, 0.62);
        color: ${colors.navy};
    }

    &:hover::after,
    &:focus-visible::after {
        border-color: ${colors.navy};
        transform: rotate(45deg) translate(2px, -2px);
    }
`;

const SiteHeader = ({ overlay = false }) => {
    const location = useLocation();
    const [openKey, setOpenKey] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    // 아래로 스크롤하면 숨기고, 위로 스크롤하면(맨 위까지 가지 않아도) 다시 보인다.
    const [topBarHidden, setTopBarHidden] = useState(false);
    const [spacerHeight, setSpacerHeight] = useState(0);
    const topBarRef = useRef(null);
    const navRef = useRef(null);
    const lastScrollY = useRef(0);
    const activeKey = location.pathname.split("/")[1];

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            setScrolled(y > SCROLL_THRESHOLD);

            if (y <= SCROLL_THRESHOLD) {
                setTopBarHidden(false);
            } else if (y > lastScrollY.current) {
                setTopBarHidden(true); // 아래로 스크롤
            } else if (y < lastScrollY.current) {
                setTopBarHidden(false); // 위로 스크롤
            }
            lastScrollY.current = y;
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // 접히기 전 높이로 잰다. TopBarSlot 은 접혀도 scrollHeight 가 원래 높이를 준다.
    useEffect(() => {
        if (overlay) return undefined;
        const measure = () => {
            const top = topBarRef.current ? topBarRef.current.scrollHeight : 0;
            const nav = navRef.current ? navRef.current.offsetHeight : 0;
            setSpacerHeight(top + nav);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [overlay]);

    return (
        <>
            <Header>
                <TopBarSlot ref={topBarRef} $hidden={topBarHidden}>
                    <TopBar />
                </TopBarSlot>
                <NavBar ref={navRef} $overlay={overlay} $scrolled={scrolled}>
                    <Inner>
                        <LogoLink to="/home">
                            <LogoImg src={logo} alt="중대중심 - 중앙대학교 서울캠퍼스 총학생회" $scrolled={scrolled} />
                            <LogoScrolled src={logoScrolled} alt="" aria-hidden="true" $scrolled={scrolled} />
                        </LogoLink>
                        <MenuList>
                            {MENUS.map((menu) => (
                                <MenuItem
                                    key={menu.key}
                                    onMouseEnter={() => setOpenKey(menu.key)}
                                    onMouseLeave={() => setOpenKey(null)}
                                >
                                    <MenuLink
                                        to={menuDefaultPath(menu)}
                                        $active={activeKey === menu.key}
                                        $scrolled={scrolled}
                                    >
                                        {menu.title}
                                    </MenuLink>
                                    <Dropdown $show={openKey === menu.key}>
                                        {menu.boards.map((board) => (
                                            <li key={board.slug}>
                                                <DropdownLink to={boardPath(menu.key, board.slug)}>
                                                    {board.name}
                                                </DropdownLink>
                                            </li>
                                        ))}
                                    </Dropdown>
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Inner>
                </NavBar>
            </Header>

            {!overlay && <Spacer $height={spacerHeight} />}
        </>
    );
};

export default SiteHeader;
