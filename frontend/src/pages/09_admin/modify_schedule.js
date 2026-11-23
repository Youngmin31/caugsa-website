import React, { useState, useEffect } from 'react';
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import CalendarWithSchedule from "../../components/Calendar";
import HolidayManager from "../../components/HolidayManager";

const Wrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    text-align: center;
`;

const CalendarPage = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(null); // null: 확인 중, true/false: 확인 완료

    useEffect(() => {
        const checkAdminStatus = () => {
            const userRole = localStorage.getItem('user_role') || sessionStorage.getItem('user_role');
            const isAdminUser = userRole === 'admin';
            setIsAdmin(isAdminUser);

            if (!isAdminUser) {
                alert('관리자만 접근 가능한 페이지입니다.');
                navigate('/');
            }
        };

        checkAdminStatus();

        const handleStorageChange = () => checkAdminStatus();
        window.addEventListener('storage', handleStorageChange);

        return () => window.removeEventListener('storage', handleStorageChange);
    }, [navigate]);

    if (isAdmin === null) return null; // 관리자 여부 확인 중이면 렌더링 X

    return (
        <Wrapper>
            <CalendarWithSchedule />
            <HolidayManager />
        </Wrapper>
    );
};

export default CalendarPage;