/**
 * TopBar
 * ======
 * 최상단 네이비 바. 왼쪽 SNS 아이콘, 오른쪽 관리자 / 내 정보 / 로그인·로그아웃.
 *
 * 관리자 링크는 role 이 admin 일 때만 보인다. 서버도 @admin_required 로 다시
 * 검사하므로 이건 화면 노출 기준일 뿐이다.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import { colors, font, layout, media, clampW } from "../../styles/theme";

const Bar = styled.div`
    width: 100%;
    height: ${layout.topBarHeight};
    background: ${colors.navy};
    color: ${colors.onNavy};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 ${clampW(28)};

    ${media.mobile} {
        padding: 0 ${clampW(14)};
    }
`;

const Social = styled.div`
    flex: 0 0 auto;
    margin-right: auto;
    display: flex;
    align-items: center;
    gap: ${clampW(12)};

    a {
        color: ${colors.onNavy};
        display: inline-flex;
        opacity: 0.95;
        transition: opacity 0.15s ease;

        &:hover {
            opacity: 1;
        }
    }
`;

const RightArea = styled.div`
    flex: 0 0 auto;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: ${clampW(16)};
`;

const NavLinkButton = styled.button`
    width: fit-content;
    background: none;
    border: none;
    cursor: pointer;
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    opacity: 0.95;
    padding: 0;

    &:hover {
        opacity: 1;
        text-decoration: underline;
    }
`;

const AuthButton = styled.button`
    flex: 0 0 auto;
    /* 오른쪽 정렬은 RightArea 가 맡는다 */
    /* flex 아이템이 된 <button> 은 폭이 늘어나므로 콘텐츠 폭으로 고정한다 */
    width: fit-content;
    background: none;
    border: none;
    cursor: pointer;
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    display: inline-flex;
    align-items: center;
    gap: ${clampW(6)};
    padding: 0;
`;

const SOCIAL_LINKS = [
    { key: "instagram", label: "인스타그램", href: "https://www.instagram.com/cau.cable/" },
    { key: "kakao", label: "카카오톡", href: "https://pf.kakao.com/_wLfZd" },
    { key: "facebook", label: "페이스북", href: "https://www.facebook.com/caugsa/?locale=ko_KR" },
];

const Icon = ({ name }) => {
    if (name === "instagram") {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
            </svg>
        );
    }
    if (name === "kakao") {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9.2-3.3 9.2-7.5S17.1 3 12 3z" />
            </svg>
        );
    }
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
        </svg>
    );
};

const UserIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.8 20c0-3.6 3.2-6 7.2-6s7.2 2.4 7.2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const TopBar = () => {
    const navigate = useNavigate();
    const isLoggedIn = Boolean(localStorage.getItem("access_token"));
    const isAdmin =
        (localStorage.getItem("user_role") || sessionStorage.getItem("user_role")) === "admin";

    const handleAuth = () => {
        if (!isLoggedIn) {
            navigate("/intro/login");
            return;
        }
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_role_detail");
        navigate("/home");
        window.location.reload();
    };

    return (
        <Bar>
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
            <RightArea>
                {isAdmin && (
                    <NavLinkButton type="button" onClick={() => navigate("/admin")}>
                        관리자
                    </NavLinkButton>
                )}
                {isLoggedIn && (
                    <NavLinkButton type="button" onClick={() => navigate("/mypage/edit")}>
                        내 정보
                    </NavLinkButton>
                )}
                <AuthButton type="button" onClick={handleAuth}>
                    <UserIcon />
                    {isLoggedIn ? "Logout" : "Login"}
                </AuthButton>
            </RightArea>
        </Bar>
    );
};

export default TopBar;
