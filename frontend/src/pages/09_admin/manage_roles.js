/**
 * 09_admin/manage_roles.js
 * =========================
 * 매니저 권한 부여/해제. ADMIN 전용 화면이다 (서버도 @admin_only 로 다시 검사).
 *
 * 매니저는 게시판 글 작성 + 캘린더 수정만 할 수 있다. ADMIN 계정은 이 화면에서
 * 건드리지 않는다 (서버가 거절하므로 버튼 자체를 보이지 않게 한다).
 */

import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import {
    AdminDescription, AdminMessage, AdminTitle, AdminWrapper, useAdminOnlyGuard,
} from "./adminCommon";
import { listManagers, searchUsers, updateUserRole } from "../../services/roleService";
import { colors, font, radius } from "../../styles/theme";

const SectionTitle = styled.h3`
    margin: 0 0 12px;
    font-size: ${font.size.lg};
    font-weight: ${font.weight.bold};
    color: ${colors.textStrong};
`;

const SearchSection = styled.div`
    margin-top: 40px;
`;

const SearchRow = styled.form`
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
`;

const SearchInput = styled.input`
    flex: 1;
    max-width: 320px;
    padding: 10px 12px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.text};
    outline: none;

    &:focus {
        border-color: ${colors.navy};
    }
`;

const SearchButton = styled.button`
    width: fit-content;
    flex: 0 0 auto;
    padding: 10px 18px;
    border: 1px solid ${colors.navy};
    border-radius: ${radius.sm};
    background: ${colors.navy};
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-family: ${font.family};

    th,
    td {
        padding: 10px 10px;
        border-bottom: 1px solid ${colors.divider};
        font-size: ${font.size.sm};
        text-align: left;
    }

    th {
        color: ${colors.textMuted};
        font-weight: ${font.weight.semibold};
        white-space: nowrap;
    }

    td.actions {
        width: 1%;
        white-space: nowrap;
    }
`;

const RoleTag = styled.span`
    padding: 3px 9px 4px;
    border-radius: ${radius.sm};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.semibold};
    background: ${(props) => (props.$role === "ADMIN" ? "#FDEEEE" : props.$role === "MANAGER" ? "#EDF3FF" : "#F1F2F6")};
    color: ${(props) => (props.$role === "ADMIN" ? "#C62828" : props.$role === "MANAGER" ? "#2F5FBF" : "#6E738C")};
`;

const ActionButton = styled.button`
    width: fit-content;
    padding: 6px 14px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.sm};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:hover {
        background: ${colors.pageBg};
    }

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const ROLE_LABEL = { ADMIN: "관리자", MANAGER: "매니저", USER: "일반" };

/** 로그인ID/이름/권한/관리 버튼 네 칸짜리 표. 현재 매니저 목록과 검색 결과가 같이 쓴다. */
const UserTable = ({ users, busyId, onToggle }) => (
    <Table>
        <thead>
            <tr>
                <th>로그인ID</th>
                <th>이름</th>
                <th>권한</th>
                <th>관리</th>
            </tr>
        </thead>
        <tbody>
            {users.map((user) => (
                <tr key={user.id}>
                    <td>{user.loginId}</td>
                    <td>{user.name}</td>
                    <td>
                        <RoleTag $role={user.role}>{ROLE_LABEL[user.role] || user.role}</RoleTag>
                    </td>
                    <td className="actions">
                        {user.role === "ADMIN" ? (
                            "—"
                        ) : (
                            <ActionButton
                                type="button"
                                disabled={busyId === user.id}
                                onClick={() => onToggle(user)}
                            >
                                {user.role === "MANAGER" ? "매니저 해제" : "매니저로 지정"}
                            </ActionButton>
                        )}
                    </td>
                </tr>
            ))}
        </tbody>
    </Table>
);

const ManageRoles = () => {
    const isAdmin = useAdminOnlyGuard();
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [managers, setManagers] = useState(null);
    const [managersLoading, setManagersLoading] = useState(false);
    const [managersError, setManagersError] = useState(null);

    const [busyId, setBusyId] = useState(null);

    const loadManagers = useCallback(async () => {
        setManagersLoading(true);
        setManagersError(null);
        try {
            const result = await listManagers();
            setManagers(result);
        } catch (err) {
            setManagersError(
                (err.response && err.response.data && err.response.data.message) || "매니저 목록을 불러오지 못했습니다."
            );
        } finally {
            setManagersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) loadManagers();
    }, [isAdmin, loadManagers]);

    const handleSearch = async (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        setLoading(true);
        setError(null);
        try {
            const result = await searchUsers(trimmed);
            setUsers(result);
        } catch (err) {
            setError((err.response && err.response.data && err.response.data.message) || "검색에 실패했습니다.");
            setUsers(null);
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = async (user) => {
        const nextRole = user.role === "MANAGER" ? "USER" : "MANAGER";
        const verb = nextRole === "MANAGER" ? "매니저로 지정" : "매니저 해제";
        if (!window.confirm(`${user.name}(${user.loginId})을 ${verb}할까요?`)) return;

        setBusyId(user.id);
        try {
            await updateUserRole(user.id, nextRole);
            setUsers((prev) => (prev ? prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)) : prev));
            // 검색 결과와 매니저 목록 둘 다에 걸쳐 있을 수 있어, 매니저 목록은 다시 받아온다.
            await loadManagers();
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message) || "권한 변경에 실패했습니다.");
        } finally {
            setBusyId(null);
        }
    };

    if (isAdmin === null) return <AdminMessage>확인 중…</AdminMessage>;
    if (!isAdmin) return null;

    return (
        <AdminWrapper>
            <AdminTitle>매니저 권한 관리</AdminTitle>
            <AdminDescription>
                매니저는 게시판 글 작성과 캘린더 수정만 할 수 있습니다. 로그인ID 또는 이름으로 사용자를
                찾아 매니저 권한을 부여하거나 해제하세요. 관리자 계정은 여기서 바꿀 수 없습니다.
            </AdminDescription>

            <SectionTitle>현재 매니저{managers ? ` (${managers.length}명)` : ""}</SectionTitle>
            {managersLoading ? (
                <AdminMessage>불러오는 중…</AdminMessage>
            ) : managersError ? (
                <AdminMessage>{managersError}</AdminMessage>
            ) : managers && managers.length === 0 ? (
                <AdminMessage>현재 매니저로 지정된 사용자가 없습니다.</AdminMessage>
            ) : managers ? (
                <UserTable users={managers} busyId={busyId} onToggle={toggleRole} />
            ) : null}

            <SearchSection>
                <SectionTitle>사용자 검색</SectionTitle>
                <SearchRow onSubmit={handleSearch}>
                    <SearchInput
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="로그인ID 또는 이름"
                    />
                    <SearchButton type="submit" disabled={loading}>
                        {loading ? "검색 중…" : "검색"}
                    </SearchButton>
                </SearchRow>

                {error && <AdminMessage>{error}</AdminMessage>}

                {users !== null && !error && (
                    users.length === 0 ? (
                        <AdminMessage>일치하는 사용자가 없습니다.</AdminMessage>
                    ) : (
                        <UserTable users={users} busyId={busyId} onToggle={toggleRole} />
                    )
                )}
            </SearchSection>
        </AdminWrapper>
    );
};

export default ManageRoles;
