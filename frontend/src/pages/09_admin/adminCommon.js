/**
 * 09_admin/adminCommon.js
 * =======================
 * 관리자 화면이 공유하는 권한 확인 훅과 공통 스타일.
 *
 * 권한 판정 기준은 기존 화면들과 같다 (로그인 시 저장한 user_role).
 * 서버도 @admin_required 로 다시 검사하므로 여기 통과가 곧 권한은 아니고,
 * 화면 노출을 거르는 용도다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import { colors, font } from "../../styles/theme";
import { isAdminOnlyUser, isAdminUser } from "../../utils/auth";

export { isAdminUser, isAdminOnlyUser };

/**
 * 관리자(ADMIN/MANAGER)가 아니면 홈으로 돌려보낸다.
 * 반환값: null = 확인 전, true/false = 판정 완료
 */
export const useAdminGuard = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(null);

    useEffect(() => {
        const ok = isAdminUser();
        setIsAdmin(ok);
        if (!ok) {
            alert("관리자만 접근 가능한 페이지입니다.");
            navigate("/");
        }
    }, [navigate]);

    return isAdmin;
};

/**
 * ADMIN 전용 화면(섹션 이미지/고정 콘텐츠/권한 관리)에 쓴다. MANAGER 는
 * 게시판 글 작성 + 캘린더 수정만 할 수 있어 여기서는 홈으로 돌려보낸다.
 * 반환값: null = 확인 전, true/false = 판정 완료
 */
export const useAdminOnlyGuard = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(null);

    useEffect(() => {
        const ok = isAdminOnlyUser();
        setIsAdmin(ok);
        if (!ok) {
            alert("관리자만 접근 가능한 페이지입니다.");
            navigate("/");
        }
    }, [navigate]);

    return isAdmin;
};

export const AdminWrapper = styled.div`
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 32px 20px 60px;
    font-family: ${font.family};
    color: ${colors.text};
`;

export const AdminTitle = styled.h2`
    margin: 0 0 6px;
    font-size: 24px;
    font-weight: 700;
    color: ${colors.textStrong};
`;

export const AdminDescription = styled.p`
    margin: 0 0 28px;
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

export const AdminMessage = styled.p`
    padding: 60px 0;
    text-align: center;
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

export const Card = styled.div`
    background: ${colors.cardBg};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 20px;
`;
