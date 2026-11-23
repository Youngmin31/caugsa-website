/**
 * SubLayout
 * =========
 * 서브 페이지 공통 골격 (figma 화면/ 시안 기준).
 *
 *   TopBar + 내비게이션
 *   히어로 배너 (전체 폭 사진)
 *   본문 : [메뉴 사이드바] [콘텐츠]
 *   푸터
 *
 * 사이드바가 없는 페이지(로그인/회원가입 등)는 메뉴에 없는 경로이므로
 * 자동으로 사이드바 없이 전체 폭으로 렌더된다.
 */

import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import styled from "styled-components";

import SiteHeader from "../components/layout/SiteHeader";
import SiteFooter from "../components/layout/SiteFooter";
import BoardSidebar from "../components/board/BoardSidebar";
import { findMenu } from "../config/boards";
import { colors, layout, media } from "../styles/theme";
import Banner from "../assets/images/sub/sub01_visual.jpg";

const Wrapper = styled.div`
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${colors.pageBg};
`;

const Hero = styled.div`
    width: 100%;
    height: ${layout.heroHeight};
    background-image: url(${Banner});
    background-size: cover;
    background-position: center;

    ${media.mobile} {
        height: ${layout.heroHeightMobile};
    }
`;

const Main = styled.main`
    flex: 1;
    width: 100%;
    max-width: ${layout.maxWidth};
    margin: 0 auto;
    padding: 72px 24px 110px;
    display: flex;
    align-items: flex-start;
    gap: ${layout.gutter};

    ${media.tablet} {
        gap: 32px;
    }

    ${media.mobile} {
        flex-direction: column;
        /* 세로로 쌓일 때 align-items: flex-start(기본값)가 자식을 콘텐츠
           폭만큼만 줄이고 왼쪽에 붙여, 로그인/회원가입처럼 사이드바 없는
           페이지의 카드가 화면 오른쪽에 빈 공간을 남긴 채 왼쪽으로
           쏠려 보였다. 세로 쌓임에서는 폭을 꽉 채우게 한다. */
        align-items: stretch;
        padding: 32px 16px 60px;
        gap: 24px;
    }
`;

const Content = styled.div`
    flex: 1;
    min-width: 0;
`;

const SubLayout = () => {
    const location = useLocation();
    const menuKey = location.pathname.split("/")[1];
    const menu = findMenu(menuKey);

    return (
        <Wrapper>
            <SiteHeader />
            <Hero />
            <Main>
                {menu && <BoardSidebar menu={menu} />}
                <Content>
                    <Outlet />
                </Content>
            </Main>
            <SiteFooter />
        </Wrapper>
    );
};

export default SubLayout;
